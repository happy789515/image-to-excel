import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { downloadXlsxFile } from '@/lib/excel/download-xlsx'
import { cn } from 'cn'

type Props = {
  sheets: ExportSheet[]
  blob: Blob
  downloadFileName: string
  warnings?: string | null
}

const MAX_PREVIEW_ROWS = 120

export function ExcelResultPreview({
  sheets,
  blob,
  downloadFileName,
  warnings,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [sheets])

  const active = sheets[activeIndex] ?? sheets[0]
  const colCount = useMemo(() => {
    if (!active) return 0
    return active.rows.reduce((max, row) => Math.max(max, row.length), 0)
  }, [active])

  if (!active) return null

  const rows = active.rows.slice(0, MAX_PREVIEW_ROWS)
  const truncated = active.rows.length > MAX_PREVIEW_ROWS

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-background p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Excel 미리보기</p>
          <p className="text-xs text-muted-foreground">
            내용을 확인한 뒤 다운로드하세요. ({downloadFileName})
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => downloadXlsxFile(blob, downloadFileName)}
        >
          <Download aria-hidden />
          xlsx 다운로드
        </Button>
      </div>

      {warnings ? (
        <p className="text-xs text-amber-700 dark:text-amber-400" role="status">
          {warnings}
        </p>
      ) : null}

      {sheets.length > 1 ? (
        <div
          className="flex flex-wrap gap-1 border-b border-border pb-2"
          role="tablist"
          aria-label="시트 선택"
        >
          {sheets.map((sheet, index) => (
            <button
              key={`${sheet.name}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                index === activeIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
              onClick={() => setActiveIndex(index)}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">시트: {active.name}</p>
      )}

      <div className="max-h-[min(50vh,420px)] overflow-auto rounded-md border border-border">
        <table className="w-full min-w-max border-collapse text-xs">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? 'bg-muted/60 font-medium' : ''}>
                {Array.from({ length: Math.max(colCount, row.length) }, (_, ci) => (
                  <td
                    key={ci}
                    className="border border-border px-2 py-1.5 text-left align-top text-foreground whitespace-pre-wrap"
                  >
                    {row[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {truncated ? (
        <p className="text-[10px] text-muted-foreground">
          미리보기는 처음 {MAX_PREVIEW_ROWS}행만 표시합니다. 전체 데이터는 다운로드 파일에
          포함됩니다.
        </p>
      ) : null}
    </div>
  )
}