import type { SessionPayload } from './session'
import {
  EXTRACT_GENERATION_CONFIG,
  EXTRACT_MODEL,
  GROUP_GENERATION_CONFIG,
  GROUP_MODEL,
  GROUP_SYSTEM_INSTRUCTION,
  TABLE_EXTRACT_SYSTEM_INSTRUCTION,
} from './gemini-config'
import { callGeminiJson, GeminiCallError } from './gemini-call'
import { workerUploadTooLargeMessage } from './extract-table-errors'
import { MAX_BOXES_PER_IMAGE, MAX_IMAGE_UPLOAD_BYTES, MAX_PROJECT_IMAGES } from './limits'
import {
  applyRegroupBatch,
  planRegroup,
  resolveGroupRefs,
} from './project-regroup'
import {
  computeSheetExtractSignature,
  type SignatureTable,
} from './project-signature'
import {
  deleteEmptySheets,
  deleteR2ProjectPrefix,
  getOwnedProject,
  imageR2Key,
  loadProjectDetail,
  rowsFromExtractCells,
  rowsToJsonStorage,
  touchProject,
  type ImageRow,
  type TableRow,
} from './project-db'
import type {
  CropInput,
  GroupGeminiResponse,
  ProjectDetail,
  TableExtractJson,
} from './project-types'
import {
  isClientId,
  parseBox,
  parseCropsBody,
  parseProjectName,
} from './project-validate'

function hasImageSignature(head: Uint8Array, mime: string): boolean {
  const startsWith = (sig: number[], offset = 0) =>
    sig.every((byte, i) => head[offset + i] === byte)
  if (mime === 'image/jpeg') return startsWith([0xff, 0xd8, 0xff])
  if (mime === 'image/png') return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (mime === 'image/webp')
    return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)
  return false
}

const ALLOWED_UPLOAD_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
])

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}

function jsonDetail(detail: ProjectDetail, status = 200): Response {
  return Response.json(detail, { status })
}

function notFoundProject(): Response {
  return jsonError(404, '프로젝트를 찾을 수 없습니다.')
}

async function requireOwnedProject(
  env: Env,
  projectId: string,
  owner: string,
): Promise<boolean> {
  const row = await getOwnedProject(env.DB, projectId, owner)
  return row != null
}

type RouteParts = {
  projectId: string | null
  rest: string[]
}

