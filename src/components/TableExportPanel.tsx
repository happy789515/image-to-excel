import { useCallback, useRef, useState } from 'react'
import { AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react'

import type { EditableBox } from '@/components/EditableBBoxLayer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { runTableExport } from '@/lib/table-export/run-export'
import type { ExportProgress } from '@/lib/table-export/types'
import type { WorkflowPhaseId } from '@/lib/workflow/types'
type Props = {
  file: File
  boxes: EditableBox[]
  onPhase?: (phase: WorkflowPhaseId, detail?: string) => void
  onExportReady?: (result: ExportReady | null) => void
  onConvertingChange?: (converting: boolean) => void
  embedded?: boolean
}

const INITIAL: ExportProgress = {
  phase: 'idle',
  detail: '',
  ratio: 0,
  sheetIndex: 0,
  sheetCount: 0,
}

export type ExportReady = {
  blob: Blob
  sheets: ExportSheet[]
  downloadFileName: string
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

export function TableExportPanel({
  file,
  boxes,
  onPhase,
  onExportReady,
  onConvertingChange,
  embedded = false,
}: Props) {
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

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {!embedded ? (
            <>
              <CardTitle className="text-sm">Excel 변환</CardTitle>
              <CardDescription>
                모든 영역을 시트별로 추출합니다. 시트 이름은 표 검출 단계에서 수정할 수 있습니다.
              </CardDescription>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Gemini로 셀 데이터를 추출합니다.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {converting ? (
            <Button type="button" size="sm" variant="outline" onClick={cancel}>
              취소
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={disabled} onClick={() => void onExport()}>
            {converting ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet aria-hidden />
            )}
            {converting ? '변환 중…' : 'Excel로 변환'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        자른 표 이미지가 Google Gemini API로 전송됩니다. 로컬 개발 시{' '}
        <code className="text-[10px]">npm run dev:worker</code>를 함께 실행하세요.
      </p>

      {isPdf ? (
        <Alert>
          <AlertDescription>PDF는 Excel 변환을 지원하지 않습니다.</AlertDescription>
        </Alert>
      ) : null}

      {converting ? (
        <Progress
          value={Math.round(progress.ratio * 100)}
          className="w-full flex-col gap-1"
          aria-live="polite"
        >
          <div className="flex w-full items-center gap-2">
            <ProgressLabel className="text-xs font-normal text-muted-foreground">
              {progress.detail}
            </ProgressLabel>
            <ProgressValue className="text-xs" />
          </div>
        </Progress>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>변환 오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </>
  )

  if (embedded) {
    return <div className="flex flex-col gap-2">{body}</div>
  }

  return (
    <Card size="sm" className="bg-card">
      <CardHeader className="sr-only">
        <CardTitle>Excel 변환</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{body}</CardContent>
    </Card>
  )
}
