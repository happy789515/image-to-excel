import {
  clientStatusFromGeminiUpstream,
  workerExtractTableErrorMessage,
  workerGeminiRequestTooLargeMessage,
} from './extract-table-errors'
import { GEMINI_API_BASE } from './gemini-config'
import { fetchGemini } from './gemini-fetch'
import { MAX_GEMINI_REQUEST_BYTES } from './limits'

export class GeminiCallError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

type GeminiPart = { text?: string; thought?: boolean }
type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
  }>
  error?: { message?: string; code?: number; status?: string }
}

export type GeminiGenerateContentBody = {
  systemInstruction?: { parts: Array<{ text: string }> }
  contents: Array<{
    role: string
    parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >
  }>
  generationConfig: Record<string, unknown>
}

function joinResponseText(parts: GeminiPart[] | undefined): string | null {
  if (!parts?.length) return null
  const chunks: string[] = []
  for (const part of parts) {
    if (part.thought === true) continue
    if (typeof part.text === 'string' && part.text.length > 0) {
      chunks.push(part.text)
    }
  }
  return chunks.length > 0 ? chunks.join('') : null
}

export async function callGeminiJson<T>(
  env: Env,
  model: string,
  body: GeminiGenerateContentBody,
  parseErrorMessage: (status: number) => string = workerExtractTableErrorMessage,
): Promise<T> {
  if (!env.GEMINI_API_KEY?.trim()) {
    throw new GeminiCallError(500, workerExtractTableErrorMessage(500))
  }

  const serialized = JSON.stringify(body)
  if (new TextEncoder().encode(serialized).length > MAX_GEMINI_REQUEST_BYTES) {
    throw new GeminiCallError(413, workerGeminiRequestTooLargeMessage())
  }

  const url = `${GEMINI_API_BASE}/models/${model}:generateContent`
  const upstream = await fetchGemini(env, url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: serialized,
  })

  let raw: GeminiGenerateResponse
  try {
    raw = (await upstream.json()) as GeminiGenerateResponse
  } catch {
    const status = clientStatusFromGeminiUpstream(upstream.status)
    throw new GeminiCallError(status, parseErrorMessage(status))
  }

  if (!upstream.ok) {
    const status = clientStatusFromGeminiUpstream(upstream.status)
    throw new GeminiCallError(status, parseErrorMessage(status))
  }

  const text = joinResponseText(raw.candidates?.[0]?.content?.parts)
  if (!text) {
    throw new GeminiCallError(
      502,
      'Gemini가 빈 응답을 반환했습니다. 다시 시도해 주세요.',
    )
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new GeminiCallError(
      502,
      '표 구조를 JSON으로 읽지 못했습니다. 영역을 조정한 뒤 다시 시도해 주세요.',
    )
  }
}