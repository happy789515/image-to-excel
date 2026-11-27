import {
  EXTRACT_GENERATION_CONFIG,
  EXTRACT_MODEL,
  GROUP_GENERATION_CONFIG,
  GROUP_MODEL,
  GROUP_SYSTEM_INSTRUCTION,
  TABLE_EXTRACT_SYSTEM_INSTRUCTION,
} from './gemini-config'
import { callGeminiJson, GeminiCallError, type GeminiGenerateContentBody } from './gemini-call'
import { MAX_GEMINI_ITEMS } from './limits'
import type {
  GroupGeminiResponse,
  TableExtractJson,
  TableRowJson,
} from '../src/lib/project/types'

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

type ImagePart = {
  imageName: string
  mimeType: ImageMime
  data: string
}

type ExtractItem = ImagePart & { tableTitle: string }
type GroupItem = ImagePart & { ref: string }

type GeminiPart = GeminiGenerateContentBody['contents'][number]['parts'][number]

const ALLOWED_MIME = new Set<string>(['image/jpeg', 'image/png', 'image/webp'])
const REF_RE = /^T\d{1,4}$/

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}

function parseImagePart(o: Record<string, unknown>): ImagePart | null {
  const mimeType = o.mimeType
  if (typeof mimeType !== 'string' || !ALLOWED_MIME.has(mimeType)) return null
  if (typeof o.data !== 'string') return null
  const data = o.data.trim().replace(/^data:[^;]+;base64,/, '')
  if (!data) return null
  const imageName =
    typeof o.imageName === 'string' && o.imageName.trim()
      ? o.imageName.trim().slice(0, 255)
      : 'image'
  return { imageName, mimeType: mimeType as ImageMime, data }
}

function parseItems<T>(
  raw: unknown,
  parse: (o: Record<string, unknown>) => T | null,
): T[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_GEMINI_ITEMS) return null
  const out: T[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const item = parse(entry as Record<string, unknown>)
    if (!item) return null
    out.push(item)
  }
  return out
}

function parseExtractBody(body: unknown): { sheetName: string; items: ExtractItem[] } | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  const sheetName = typeof o.sheetName === 'string' ? o.sheetName.trim().slice(0, 120) : ''
  if (!sheetName) return null
  const items = parseItems(o.items, (item) => {
    const part = parseImagePart(item)
    if (!part) return null
    const tableTitle = typeof item.tableTitle === 'string' ? item.tableTitle.slice(0, 200) : ''
    return { ...part, tableTitle }
  })
  if (!items) return null
  return { sheetName, items }
}

function parseGroupBody(body: unknown): GroupItem[] | null {
  if (!body || typeof body !== 'object') return null
  const items = parseItems((body as Record<string, unknown>).items, (item) => {
    const part = parseImagePart(item)
    if (!part) return null
    const ref = typeof item.ref === 'string' ? item.ref : ''
    if (!REF_RE.test(ref)) return null
    return { ...part, ref }
  })
  if (!items) return null
  if (new Set(items.map((i) => i.ref)).size !== items.length) return null
  return items
}

function rowsFromExtractCells(rows: TableRowJson[]): string[][] {
  return rows.map((r) =>
    (Array.isArray(r.cells) ? r.cells : []).map((c) => (typeof c === 'string' ? c : '')),
  )
}

async function handleExtractSheet(env: Env, body: unknown): Promise<Response> {
  const parsed = parseExtractBody(body)
  if (!parsed) return jsonError(400, '시트 추출 요청 형식이 올바르지 않습니다.')

  const parts: GeminiPart[] = []
  parsed.items.forEach((item, idx) => {
    parts.push({
      text: `Image ${idx + 1} (file: ${item.imageName}, table ${item.tableTitle || 'untitled'})`,
    })
    parts.push({ inlineData: { mimeType: item.mimeType, data: item.data } })
  })

  const geminiBody: GeminiGenerateContentBody = {
    systemInstruction: { parts: [{ text: TABLE_EXTRACT_SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Extract and merge into one table for sheet name: ${parsed.sheetName}. Images are in order from 1 to ${parsed.items.length}.`,
          },
          ...parts,
        ],
      },
    ],
    generationConfig: EXTRACT_GENERATION_CONFIG,
  }

  const result = await callGeminiJson<TableExtractJson>(env, EXTRACT_MODEL, geminiBody)
  if (!result.name || !Array.isArray(result.rows)) {
    return jsonError(502, '표 데이터가 불완전합니다. 영역을 다시 확인해 주세요.')
  }
  return Response.json({ rows: rowsFromExtractCells(result.rows) })
}

async function handleGroup(env: Env, body: unknown): Promise<Response> {
  const items = parseGroupBody(body)
  if (!items) return jsonError(400, '그룹핑 요청 형식이 올바르지 않습니다.')

  const parts: GeminiPart[] = []
  for (const item of items) {
    parts.push({ text: `Table ${item.ref} (image: ${item.imageName})` })
    parts.push({ inlineData: { mimeType: item.mimeType, data: item.data } })
  }

  const geminiBody: GeminiGenerateContentBody = {
    systemInstruction: { parts: [{ text: GROUP_SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Group these tables into spreadsheet sheets. Reply with tableRefs T1, T2, ... only.',
          },
          ...parts,
        ],
      },
    ],
    generationConfig: GROUP_GENERATION_CONFIG,
  }

  const result = await callGeminiJson<GroupGeminiResponse>(env, GROUP_MODEL, geminiBody)
  if (!result.groups || !Array.isArray(result.groups)) {
    return jsonError(502, '그룹핑 결과 형식이 올바르지 않습니다.')
  }
  return Response.json({ groups: result.groups })
}

export async function handleGemini(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonError(405, '허용되지 않는 메서드입니다.')
  if (pathname !== '/api/gemini/extract-sheet' && pathname !== '/api/gemini/group') {
    return jsonError(404, '요청한 경로를 찾을 수 없습니다.')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, '요청 본문 형식이 올바르지 않습니다.')
  }

  try {
    if (pathname === '/api/gemini/extract-sheet') return await handleExtractSheet(env, body)
    return await handleGroup(env, body)
  } catch (err) {
    if (err instanceof GeminiCallError) return jsonError(err.status, err.message)
    throw err
  }
}
