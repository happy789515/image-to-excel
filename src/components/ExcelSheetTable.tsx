import { useMemo } from 'react'

import type { ExportSheet } from '@/lib/excel/build-xlsx'

const MAX_PREVIEW_ROWS = 120

type Props = {
  sheet: ExportSheet
  className?: string
}

export function ExcelSheetTable({ sheet, className }: Props) {
  const colCount = useMemo(
    () => sheet.rows.reduce((max, row) => Math.max(max, row.length), 0),
    [sheet.rows],
  )

  const rows = sheet.rows.slice(0, MAX_PREVIEW_ROWS)
  const truncated = sheet.rows.length > MAX_PREVIEW_ROWS

  return (
    <div className={className}>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto rounded-md border border-border">
        <table className="w-full min-w-max border-collapse text-xs">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? 'border-b border-border bg-card font-medium' : ''}>
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
        <p className="mt-2 text-[10px] text-muted-foreground">
          처음 {MAX_PREVIEW_ROWS}행만 표시합니다. 전체는 xlsx 파일에 포함됩니다.
        </p>
      ) : null}
    </div>
  )
}