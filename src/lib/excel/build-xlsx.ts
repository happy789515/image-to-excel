import * as XLSX from 'xlsx'

import { sanitizeSheetName } from '@/lib/excel/sheet-name'

export type ExportSheet = {
  name: string
  rows: string[][]
}

export function buildXlsxBlob(sheets: ExportSheet[]): Blob {
  const book = XLSX.utils.book_new()
  const used = new Set<string>()

  for (const sheet of sheets) {
    const name = sanitizeSheetName(sheet.name, used)
    const aoa = sheet.rows.length > 0 ? sheet.rows : [['']]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(book, ws, name)
  }

  const buf = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}