function parseProjectPath(pathname: string): RouteParts {
  const base = '/api/projects'
  if (!pathname.startsWith(base)) return { projectId: null, rest: [] }
  const tail = pathname.slice(base.length).replace(/^\//, '')
  if (!tail) return { projectId: null, rest: [] }
  const segments = tail.split('/').filter(Boolean)
  return { projectId: segments[0] ?? null, rest: segments.slice(1) }
}

export async function handleProjects(
  request: Request,
  env: Env,
  session: SessionPayload,
): Promise<Response> {
  const url = new URL(request.url)
  const { projectId, rest } = parseProjectPath(url.pathname)
  const owner = session.sub

  try {
    if (!projectId) {
      if (request.method === 'GET') return handleListProjects(env, owner)
      if (request.method === 'POST') return handleCreateProject(request, env, owner)
      return jsonError(405, '허용되지 않는 메서드입니다.')
    }

    if (rest.length === 0) {
      if (request.method === 'GET') return handleGetProject(env, projectId, owner)
      if (request.method === 'PATCH') return handlePatchProject(request, env, projectId, owner)
      if (request.method === 'DELETE') return handleDeleteProject(env, projectId, owner)
      return jsonError(405, '허용되지 않는 메서드입니다.')
    }

    if (rest[0] === 'images') {
      return handleImageRoutes(request, env, owner, projectId, rest.slice(1))
    }
    if (rest[0] === 'group' && rest.length === 1 && request.method === 'POST') {
      return handleGroup(request, env, owner, projectId)
    }
    if (rest[0] === 'tables' && rest.length === 2 && request.method === 'PATCH') {
      return handlePatchTable(request, env, owner, projectId, rest[1]!)
    }
    if (rest[0] === 'sheets' && rest.length === 2) {
      if (request.method === 'PATCH') {
        return handlePatchSheet(request, env, owner, projectId, rest[1]!)
      }
    }
    if (rest[0] === 'sheets' && rest.length === 3 && rest[2] === 'extract') {
      if (request.method === 'POST') {
        return handleExtractSheet(request, env, owner, projectId, rest[1]!)
      }
    }

    return jsonError(404, '요청한 경로를 찾을 수 없습니다.')
  } catch (err) {
    if (err instanceof GeminiCallError) {
      return jsonError(err.status, err.message)
    }
    throw err
  }
}

async function handleListProjects(env: Env, owner: string): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT p.id, p.name, p.created_at, p.updated_at,
            (SELECT COUNT(*) FROM images i WHERE i.project_id = p.id) AS image_count
     FROM projects p
     WHERE p.owner = ?
     ORDER BY p.updated_at DESC`,
  )
    .bind(owner)
    .all<{
      id: string
      name: string
      created_at: number
      updated_at: number
      image_count: number
    }>()

  const projects = (rows.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    imageCount: r.image_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
  return Response.json({ projects })
}

async function handleCreateProject(
  request: Request,
  env: Env,
  owner: string,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, '요청 본문 형식이 올바르지 않습니다.')
  }
  const name = parseProjectName((body as { name?: unknown }).name)
  if (!name) return jsonError(400, '프로젝트 이름을 입력해 주세요.')

  const id = crypto.randomUUID()
  const now = Date.now()
  await env.DB.prepare(
    'INSERT INTO projects (id, owner, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, owner, name, now, now)
    .run()

  return Response.json({
    project: {
      id,
      name,
      imageCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  })
}

async function handleGetProject(
  env: Env,
  projectId: string,
  owner: string,
): Promise<Response> {
  const detail = await loadProjectDetail(env.DB, projectId, owner)
  if (!detail) return notFoundProject()
  return jsonDetail(detail)
}

async function handlePatchProject(
  request: Request,
  env: Env,
  projectId: string,
  owner: string,
): Promise<Response> {
  if (!(await requireOwnedProject(env, projectId, owner))) return notFoundProject()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, '요청 본문 형식이 올바르지 않습니다.')
  }
  const name = parseProjectName((body as { name?: unknown }).name)
  if (!name) return jsonError(400, '프로젝트 이름을 입력해 주세요.')

  const now = Date.now()
  await env.DB.prepare(
    'UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND owner = ?',
  )
    .bind(name, now, projectId, owner)
    .run()

  const detail = await loadProjectDetail(env.DB, projectId, owner)
  if (!detail) return notFoundProject()
  return Response.json({ project: detail.project })
}

async function handleDeleteProject(
  env: Env,
  projectId: string,
  owner: string,
): Promise<Response> {
  if (!(await requireOwnedProject(env, projectId, owner))) return notFoundProject()
  await deleteR2ProjectPrefix(env.IMAGES, projectId)
  await env.DB.prepare('DELETE FROM projects WHERE id = ? AND owner = ?')
    .bind(projectId, owner)
    .run()
  return Response.json({ ok: true })
}

async function handleImageRoutes(
  request: Request,
  env: Env,
  owner: string,
  projectId: string,
  rest: string[],
): Promise<Response> {
  if (!(await requireOwnedProject(env, projectId, owner))) return notFoundProject()

  if (rest.length === 0 && request.method === 'POST') {
    return handleUploadImage(request, env, owner, projectId)
  }

  const imageId = rest[0]
  if (!imageId) {
    return jsonError(404, '요청한 경로를 찾을 수 없습니다.')
  }

  if (rest.length === 1 && request.method === 'DELETE') {
    return handleDeleteImage(env, owner, projectId, imageId!)
  }

  if (rest.length === 2 && rest[1] === 'file' && request.method === 'GET') {
    return handleGetImageFile(env, owner, projectId, imageId!)
  }

  if (
    rest.length === 2 &&
    rest[1] === 'detection' &&
    request.method === 'PUT'
  ) {
    return handlePutDetection(request, env, owner, projectId, imageId!)
  }

  return jsonError(404, '요청한 경로를 찾을 수 없습니다.')
}

async function handleUploadImage(
  request: Request,
  env: Env,
  owner: string,
  projectId: string,
): Promise<Response> {
  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS c FROM images WHERE project_id = ?',
  )
    .bind(projectId)
    .first<{ c: number }>()
  if ((countRow?.c ?? 0) >= MAX_PROJECT_IMAGES) {
    return jsonError(409, '프로젝트당 이미지는 최대 30장까지 업로드할 수 있습니다.')
  }

  const mime = request.headers.get('Content-Type')?.split(';')[0]?.trim() ?? ''
  if (!ALLOWED_UPLOAD_MIME.has(mime)) {
    return jsonError(400, '지원하지 않는 이미지 형식입니다. (PNG, JPEG, WebP)')
  }

  const body = await request.arrayBuffer()
  if (body.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    return jsonError(413, workerUploadTooLargeMessage())
  }
  if (body.byteLength === 0) {
    return jsonError(400, '빈 파일은 업로드할 수 없습니다.')
  }
  if (!hasImageSignature(new Uint8Array(body, 0, Math.min(12, body.byteLength)), mime)) {
    return jsonError(400, '이미지 파일 내용이 선언된 형식과 맞지 않습니다.')
  }

  const rawName = request.headers.get('X-File-Name')
  let name = 'image'
  if (rawName) {
    try {
      name = decodeURIComponent(rawName).trim() || 'image'
    } catch {
      name = rawName.trim() || 'image'
    }
  }
  name = name.slice(0, 255)

  const imageId = crypto.randomUUID()
  const r2Key = imageR2Key(projectId, imageId)

  const posRow = await env.DB.prepare(
    'SELECT COALESCE(MAX(position), -1) AS m FROM images WHERE project_id = ?',
  )
    .bind(projectId)
    .first<{ m: number }>()
  const position = (posRow?.m ?? -1) + 1

  await env.IMAGES.put(r2Key, body, {
    httpMetadata: { contentType: mime },
  })

  try {
    await env.DB.prepare(
      `INSERT INTO images (id, project_id, r2_key, name, mime, size, position,
       detection_threshold, empty_hint, selected_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
    )
      .bind(imageId, projectId, r2Key, name, mime, body.byteLength, position)
      .run()
    await touchProject(env.DB, projectId, owner)
  } catch (err) {
    console.error('image insert failed', err)
    await env.IMAGES.delete(r2Key)
    return jsonError(500, '이미지 메타데이터 저장에 실패했습니다.')
  }

  return Response.json({
    image: {
      id: imageId,
      name,
      mime,
      size: body.byteLength,
      position,
      detection: null,
    },
  })
}

