import { useCallback, useRef, useState } from 'react'

import type { EditableBox } from '@/components/EditableBBoxLayer'
import { runTableExport } from '@/lib/table-export/run-export'
import type { ExportSheet } from '@/lib/excel/build-xlsx'

export type ExportReady = {
  blob: Blob
  sheets: ExportSheet[]
  downloadFileName: string
}
import type { ExportProgress } from '@/lib/table-export/types'
import type { WorkflowPhaseId } from '@/lib/workflow/types'

const INITIAL: ExportProgress = {
  phase: 'idle',
  detail: '',
  ratio: 0,
  sheetIndex: 0,
  sheetCount: 0,
}

function mapExportPhase(p: ExportProgress['phase']): WorkflowPhaseId {
  switch (p) {
    case 'crop':
    case 'gemini':
      return 'extracting'
    case 'build':
      return 'packaging'
    case 'done':
      return 'complete'
    default:
      return 'review'
  }
}

type Options = {
  file: File
  boxes: EditableBox[]
  onPhase?: (phase: WorkflowPhaseId, detail?: string) => void
  onExportReady?: (result: ExportReady | null) => void
  onConvertingChange?: (converting: boolean) => void
}

export function useTableExport({
  file,
  boxes,
  onPhase,
  onExportReady,
  onConvertingChange,
}: Options) {
  const [progress, setProgress] = useState<ExportProgress>(INITIAL)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const onExport = useCallback(async () => {
    setError(null)
    onExportReady?.(null)
    const controller = new AbortController()
    abortRef.current = controller
    setConverting(true)
    onConvertingChange?.(true)
    setProgress({
      phase: 'crop',
      detail: '변환을 시작합니다…',
      ratio: 0,
      sheetIndex: 0,
      sheetCount: boxes.length,
    })
    onPhase?.('extracting', '영역 자르기부터 시작합니다…')

    try {
      const result = await runTableExport(file, boxes, {
        signal: controller.signal,
        onProgress: (p) => {
          setProgress(p)
          onPhase?.(mapExportPhase(p.phase), p.detail)
        },
      })

      const ready: ExportReady = {
        blob: result.blob,
        sheets: result.sheets,
        downloadFileName: result.downloadFileName,
      }
      onExportReady?.(ready)
      onPhase?.('complete', 'Excel 파일이 준비되었습니다.')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('변환을 취소했습니다.')
        onPhase?.('review', '변환을 취소했습니다. 영역을 수정할 수 있습니다.')
      } else {
        console.error(err)
        const message =
          err instanceof Error ? err.message : 'Excel 변환 중 오류가 발생했습니다.'
        setError(message)
        onPhase?.('error', message)
      }
    } finally {
      setConverting(false)
      onConvertingChange?.(false)
      abortRef.current = null
    }
  }, [boxes, file, onConvertingChange, onExportReady, onPhase])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const isPdf = file.type === 'application/pdf'
  const disabled = boxes.length === 0 || converting || isPdf

  return {
    progress,
    converting,
    error,
    isPdf,
    disabled,
    onExport,
    cancel,
  }
}