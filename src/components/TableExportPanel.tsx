import { AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import type { useTableExport } from '@/hooks/use-table-export'

export type { ExportReady } from '@/hooks/use-table-export'

type ExportCtrl = ReturnType<typeof useTableExport>

export function TableExportActions({
  converting,
  disabled,
  onExport,
  cancel,
  size = 'sm',
}: Pick<ExportCtrl, 'converting' | 'disabled' | 'onExport' | 'cancel'> & {
  size?: 'xs' | 'sm' | 'default'
}) {
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
      {converting ? (
        <Button type="button" size={size} variant="outline" onClick={cancel}>
          취소
        </Button>
      ) : null}
      <Button
        type="button"
        size={size}
        disabled={disabled}
        onClick={() => void onExport()}
      >
        {converting ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <FileSpreadsheet aria-hidden />
        )}
        {converting ? '변환 중…' : 'Excel로 변환'}
      </Button>
    </div>
  )
}

type PanelProps = ExportCtrl & {
  embedded?: boolean
  showActions?: boolean
}

export function TableExportStatus({
  progress,
  converting,
  error,
}: Pick<ExportCtrl, 'progress' | 'converting' | 'error'>) {
  if (!converting && !error) return null

  return (
    <div className="flex shrink-0 flex-col gap-2">
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
    </div>
  )
}

export function TableExportPanel({
  embedded = false,
  showActions = true,
  ...ctrl
}: PanelProps) {
  const { progress, converting, error, isPdf } = ctrl

  const body = (
    <>
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm">Excel 변환</CardTitle>
            <CardDescription>
              모든 영역을 시트별로 추출합니다. 시트 이름은 표 검출 단계에서 수정할 수
              있습니다.
            </CardDescription>
          </div>
          {showActions ? <TableExportActions {...ctrl} /> : null}
        </div>
      ) : showActions ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Gemini로 셀 데이터를 추출합니다.
          </p>
          <TableExportActions {...ctrl} />
        </div>
      ) : null}

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