import { useMemo } from 'react'

import { Input } from '@/components/ui/input'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { cn } from 'cn'

const MAX_PREVIEW_ROWS = 120

type Props = {
  sheet: ExportSheet
  onChange: (rows: string[][]) => void
  className?: string
}

export function EditableExcelSheetTable({ sheet, onChange, className }: Props) {
  const colCount = useMemo(
    () => sheet.rows.reduce((max, row) => Math.max(max, row.length), 0),
    [sheet.rows],
  )

  const rows = sheet.rows.slice(0, MAX_PREVIEW_ROWS)
  const truncated = sheet.rows.length > MAX_PREVIEW_ROWS

  const updateCell = (ri: number, ci: number, value: string) => {
    const next = sheet.rows.map((row, rowIndex) => {
      if (rowIndex !== ri) return row
      const cells = [...row]
      while (cells.length <= ci) cells.push('')
      cells[ci] = value
      return cells
    })
    onChange(next)
  }

  return (
    <div className={className}>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto rounded-md border border-border">
        <table className="w-full min-w-max border-collapse text-xs tabular-nums">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? 'border-b border-border bg-card' : ''}>
                {Array.from({ length: Math.max(colCount, row.length) }, (_, ci) => (
                  <td key={ci} className="border border-border p-0 align-top">
                    <Input
                      type="text"
                      value={row[ci] ?? ''}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className={cn(
                        'h-auto min-h-8 min-w-[4.5rem] w-full rounded-none border-0 bg-transparent px-2 py-1.5 shadow-none',
                        'focus-visible:bg-accent/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                        ri === 0 && 'font-medium',
                      )}
                      aria-label={`행 ${ri + 1} 열 ${ci + 1}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          처음 {MAX_PREVIEW_ROWS}행만 편집할 수 있습니다. 나머지는 xlsx에 그대로 포함됩니다.
        </p>
      ) : null}
    </div>
  )
}