async function handleGetImageFile(
  env: Env,
  owner: string,
  projectId: string,
  imageId: string,
): Promise<Response> {
  const img = await env.DB.prepare(
    `SELECT i.* FROM images i
     INNER JOIN projects p ON p.id = i.project_id
     WHERE i.id = ? AND i.project_id = ? AND p.owner = ?`,
  )
    .bind(imageId, projectId, owner)
    .first<ImageRow>()
  if (!img) return jsonError(404, '이미지를 찾을 수 없습니다.')

  const obj = await env.IMAGES.get(img.r2_key)
  if (!obj) return jsonError(404, '이미지 파일을 찾을 수 없습니다.')

  const headers = new Headers()
  headers.set('Content-Type', img.mime)
  headers.set('Cache-Control', 'private, max-age=3600')
  return new Response(obj.body, { headers })
}

async function handleDeleteImage(
  env: Env,
  owner: string,
  projectId: string,
  imageId: string,
): Promise<Response> {
  const img = await env.DB.prepare(
    `SELECT i.r2_key FROM images i
     INNER JOIN projects p ON p.id = i.project_id
     WHERE i.id = ? AND i.project_id = ? AND p.owner = ?`,
  )
    .bind(imageId, projectId, owner)
    .first<{ r2_key: string }>()
  if (!img) return notFoundProject()

  await env.IMAGES.delete(img.r2_key)
  await env.DB.prepare('DELETE FROM images WHERE id = ? AND project_id = ?')
    .bind(imageId, projectId)
    .run()
  await deleteEmptySheets(env.DB, projectId)
  await touchProject(env.DB, projectId, owner)

  const detail = await loadProjectDetail(env.DB, projectId, owner)
  if (!detail) return notFoundProject()
  return jsonDetail(detail)
}

