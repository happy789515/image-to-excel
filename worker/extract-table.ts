import {
  GEMINI_API_BASE,
  GEMINI_MODEL,
  GENERATION_CONFIG,
  TABLE_EXTRACT_SYSTEM_INSTRUCTION,
} from './gemini-config'
import { fetchGemini } from './gemini-fetch'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
])

export type TableRowJson = { cells: string[] }
export type TableExtractJson = {
  name: string
  rows: TableRowJson[]
}

type ExtractRequestBody = {
  imageBase64?: string
  mimeType?: string
  sheetName?: string
}

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}

function stripDataUrlPrefix(base64: string): string {
  const comma = base64.indexOf(',')
  if (base64.startsWith('data:') && comma !== -1) {
    return base64.slice(comma + 1)
  }
  return base64.trim()
}

function estimateBase64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return (base64.length * 3) / 4 - padding
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
  error?: { message?: string; code?: number; status?: string }
}

export async function handleExtractTable(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return jsonError(500, 'GEMINI_API_KEY is not configured')
  }

  let body: ExtractRequestBody
  try {
    body = (await request.json()) as ExtractRequestBody
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const { mimeType, sheetName } = body
  if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
    return jsonError(400, 'imageBase64 is required')
  }
  if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
    return jsonError(400, 'mimeType must be image/png, image/jpeg, or image/webp')
  }

  const imageBase64 = stripDataUrlPrefix(body.imageBase64)
  if (estimateBase64Bytes(imageBase64) > MAX_IMAGE_BYTES) {
    return jsonError(413, 'Image exceeds 8 MiB limit')
  }

  const sheetLabel =
    typeof sheetName === 'string' && sheetName.trim().length > 0
      ? sheetName.trim().slice(0, 120)
      : 'Sheet1'

  const userText = `Extract the table from this image. Sheet name: ${sheetLabel}`

  const geminiBody = {
    systemInstruction: {
      parts: [{ text: TABLE_EXTRACT_SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: userText },
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: GENERATION_CONFIG,
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`
  const upstream = await fetchGemini(env, url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify(geminiBody),
  })

  const raw = (await upstream.json()) as GeminiGenerateResponse

  if (!upstream.ok) {
    const detail =
      raw.error?.message ?? `Gemini request failed (${upstream.status})`
    return jsonError(502, detail)
  }

  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    return jsonError(502, 'Empty response from Gemini')
  }

  let parsed: TableExtractJson
  try {
    parsed = JSON.parse(text) as TableExtractJson
  } catch {
    return jsonError(502, 'Gemini returned non-JSON text')
  }

  if (!parsed.name || !Array.isArray(parsed.rows)) {
    return jsonError(502, 'Gemini JSON missing name or rows')
  }

  return Response.json(parsed)
}