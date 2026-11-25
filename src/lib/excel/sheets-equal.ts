import type { ExportSheet } from '@/lib/excel/build-xlsx'

export function exportSheetsEqual(
  a: ExportSheet[] | null,
  b: ExportSheet[] | null,
): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}