type DetectionBody = {
  threshold?: unknown
  emptyHint?: unknown
  selectedId?: unknown
  boxes?: unknown
}

async function handlePutDetection(
  request: Request,
  env: Env,
  owner: string,
  projectId: string,
  imageId: string,
): Promise<Response> {
  const img = await env.DB.prepare(
    `SELECT i.id FROM images i
     INNER JOIN projects p ON p.id = i.project_id
     WHERE i.id = ? AND i.project_id = ? AND p.owner = ?`,
  )
    .bind(imageId, projectId, owner)
    .first<{ id: string }>()
  if (!img) return notFoundProject()

  let body: DetectionBody
  try {
    body = (await request.json()) as DetectionBody
  } catch {
    return jsonError(400, '요청 본문 형식이 올바르지 않습니다.')
  }

  const threshold =
    typeof body.threshold === 'number' && Number.isFinite(body.threshold)
      ? body.threshold
      : null
  if (threshold == null) {
    return jsonError(400, '검출 설정(threshold)이 올바르지 않습니다.')
  }
  if (typeof body.emptyHint !== 'boolean') {
    return jsonError(400, '검출 설정(emptyHint)이 올바르지 않습니다.')
  }
  const emptyHint = body.emptyHint ? 1 : 0

  const boxesRaw = body.boxes
  if (!Array.isArray(boxesRaw)) {
    return jsonError(400, '표 목록(boxes)이 올바르지 않습니다.')
  }
  if (boxesRaw.length > MAX_BOXES_PER_IMAGE) {
    return jsonError(400, `이미지당 표는 최대 ${MAX_BOXES_PER_IMAGE}개까지 저장할 수 있습니다.`)
  }

  const boxes = boxesRaw.map(parseBox)
  if (boxes.some((b) => b == null)) {
    return jsonError(400, '표 좌표 형식이 올바르지 않습니다.')
  }
  const validBoxes = boxes as NonNullable<(typeof boxes)[number]>[]

  let selectedId: string | null = null
  if (body.selectedId != null) {
    if (typeof body.selectedId !== 'string' || !isClientId(body.selectedId)) {
      return jsonError(400, '선택된 표 id가 올바르지 않습니다.')
    }
    if (!validBoxes.some((b) => b.id === body.selectedId)) {
      return jsonError(400, '선택된 표 id가 목록에 없습니다.')
    }
    selectedId = body.selectedId
  }

  const existing = await env.DB.prepare(
    'SELECT id, sheet_id, sheet_manual FROM tables WHERE image_id = ? AND project_id = ?',
  )
    .bind(imageId, projectId)
    .all<{ id: string; sheet_id: string | null; sheet_manual: number }>()

  const existingMap = new Map(
    (existing.results ?? []).map((r) => [r.id, r]),
  )
  const keepIds = new Set(validBoxes.map((b) => b.id))

  const stmts: D1PreparedStatement[] = []
  validBoxes.forEach((box, index) => {
    const prev = existingMap.get(box.id)
    if (prev) {
      stmts.push(
        env.DB.prepare(
          `UPDATE tables SET title = ?, label = ?, score = ?, xmin = ?, ymin = ?, xmax = ?, ymax = ?, position = ?
           WHERE id = ? AND project_id = ? AND image_id = ?`,
        ).bind(
          box.title,
          box.label,
          box.score,
          box.box.xmin,
          box.box.ymin,
          box.box.xmax,
          box.box.ymax,
          index,
          box.id,
          projectId,
          imageId,
        ),
      )
    } else {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO tables (id, project_id, image_id, sheet_id, title, label, score, xmin, ymin, xmax, ymax, position, sheet_manual)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        ).bind(
          box.id,
          projectId,
          imageId,
          box.title,
          box.label,
          box.score,
          box.box.xmin,
          box.box.ymin,
          box.box.xmax,
          box.box.ymax,
          index,
        ),
      )
    }
  })

  for (const row of existing.results ?? []) {
    if (!keepIds.has(row.id)) {
      stmts.push(
        env.DB.prepare(
          'DELETE FROM tables WHERE id = ? AND project_id = ? AND image_id = ?',
        ).bind(row.id, projectId, imageId),
      )
    }
  }

  const now = Date.now()
  stmts.push(
    env.DB.prepare(
      `UPDATE images SET detection_threshold = ?, empty_hint = ?, selected_id = ?
       WHERE id = ? AND project_id = ?`,
    ).bind(threshold, emptyHint, selectedId, imageId, projectId),
  )
  stmts.push(
    env.DB.prepare('UPDATE projects SET updated_at = ? WHERE id = ? AND owner = ?').bind(
      now,
      projectId,
      owner,
    ),
  )

  await env.DB.batch(stmts)
  await deleteEmptySheets(env.DB, projectId)

  const detail = await loadProjectDetail(env.DB, projectId, owner)
  if (!detail) return notFoundProject()
  return jsonDetail(detail)
}

