import type { GroupGeminiResponse } from './project-types'
import type { TableRow } from './project-db'

export type ResolvedGroup = {
  sheetName: string
  tableIds: string[]
}

/** Map T1..Tn refs to table ids; ignore unknown; first-wins on duplicates; leftover → 기타. */
export function resolveGroupRefs(
  modelGroups: GroupGeminiResponse['groups'],
  tableIdByRef: Map<string, string>,
  allTableIds: string[],
): ResolvedGroup[] {
  const assigned = new Set<string>()
  const resolved: ResolvedGroup[] = []

  for (const g of modelGroups) {
    if (!g || typeof g.sheetName !== 'string') continue
    const name = g.sheetName.trim().slice(0, 120) || '시트'
    const ids: string[] = []
    const refs = Array.isArray(g.tableRefs) ? g.tableRefs : []
    for (const ref of refs) {
      if (typeof ref !== 'string') continue
      const tableId = tableIdByRef.get(ref.trim())
      if (!tableId || assigned.has(tableId)) continue
      assigned.add(tableId)
      ids.push(tableId)
    }
    if (ids.length > 0) {
      resolved.push({ sheetName: name, tableIds: ids })
    }
  }

  const missing = allTableIds.filter((id) => !assigned.has(id))
  if (missing.length > 0) {
    resolved.push({ sheetName: '기타', tableIds: missing })
  }

  return resolved
}

export type RegroupPlan = {
  deleteSheetIds: string[]
  newSheets: Array<{ id: string; name: string; position: number; tableIds: string[] }>
  assignTableIds: Map<string, string>
}

/**
 * Drop sheets with no manual tables, create sheets for groups, assign sheet_manual=0 only,
 * then drop empty sheets (handled after assign by deleting still-empty).
 */
export function planRegroup(
  _projectId: string,
  sheets: Array<{ id: string; name: string; position: number }>,
  tables: TableRow[],
  groups: ResolvedGroup[],
): RegroupPlan {
  const tablesBySheet = new Map<string, TableRow[]>()
  for (const t of tables) {
    if (!t.sheet_id) continue
    const list = tablesBySheet.get(t.sheet_id) ?? []
    list.push(t)
    tablesBySheet.set(t.sheet_id, list)
  }

  const deleteSheetIds: string[] = []

  for (const s of sheets) {
    const members = tablesBySheet.get(s.id) ?? []
    const hasManual = members.some((t) => t.sheet_manual !== 0)
    if (!hasManual) {
      deleteSheetIds.push(s.id)
    }
  }

  let nextPosition =
    sheets.reduce((max, s) => Math.max(max, s.position), -1) + 1

  const newSheets: RegroupPlan['newSheets'] = []
  const assignTableIds = new Map<string, string>()

  for (const g of groups) {
    const assignable = g.tableIds.filter((tid) => {
      const row = tables.find((t) => t.id === tid)
      return row && row.sheet_manual === 0
    })
    if (assignable.length === 0) continue

    const sheetId = crypto.randomUUID()
    newSheets.push({
      id: sheetId,
      name: g.sheetName,
      position: nextPosition++,
      tableIds: assignable,
    })
    for (const tid of assignable) {
      assignTableIds.set(tid, sheetId)
    }
  }

  return { deleteSheetIds, newSheets, assignTableIds }
}

export async function applyRegroupBatch(
  db: D1Database,
  projectId: string,
  plan: RegroupPlan,
  now: number,
): Promise<void> {
  const stmts: D1PreparedStatement[] = []

  for (const sid of plan.deleteSheetIds) {
    stmts.push(
      db.prepare('DELETE FROM sheets WHERE id = ? AND project_id = ?').bind(sid, projectId),
    )
  }

  for (const sheet of plan.newSheets) {
    stmts.push(
      db
        .prepare(
          'INSERT INTO sheets (id, project_id, name, position, rows_json, extract_signature) VALUES (?, ?, ?, ?, NULL, NULL)',
        )
        .bind(sheet.id, projectId, sheet.name, sheet.position),
    )
  }

  for (const [tableId, sheetId] of plan.assignTableIds) {
    stmts.push(
      db
        .prepare(
          'UPDATE tables SET sheet_id = ? WHERE id = ? AND project_id = ? AND sheet_manual = 0',
        )
        .bind(sheetId, tableId, projectId),
    )
  }

  const emptySheets = await db
    .prepare(
      `SELECT s.id FROM sheets s
       LEFT JOIN tables t ON t.sheet_id = s.id
       WHERE s.project_id = ?
       GROUP BY s.id
       HAVING COUNT(t.id) = 0`,
    )
    .bind(projectId)
    .all<{ id: string }>()

  for (const row of emptySheets.results ?? []) {
    stmts.push(
      db.prepare('DELETE FROM sheets WHERE id = ? AND project_id = ?').bind(row.id, projectId),
    )
  }

  stmts.push(
    db
      .prepare('UPDATE projects SET updated_at = ? WHERE id = ?')
      .bind(now, projectId),
  )

  if (stmts.length > 0) {
    await db.batch(stmts)
  }
}