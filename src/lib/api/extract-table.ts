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
  const res = await fetch('/api/extract-table', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ imageBase64, mimeType, sheetName }),
  })

  const body = (await res.json()) as GeminiTableSheet & ApiErrorBody
  if (!res.ok) {
    throw new Error(body.error ?? `API error (${res.status})`)
  }
  if (!body.name || !Array.isArray(body.rows)) {
    throw new Error('Invalid table response from API')
  }
  return { name: body.name, rows: body.rows }
}