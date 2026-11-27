import type { ProjectDetail, SheetJson, TableJson } from '@/lib/api/projects'
import type { StepAccess } from '@/components/workshop/WorkflowStepBar'
import type { WorkshopStepId } from '@/lib/workflow/workshop-steps'

export function imagesSorted(detail: ProjectDetail) {
  return [...detail.images].sort((a, b) => a.position - b.position)
}

export function tablesForImage(
  detail: ProjectDetail,
  imageId: string,
): TableJson[] {
  return detail.tables
    .filter((t) => t.imageId === imageId)
    .sort((a, b) => a.position - b.position)
}

export function tablesSorted(detail: ProjectDetail): TableJson[] {
  return [...detail.tables].sort((a, b) => {
    const imgA = detail.images.find((i) => i.id === a.imageId)?.position ?? 0
    const imgB = detail.images.find((i) => i.id === b.imageId)?.position ?? 0
    if (imgA !== imgB) return imgA - imgB
    return a.position - b.position
  })
}

export function sheetsSorted(detail: ProjectDetail): SheetJson[] {
  return [...detail.sheets].sort((a, b) => a.position - b.position)
}

export function unassignedTables(detail: ProjectDetail): TableJson[] {
  return tablesSorted(detail).filter((t) => t.sheetId === null)
}

export function tablesInSheet(
  detail: ProjectDetail,
  sheetId: string,
): TableJson[] {
  const sheet = detail.sheets.find((s) => s.id === sheetId)
  if (!sheet) return []
  const byId = new Map(detail.tables.map((t) => [t.id, t]))
  return sheet.tableIds
    .map((id) => byId.get(id))
    .filter((t): t is TableJson => Boolean(t))
}

export function imageNameById(detail: ProjectDetail): Map<string, string> {
  return new Map(detail.images.map((i, index) => [i.id, `${index + 1}. ${i.name}`]))
}

export function sheetIsReady(sheet: SheetJson): boolean {
  return Boolean(sheet.rows && sheet.rows.length > 0 && !sheet.stale)
}

export function allTablesAssigned(detail: ProjectDetail): boolean {
  if (detail.tables.length === 0) return false
  return detail.tables.every((t) => t.sheetId !== null)
}

export function deriveStepAccess(detail: ProjectDetail): StepAccess {
  const hasTables = detail.tables.length >= 1
  const assigned = allTablesAssigned(detail)
  const sheets = sheetsSorted(detail)
  const reviewReady =
    sheets.length > 0 && sheets.every((s) => sheetIsReady(s))

  return {
    detect: true,
    group: hasTables,
    convert: assigned,
    review: reviewReady,
  }
}

export function tableCountForImage(detail: ProjectDetail, imageId: string): number {
  return detail.tables.filter((t) => t.imageId === imageId).length
}

export function exportSheetsFromDetail(detail: ProjectDetail) {
  return sheetsSorted(detail).map((s) => ({
    name: s.name,
    rows: s.rows ?? [],
  }))
}

export function canDownload(detail: ProjectDetail): {
  ok: boolean
  reason?: string
} {
  const sheets = sheetsSorted(detail)
  if (sheets.length === 0) {
    return { ok: false, reason: '다운로드할 시트가 없습니다.' }
  }
  const missing = sheets.filter((s) => !s.rows || s.rows.length === 0)
  if (missing.length > 0) {
    return {
      ok: false,
      reason: '아직 추출되지 않은 시트가 있습니다. 변환 단계에서 추출을 완료하세요.',
    }
  }
  const stale = sheets.filter((s) => s.stale)
  if (stale.length > 0) {
    return {
      ok: false,
      reason:
        '일부 시트 결과가 오래되었습니다. 표 위치 변경 후 다시 추출하세요.',
    }
  }
  return { ok: true }
}

export function defaultWorkshopStep(detail: ProjectDetail): WorkshopStepId {
  const access = deriveStepAccess(detail)
  if (access.review) return 'review'
  if (access.convert) return 'convert'
  if (access.group) return 'group'
  return 'detect'
}