function orderedProjectTables(
  tables: TableRow[],
  imagePositions: Map<string, number>,
): TableRow[] {
  return [...tables].sort(
    (a, b) =>
      (imagePositions.get(a.image_id) ?? 0) - (imagePositions.get(b.image_id) ?? 0) ||
      a.position - b.position ||
      a.id.localeCompare(b.id),
  )
}

function cropSetEquals(crops: CropInput[], expectedIds: string[]): boolean {
  if (crops.length !== expectedIds.length) return false
  const got = new Set(crops.map((c) => c.tableId))
  for (const id of expectedIds) {
    if (!got.has(id)) return false
  }
  return true
}

function cropsInOrder(
  crops: CropInput[],
  orderedIds: string[],
): CropInput[] | null {
  const byId = new Map(crops.map((c) => [c.tableId, c]))
  const out: CropInput[] = []
  for (const id of orderedIds) {
    const c = byId.get(id)
    if (!c) return null
    out.push(c)
  }
  return out
}

async function loadTablesAndImages(
  env: Env,
  projectId: string,
  owner: string,
): Promise<{
  tables: TableRow[]
  images: ImageRow[]
  imagePositions: Map<string, number>
} | null> {
  if (!(await requireOwnedProject(env, projectId, owner))) return null
  const images = await env.DB.prepare(
  `SELECT i.* FROM images i
   INNER JOIN projects p ON p.id = i.project_id
   WHERE i.project_id = ? AND p.owner = ?
   ORDER BY i.position ASC`,
  )
    .bind(projectId, owner)
    .all<ImageRow>()
  const tables = await env.DB.prepare(
    'SELECT * FROM tables WHERE project_id = ?',
  )
    .bind(projectId)
    .all<TableRow>()
  const imagePositions = new Map<string, number>()
  for (const img of images.results ?? []) {
    imagePositions.set(img.id, img.position)
  }
  return {
    tables: tables.results ?? [],
    images: images.results ?? [],
    imagePositions,
  }
}

