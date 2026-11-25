import {
  clientStatusFromGeminiUpstream,
  workerExtractTableErrorMessage,
} from './extract-table-errors'
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
    return jsonError(500, workerExtractTableErrorMessage(500))
  }

  let body: ExtractRequestBody
  try {
    body = (await request.json()) as ExtractRequestBody
  } catch {
    return jsonError(400, workerExtractTableErrorMessage(400))
  }

  const { mimeType, sheetName } = body
  if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
    return jsonError(
      400,
      '이미지 데이터가 없습니다. 영역을 선택한 뒤 다시 시도해 주세요.',
    )
  }
  if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
    return jsonError(400, '지원하지 않는 이미지 형식입니다. (PNG, JPEG, WebP)')
  }

  const imageBase64 = stripDataUrlPrefix(body.imageBase64)
  if (estimateBase64Bytes(imageBase64) > MAX_IMAGE_BYTES) {
    return jsonError(413, workerExtractTableErrorMessage(413))
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

  let raw: GeminiGenerateResponse
  try {
    raw = (await upstream.json()) as GeminiGenerateResponse
  } catch {
    const status = clientStatusFromGeminiUpstream(upstream.status)
    return jsonError(status, workerExtractTableErrorMessage(status))
  }

  if (!upstream.ok) {
    const status = clientStatusFromGeminiUpstream(upstream.status)
    return jsonError(status, workerExtractTableErrorMessage(status))
  }

  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    return jsonError(502, 'Gemini가 빈 응답을 반환했습니다. 다시 시도해 주세요.')
  }

  let parsed: TableExtractJson
  try {
    parsed = JSON.parse(text) as TableExtractJson
  } catch {
    return jsonError(
      502,
      '표 구조를 JSON으로 읽지 못했습니다. 영역을 조정한 뒤 다시 시도해 주세요.',
    )
  }

  if (!parsed.name || !Array.isArray(parsed.rows)) {
    return jsonError(
      502,
      '표 데이터가 불완전합니다. 영역을 다시 확인해 주세요.',
    )
  }

  return Response.json(parsed)
}