import {
  computeSheetExtractSignature,
  orderTablesForSignature,
  sheetIsStale,
  type SignatureTable,
} from './project-signature'
import type {
  ImageJson,
  ProjectDetail,
  ProjectSummary,
  SheetJson,
  TableJson,
} from './project-types'

export type ProjectRow = {
  id: string
  owner: string
  name: string
  created_at: number
  updated_at: number
}

export type ImageRow = {
  id: string
  project_id: string
  r2_key: string
  name: string
  mime: string
  size: number
  position: number
  detection_threshold: number | null
  empty_hint: number | null
  selected_id: string | null
}

export type TableRow = {
  id: string
  project_id: string
  image_id: string
  sheet_id: string | null
  title: string
  label: string
  score: number
  xmin: number
  ymin: number
  xmax: number
  ymax: number
  position: number
  sheet_manual: number
}

export type SheetRow = {
  id: string
  project_id: string
  name: string
  position: number
  rows_json: string | null
  extract_signature: string | null
}

function imageRowToJson(row: ImageRow): ImageJson {
  const hasDetection =
    row.detection_threshold != null ||
    row.empty_hint != null ||
    row.selected_id != null
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: row.size,
    position: row.position,
    detection: hasDetection
      ? {
          threshold: row.detection_threshold ?? 0,
          emptyHint: (row.empty_hint ?? 0) !== 0,
          selectedId: row.selected_id,
        }
      : null,
  }
}

function tableRowToJson(row: TableRow): TableJson {
  return {
    id: row.id,
    title: row.title,
    label: row.label,
    score: row.score,
    box: {
      xmin: row.xmin,
      ymin: row.ymin,
      xmax: row.xmax,
      ymax: row.ymax,
    },
    imageId: row.image_id,
    position: row.position,
    sheetId: row.sheet_id,
    sheetManual: row.sheet_manual !== 0,
  }
}

function parseRowsJson(rowsJson: string | null): string[][] | null {
  if (!rowsJson) return null
  try {
    const parsed = JSON.parse(rowsJson) as unknown
    if (!Array.isArray(parsed)) return null
    const rows: string[][] = []
    for (const row of parsed) {
      if (!Array.isArray(row)) return null
      rows.push(row.map((c) => (typeof c === 'string' ? c : String(c ?? ''))))
    }
    return rows
  } catch {
    return null
  }
}

export function rowsFromExtractCells(
  rows: Array<{ cells: string[] }>,
): string[][] {
  return rows.map((r) => r.cells.map((c) => (typeof c === 'string' ? c : '')))
}

export function rowsToJsonStorage(rows: string[][]): string {
  return JSON.stringify(rows)
}

export async function deleteEmptySheets(
  db: D1Database,
  projectId: string,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM sheets WHERE project_id = ?
       AND id NOT IN (
         SELECT sheet_id FROM tables WHERE project_id = ? AND sheet_id IS NOT NULL
       )`,
    )
    .bind(projectId, projectId)
    .run()
}

export async function touchProject(
  db: D1Database,
  projectId: string,
  owner: string,
): Promise<boolean> {
  const now = Date.now()
  const result = await db
    .prepare(
      'UPDATE projects SET updated_at = ? WHERE id = ? AND owner = ?',
    )
    .bind(now, projectId, owner)
    .run()
  return (result.meta.changes ?? 0) > 0
}

export async function getOwnedProject(
  db: D1Database,
  projectId: string,
  owner: string,
): Promise<ProjectRow | null> {
  return db
    .prepare(
      'SELECT id, owner, name, created_at, updated_at FROM projects WHERE id = ? AND owner = ?',
    )
    .bind(projectId, owner)
    .first<ProjectRow>()
}

export async function loadProjectDetail(
  db: D1Database,
  projectId: string,
  owner: string,
): Promise<ProjectDetail | null> {
  const project = await getOwnedProject(db, projectId, owner)
  if (!project) return null

  const imageCountRow = await db
    .prepare('SELECT COUNT(*) AS c FROM images WHERE project_id = ?')
    .bind(projectId)
    .first<{ c: number }>()

  const summary: ProjectSummary = {
    id: project.id,
    name: project.name,
    imageCount: imageCountRow?.c ?? 0,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  }

  const imageRows = await db
    .prepare(
      'SELECT * FROM images WHERE project_id = ? ORDER BY position ASC, id ASC',
    )
    .bind(projectId)
    .all<ImageRow>()

  const tableRows = await db
    .prepare(
      'SELECT * FROM tables WHERE project_id = ? ORDER BY image_id, position ASC, id ASC',
    )
    .bind(projectId)
    .all<TableRow>()

  const sheetRows = await db
    .prepare(
      'SELECT * FROM sheets WHERE project_id = ? ORDER BY position ASC, id ASC',
    )
    .bind(projectId)
    .all<SheetRow>()

  const images = (imageRows.results ?? []).map(imageRowToJson)
  const tables = (tableRows.results ?? []).map(tableRowToJson)
  const imagePosition = new Map<string, number>()
  for (const img of images) imagePosition.set(img.id, img.position)

  const tablesBySheet = new Map<string, TableRow[]>()
  for (const t of tableRows.results ?? []) {
    if (!t.sheet_id) continue
    const list = tablesBySheet.get(t.sheet_id) ?? []
    list.push(t)
    tablesBySheet.set(t.sheet_id, list)
  }

  const sheets: SheetJson[] = (sheetRows.results ?? []).map((s) => {
    const members = tablesBySheet.get(s.id) ?? []
    const sigTables: SignatureTable[] = members.map((t) => ({
      id: t.id,
      xmin: t.xmin,
      ymin: t.ymin,
      xmax: t.xmax,
      ymax: t.ymax,
      imagePosition: imagePosition.get(t.image_id) ?? 0,
      position: t.position,
    }))
    const ordered = orderTablesForSignature(sigTables)
    const currentSig = computeSheetExtractSignature(sigTables)
    const tableIds = ordered.map((t) => t.id)
    return {
      id: s.id,
      name: s.name,
      position: s.position,
      tableIds,
      rows: parseRowsJson(s.rows_json),
      stale: sheetIsStale(s.rows_json, s.extract_signature, currentSig),
    }
  })

  return { project: summary, images, tables, sheets }
}

export async function deleteR2ProjectPrefix(
  bucket: R2Bucket,
  projectId: string,
): Promise<void> {
  const prefix = `projects/${projectId}/`
  let cursor: string | undefined
  for (;;) {
    const listed = await bucket.list({ prefix, cursor })
    if (listed.objects.length > 0) {
      await Promise.all(listed.objects.map((o) => bucket.delete(o.key)))
    }
    if (!listed.truncated) break
    cursor = listed.cursor
  }
}

export function imageR2Key(projectId: string, imageId: string): string {
  return `projects/${projectId}/${imageId}`
}