async function handleGroup(
  request: Request,
  env: Env,
  owner: string,
  projectId: string,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, '요청 본문 형식이 올바르지 않습니다.')
  }
  const crops = parseCropsBody(body)
  if (!crops) return jsonError(400, '크롭 목록 형식이 올바르지 않습니다.')

  const loaded = await loadTablesAndImages(env, projectId, owner)
  if (!loaded) return notFoundProject()

  const { tables, images, imagePositions } = loaded
  const ordered = orderedProjectTables(tables, imagePositions)
  const allIds = ordered.map((t) => t.id)
  if (!cropSetEquals(crops, allIds)) {
    return jsonError(400, '프로젝트의 모든 표에 대한 크롭이 필요합니다.')
  }

  const imageNameById = new Map(images.map((i) => [i.id, i.name]))
  const tableIdByRef = new Map<string, string>()
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = []

  ordered.forEach((table, idx) => {
    const ref = `T${idx + 1}`
    tableIdByRef.set(ref, table.id)
    const fileName = imageNameById.get(table.image_id) ?? 'image'
    parts.push({ text: `Table ${ref} (image: ${fileName})` })
    const crop = crops.find((c) => c.tableId === table.id)!
    parts.push({
      inlineData: { mimeType: crop.mimeType, data: crop.data },
    })
  })

  const geminiBody = {
    systemInstruction: {
      parts: [{ text: GROUP_SYSTEM_INSTRUCTION }],
    },
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

  const parsed = await callGeminiJson<GroupGeminiResponse>(
    env,
    GROUP_MODEL,
    geminiBody,
  )

  if (!parsed.groups || !Array.isArray(parsed.groups)) {
    return jsonError(502, '그룹핑 결과 형식이 올바르지 않습니다.')
  }

  const resolved = resolveGroupRefs(parsed.groups, tableIdByRef, allIds)

  const sheetRows = await env.DB.prepare(
    'SELECT id, name, position FROM sheets WHERE project_id = ?',
  )
    .bind(projectId)
    .all<{ id: string; name: string; position: number }>()

  const plan = planRegroup(
    projectId,
    sheetRows.results ?? [],
    tables,
    resolved,
  )
  const now = Date.now()
  await applyRegroupBatch(env.DB, projectId, plan, now)

  const detail = await loadProjectDetail(env.DB, projectId, owner)
  if (!detail) return notFoundProject()
  return jsonDetail(detail)
}

