import type { GroupGeminiResponse } from './types'

export type ResolvedGroup = {
  sheetName: string
  tableIds: string[]
}

export type RegroupTable = {
  id: string
  sheetManual: boolean
}

export type RegroupSheet = {
  id: string
  name: string
  position: number
  hasManualTables: boolean
}

export type RegroupPlan = {
  deleteSheetIds: string[]
  newSheets: Array<{ id: string; name: string; position: number; tableIds: string[] }>
  assignTableIds: Map<string, string>
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

/**
 * Drop sheets with no manual tables, create sheets for groups, and assign
 * only non-manual tables. Sheets left empty after assignment are removed by the caller.
 */
export function planRegroup(
  sheets: RegroupSheet[],
  tables: RegroupTable[],
  groups: ResolvedGroup[],
): RegroupPlan {
  const tableById = new Map(tables.map((t) => [t.id, t]))
  const deleteSheetIds = sheets.filter((s) => !s.hasManualTables).map((s) => s.id)

  let nextPosition = sheets.reduce((max, s) => Math.max(max, s.position), -1) + 1

  const newSheets: RegroupPlan['newSheets'] = []
  const assignTableIds = new Map<string, string>()

  for (const g of groups) {
    const assignable = g.tableIds.filter((tid) => tableById.get(tid)?.sheetManual === false)
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
