import { useMemo } from 'react'

import { Input } from '@/components/ui/input'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { cn } from 'cn'

const MAX_PREVIEW_ROWS = 120

function columnLabel(index: number): string {
  let n = index
  let label = ''
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label
    n = Math.floor(n / 26) - 1
  }
  return label
}

type Props = {
  sheet: ExportSheet
  onChange?: (rows: string[][]) => void
  className?: string
  maxPreviewRows?: number
  size?: 'sm' | 'md'
  readOnly?: boolean
  showChrome?: boolean
}

export function EditableExcelSheetTable({
  sheet,
  onChange,
  className,
  maxPreviewRows = MAX_PREVIEW_ROWS,
  size = 'sm',
  readOnly = false,
  showChrome = false,
}: Props) {
  const colCount = useMemo(
    () => sheet.rows.reduce((max, row) => Math.max(max, row.length), 0),
    [sheet.rows],
  )

  const displayCols = Math.max(colCount, 1)
  const rows = sheet.rows.slice(0, maxPreviewRows)
  const truncated = sheet.rows.length > maxPreviewRows

  const updateCell = (ri: number, ci: number, value: string) => {
    if (readOnly || !onChange) return
    const next = sheet.rows.map((row, rowIndex) => {
      if (rowIndex !== ri) return row
      const cells = [...row]
      while (cells.length <= ci) cells.push('')
      cells[ci] = value
      return cells
    })
    onChange(next)
  }

  const renderCell = (row: string[], ri: number, ci: number) => {
    const widthClass = showChrome ? 'min-w-[5.5rem]' : 'min-w-[4.5rem]'
    const heightClass = size === 'md' ? 'min-h-10' : 'min-h-8'

    if (readOnly) {
      return (
        <div
          className={cn(
            widthClass,
            'whitespace-pre-wrap break-words bg-card px-2 py-1.5',
            heightClass,
            !showChrome && ri === 0 && 'font-medium',
          )}
        >
          {row[ci] ?? ''}
        </div>
      )
    }

    return (
      <Input
        type="text"
        value={row[ci] ?? ''}
        onChange={(e) => updateCell(ri, ci, e.target.value)}
        className={cn(
          'h-auto w-full rounded-none border-0 bg-card px-2 py-1.5 shadow-none',
          widthClass,
          heightClass,
          'focus-visible:z-[1] focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40',
          !showChrome && ri === 0 && 'font-medium',
        )}
        aria-label={`행 ${ri + 1} 열 ${columnLabel(ci)}`}
      />
    )
  }

  return (
    <div className={className}>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <table
          className={cn(
            'w-full min-w-max border-collapse tabular-nums',
            size === 'md' ? 'text-sm' : 'text-xs',
          )}
        >
          {showChrome ? (
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-[2] w-11 border border-border bg-muted/90 p-0"
                />
                {Array.from({ length: displayCols }, (_, ci) => (
                  <th
                    key={ci}
                    scope="col"
                    className="sticky top-0 z-[1] min-w-[5.5rem] border border-border bg-muted/90 px-2 py-1 text-center text-[11px] font-normal text-muted-foreground"
                  >
                    {columnLabel(ci)}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={!showChrome && ri === 0 ? 'bg-card' : undefined}>
                {showChrome ? (
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] w-11 border border-border bg-muted/90 px-1 py-1 text-center text-[11px] font-normal text-muted-foreground"
                  >
                    {ri + 1}
                  </th>
                ) : null}
                {Array.from({ length: Math.max(displayCols, row.length) }, (_, ci) => (
                  <td key={ci} className="border border-border p-0 align-top">
                    {renderCell(row, ri, ci)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated ? (
        <p className="mt-2 px-2 text-[10px] text-muted-foreground">
          {readOnly
            ? `처음 ${maxPreviewRows}행만 표시합니다.`
            : `처음 ${maxPreviewRows}행만 편집할 수 있습니다. 나머지는 xlsx에 그대로 포함됩니다.`}
        </p>
      ) : null}
    </div>
  )
}