import type { EditableBox } from '@/components/EditableBBoxLayer'
import { extractTableViaApi } from '@/lib/api/extract-table'
import { buildXlsxBlob, type ExportSheet } from '@/lib/excel/build-xlsx'
import { bufferToCanvas, type TableImageBuffer } from '@/lib/image/canvas-utils'
import { cropTableRegion } from '@/lib/image/crop'
import type { RunExportOptions, RunExportResult } from '@/lib/table-export/types'

function baseName(file: File): string {
  const dot = file.name.lastIndexOf('.')
  return dot > 0 ? file.name.slice(0, dot) : file.name
}

function report(
  options: RunExportOptions,
  partial: Parameters<NonNullable<RunExportOptions['onProgress']>>[0],
) {
  options.onProgress?.(partial)
}

function tableBufferToPngBase64(buf: TableImageBuffer): string {
  const canvas = bufferToCanvas(buf)
  const dataUrl = canvas.toDataURL('image/png')
  const comma = dataUrl.indexOf(',')
  if (comma === -1) throw new Error('Failed to encode image')
  return dataUrl.slice(comma + 1)
}

function toExportSheet(name: string, rows: { cells: string[] }[]): ExportSheet {
  return {
    name,
    rows: rows.map((r) => r.cells),
  }
}

export async function runTableExport(
  file: File,
  boxes: EditableBox[],
  options: RunExportOptions,
): Promise<RunExportResult> {
  if (boxes.length === 0) {
    throw new Error('변환할 표 영역이 없습니다.')
  }
  if (file.type === 'application/pdf') {
    throw new Error('PDF는 아직 Excel 변환을 지원하지 않습니다.')
  }

  const deskew = options.preset === 'photo'
  const sheets: ExportSheet[] = []
  const sheetCount = boxes.length

  for (let i = 0; i < boxes.length; i += 1) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const box = boxes[i]!
    const baseRatio = i / sheetCount

    report(options, {
      phase: 'crop',
      detail: `「${box.title}」 영역 자르는 중…`,
      ratio: baseRatio + 0.1 / sheetCount,
      sheetIndex: i,
      sheetCount,
    })

    const tableBase = await cropTableRegion(file, box.box, { deskew })

    report(options, {
      phase: 'gemini',
      detail: `「${box.title}」 표 추출 중…`,
      ratio: baseRatio + 0.5 / sheetCount,
      sheetIndex: i,
      sheetCount,
    })

    const imageBase64 = tableBufferToPngBase64(tableBase)
    const extracted = await extractTableViaApi(
      imageBase64,
      'image/png',
      box.title,
      options.signal,
    )

    const sheet = toExportSheet(
      extracted.name.trim() || box.title,
      extracted.rows,
    )
    sheets.push(sheet)
  }

  report(options, {
    phase: 'build',
    detail: 'Excel 파일 생성 중…',
    ratio: 0.95,
    sheetIndex: sheetCount - 1,
    sheetCount,
  })

  const blob = buildXlsxBlob(sheets)

  report(options, {
    phase: 'done',
    detail: '완료',
    ratio: 1,
    sheetIndex: sheetCount - 1,
    sheetCount,
  })

  return {
    blob,
    sheets,
    downloadFileName: `${baseName(file)}-tables.xlsx`,
  }
}