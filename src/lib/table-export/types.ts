import type { ExportSheet } from '@/lib/excel/build-xlsx'
import type { PreprocessPreset } from '@/lib/image/preprocess-types'

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
  preset: PreprocessPreset
  signal?: AbortSignal
  onProgress?: (p: ExportProgress) => void
}

export type RunExportResult = {
  blob: Blob
  sheets: ExportSheet[]
  downloadFileName: string
}