import { useCallback, useRef, useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'

import type { EditableBox } from '@/components/EditableBBoxLayer'
import { ExcelResultPreview } from '@/components/ExcelResultPreview'
import { Button } from '@/components/ui/button'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import {
  PRESET_LABELS,
  type PreprocessPreset,
} from '@/lib/image/preprocess-types'
import { runTableExport } from '@/lib/table-export/run-export'
import type { ExportProgress } from '@/lib/table-export/types'

type Props = {
  file: File
  boxes: EditableBox[]
}

const INITIAL: ExportProgress = {
  phase: 'idle',
  detail: '',
  ratio: 0,
  sheetIndex: 0,
  sheetCount: 0,
}

type ExportReady = {
  blob: Blob
  sheets: ExportSheet[]
  downloadFileName: string
}

export function TableExportPanel({ file, boxes }: Props) {
  const [preset, setPreset] = useState<PreprocessPreset>('standard')
  const [progress, setProgress] = useState<ExportProgress>(INITIAL)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportReady, setExportReady] = useState<ExportReady | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const onExport = useCallback(async () => {
    setError(null)
    setExportReady(null)
    const controller = new AbortController()
    abortRef.current = controller
    setConverting(true)
    setProgress({
      phase: 'crop',
      detail: '변환을 시작합니다…',
      ratio: 0,
      sheetIndex: 0,
      sheetCount: boxes.length,
    })

    try {
      const result = await runTableExport(file, boxes, {
        preset,
        signal: controller.signal,
        onProgress: setProgress,
      })

      setExportReady({
        blob: result.blob,
        sheets: result.sheets,
        downloadFileName: result.downloadFileName,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('변환을 취소했습니다.')
      } else {
        console.error(err)
        setError(
          err instanceof Error ? err.message : 'Excel 변환 중 오류가 발생했습니다.',
        )
      }
    } finally {
      setConverting(false)
      abortRef.current = null
    }
  }, [boxes, file, preset])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const isPdf = file.type === 'application/pdf'
  const disabled = boxes.length === 0 || converting || isPdf

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Excel 변환</p>
          <p className="text-xs text-muted-foreground">
            모든 영역을 시트별로 변환합니다. 시트 이름은 위 목록에서 수정할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="export-preset">
            자르기
          </label>
          <select
            id="export-preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value as PreprocessPreset)}
            disabled={converting}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {(Object.keys(PRESET_LABELS) as PreprocessPreset[]).map((key) => (
              <option key={key} value={key}>
                {PRESET_LABELS[key]}
              </option>
            ))}
          </select>
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
        <p className="text-xs text-muted-foreground">
          PDF는 Excel 변환을 지원하지 않습니다. 이미지 파일을 사용해 주세요.
        </p>
      ) : null}

      {converting ? (
        <div className="space-y-1" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{progress.detail}</p>
        </div>
      ) : null}

      {exportReady ? (
        <ExcelResultPreview
          sheets={exportReady.sheets}
          blob={exportReady.blob}
          downloadFileName={exportReady.downloadFileName}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}