async function handlePatchTable(
  request: Request,
  env: Env,
  owner: string,
  projectId: string,
  tableId: string,
): Promise<Response> {
  if (!isClientId(tableId)) return jsonError(400, '표 id가 올바르지 않습니다.')
  if (!(await requireOwnedProject(env, projectId, owner))) return notFoundProject()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, '요청 본문 형식이 올바르지 않습니다.')
  }
  const o = body as { sheetId?: unknown; newSheetName?: unknown }
  const hasSheetId = typeof o.sheetId === 'string'
  const hasNewName = typeof o.newSheetName === 'string'
  if (hasSheetId === hasNewName) {
    return jsonError(400, 'sheetId 또는 newSheetName 중 하나만 지정해 주세요.')
  }

  const table = await env.DB.prepare(
    'SELECT id, sheet_id FROM tables WHERE id = ? AND project_id = ?',
  )
    .bind(tableId, projectId)
    .first<{ id: string; sheet_id: string | null }>()
  if (!table) return jsonError(404, '표를 찾을 수 없습니다.')

  const sourceSheetId = table.sheet_id
  let targetSheetId: string

  if (hasSheetId) {
    if (!isClientId(o.sheetId as string)) {
      return jsonError(400, '시트 id가 올바르지 않습니다.')
    }
    const sheet = await env.DB.prepare(
      'SELECT id FROM sheets WHERE id = ? AND project_id = ?',
    )
      .bind(o.sheetId, projectId)
      .first<{ id: string }>()
    if (!sheet) return jsonError(404, '시트를 찾을 수 없습니다.')
    targetSheetId = sheet.id
  } else {
    const name = (o.newSheetName as string).trim().slice(0, 120)
    if (!name) return jsonError(400, '시트 이름을 입력해 주세요.')
    targetSheetId = crypto.randomUUID()
    const posRow = await env.DB.prepare(
      'SELECT COALESCE(MAX(position), -1) AS m FROM sheets WHERE project_id = ?',
    )
      .bind(projectId)
      .first<{ m: number }>()
    const position = (posRow?.m ?? -1) + 1
    await env.DB.prepare(
      'INSERT INTO sheets (id, project_id, name, position, rows_json, extract_signature) VALUES (?, ?, ?, ?, NULL, NULL)',
    )
      .bind(targetSheetId, projectId, name, position)
      .run()
  }

  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE tables SET sheet_id = ?, sheet_manual = 1 WHERE id = ? AND project_id = ?',
    ).bind(targetSheetId, tableId, projectId),
    env.DB.prepare('UPDATE projects SET updated_at = ? WHERE id = ? AND owner = ?').bind(
      now,
      projectId,
      owner,
    ),
  ])

  if (sourceSheetId && sourceSheetId !== targetSheetId) {
    const remaining = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM tables WHERE sheet_id = ?',
    )
      .bind(sourceSheetId)
      .first<{ c: number }>()
    if ((remaining?.c ?? 0) === 0) {
      await env.DB.prepare('DELETE FROM sheets WHERE id = ? AND project_id = ?')
        .bind(sourceSheetId, projectId)
        .run()
    }
  }

  const detail = await loadProjectDetail(env.DB, projectId, owner)
  if (!detail) return notFoundProject()
  return jsonDetail(detail)
}

