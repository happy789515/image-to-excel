import {
  extractTableErrorMessage,
  extractTableNetworkErrorMessage,
} from '@/lib/api/extract-table-errors'

export type GeminiTableRow = { cells: string[] }

export type GeminiTableSheet = {
  name: string
  rows: GeminiTableRow[]
}

type ApiErrorBody = {
  error?: string
}

export async function fetchApiHealth(signal?: AbortSignal): Promise<boolean> {
  const res = await fetch('/api/health', { signal })
  if (!res.ok) return false
  const body = (await res.json()) as { ok?: boolean }
  return body.ok === true
}

export async function extractTableViaApi(
  imageBase64: string,
  mimeType: string,
  sheetName: string,
  signal?: AbortSignal,
): Promise<GeminiTableSheet> {
  let res: Response
  try {
    res = await fetch('/api/extract-table', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ imageBase64, mimeType, sheetName }),
    })
  } catch (cause) {
    throw new Error(extractTableNetworkErrorMessage(cause), { cause })
  }

  let body: GeminiTableSheet & ApiErrorBody
  try {
    body = (await res.json()) as GeminiTableSheet & ApiErrorBody
  } catch {
    if (!res.ok) {
      throw new Error(extractTableErrorMessage(res.status))
    }
    throw new Error('서버 응답 형식이 올바르지 않습니다.')
  }

  if (!res.ok) {
    throw new Error(extractTableErrorMessage(res.status, body.error))
  }
  if (!body.name || !Array.isArray(body.rows)) {
    throw new Error('표 데이터 형식이 올바르지 않습니다. 다시 변환해 주세요.')
  }
  return { name: body.name, rows: body.rows }
}