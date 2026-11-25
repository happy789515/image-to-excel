import type { ExportSheet } from '@/lib/excel/build-xlsx'

export type ExportPhase =
  | 'idle'
  | 'crop'
  | 'gemini'
  | 'build'
  | 'done'
  | 'error'

export type ExportProgress = {
  phase: ExportPhase
  detail: string
  /** 0..1 overall */
  ratio: number
  sheetIndex: number
  sheetCount: number
}

export type RunExportOptions = {
  signal?: AbortSignal
  onProgress?: (p: ExportProgress) => void
}

export type RunExportResult = {
  blob: Blob
  sheets: ExportSheet[]
  downloadFileName: string
}