async function handlePatchSheet(
  request: Request,
  env: Env,
  owner: string,
  projectId: string,
  sheetId: string,
): Promise<Response> {
  if (!(await requireOwnedProject(env, projectId, owner))) return notFoundProject()

  const sheet = await env.DB.prepare(
    'SELECT id FROM sheets WHERE id = ? AND project_id = ?',
  )
    .bind(sheetId, projectId)
    .first<{ id: string }>()
  if (!sheet) return jsonError(404, '시트를 찾을 수 없습니다.')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, '요청 본문 형식이 올바르지 않습니다.')
  }
  const o = body as { name?: unknown; rows?: unknown }

  const sets: string[] = []
  const binds: unknown[] = []

  if (o.name !== undefined) {
    if (typeof o.name !== 'string' || !o.name.trim()) {
      return jsonError(400, '시트 이름이 올바르지 않습니다.')
    }
    sets.push('name = ?')
    binds.push(o.name.trim().slice(0, 120))
  }

  if (o.rows !== undefined) {
    if (!Array.isArray(o.rows)) {
      return jsonError(400, '행 데이터(rows) 형식이 올바르지 않습니다.')
    }
    const rows: string[][] = []
    for (const row of o.rows) {
      if (!Array.isArray(row)) {
        return jsonError(400, '행 데이터(rows) 형식이 올바르지 않습니다.')
      }
      rows.push(row.map((c) => (typeof c === 'string' ? c : String(c ?? ''))))
    }
    sets.push('rows_json = ?')
    binds.push(rowsToJsonStorage(rows))
  }

  if (sets.length === 0) {
    return jsonError(400, '변경할 항목(name 또는 rows)이 없습니다.')
  }

  binds.push(sheetId, projectId)
  await env.DB.prepare(
    `UPDATE sheets SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
  )
    .bind(...binds)
    .run()

  const now = Date.now()

  await env.DB.prepare(
    'UPDATE projects SET updated_at = ? WHERE id = ? AND owner = ?',
  )
    .bind(now, projectId, owner)
    .run()

  const detail = await loadProjectDetail(env.DB, projectId, owner)
  if (!detail) return notFoundProject()
  return jsonDetail(detail)
}

async function handleExtractSheet(
  request: Request,
  env: Env,
  owner: string,
  projectId: string,
  sheetId: string,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, '요청 본문 형식이 올바르지 않습니다.')
  }
  const crops = parseCropsBody(body)
  if (!crops) return jsonError(400, '크롭 목록 형식이 올바르지 않습니다.')

  const loaded = await loadTablesAndImages(env, projectId, owner)
  if (!loaded) return notFoundProject()

  const sheet = await env.DB.prepare(
    'SELECT id, name FROM sheets WHERE id = ? AND project_id = ?',
  )
    .bind(sheetId, projectId)
    .first<{ id: string; name: string }>()
  if (!sheet) return jsonError(404, '시트를 찾을 수 없습니다.')

  const members = loaded.tables.filter((t) => t.sheet_id === sheetId)
  const ordered = orderedProjectTables(members, loaded.imagePositions)
  const orderedIds = ordered.map((t) => t.id)

  if (!cropSetEquals(crops, orderedIds)) {
    return jsonError(400, '이 시트의 모든 표에 대한 크롭이 필요합니다.')
  }
  const orderedCrops = cropsInOrder(crops, orderedIds)
  if (!orderedCrops) {
    return jsonError(400, '크롭 목록이 표 순서와 일치하지 않습니다.')
  }

  const imageNameById = new Map(loaded.images.map((i) => [i.id, i.name]))
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = []

  ordered.forEach((table, idx) => {
    const fileName = imageNameById.get(table.image_id) ?? 'image'
    parts.push({
      text: `Image ${idx + 1} (file: ${fileName}, table ${table.title || table.id})`,
    })
    const crop = orderedCrops[idx]!
    parts.push({
      inlineData: { mimeType: crop.mimeType, data: crop.data },
    })
  })

  const userText = `Extract and merge into one table for sheet name: ${sheet.name}. Images are in order from 1 to ${ordered.length}.`

  const geminiBody = {
    systemInstruction: {
      parts: [{ text: TABLE_EXTRACT_SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userText }, ...parts],
      },
    ],
    generationConfig: EXTRACT_GENERATION_CONFIG,
  }

  const parsed = await callGeminiJson<TableExtractJson>(
    env,
    EXTRACT_MODEL,
    geminiBody,
  )

  if (!parsed.name || !Array.isArray(parsed.rows)) {
    return jsonError(502, '표 데이터가 불완전합니다. 영역을 다시 확인해 주세요.')
  }

  const rows = rowsFromExtractCells(parsed.rows)
  const sigTables: SignatureTable[] = ordered.map((t) => ({
    id: t.id,
    xmin: t.xmin,
    ymin: t.ymin,
    xmax: t.xmax,
    ymax: t.ymax,
    imagePosition: loaded.imagePositions.get(t.image_id) ?? 0,
    position: t.position,
  }))
  const signature = computeSheetExtractSignature(sigTables)
  const now = Date.now()

  await env.DB.batch([
    env.DB.prepare(
      'UPDATE sheets SET rows_json = ?, extract_signature = ? WHERE id = ? AND project_id = ?',
    ).bind(rowsToJsonStorage(rows), signature, sheetId, projectId),
    env.DB.prepare('UPDATE projects SET updated_at = ? WHERE id = ? AND owner = ?').bind(
      now,
      projectId,
      owner,
    ),
  ])

  const detail = await loadProjectDetail(env.DB, projectId, owner)
  if (!detail) return notFoundProject()
  return jsonDetail(detail)
}