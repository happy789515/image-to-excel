import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { cn } from 'cn'

type Props = {
  sheets: ExportSheet[]
  activeIndex: number
  onSelectIndex: (index: number) => void
  className?: string
  variant?: 'line' | 'workbook'
}

export function SheetTabStrip({
  sheets,
  activeIndex,
  onSelectIndex,
  className,
  variant = 'line',
}: Props) {
  if (sheets.length === 0) return null

  if (variant === 'workbook') {
    return (
      <div
        className={cn(
          'scrollbar-thin flex shrink-0 items-end gap-px overflow-x-auto border-t border-border bg-muted/50 px-1 pt-1',
          className,
        )}
        role="tablist"
        aria-label="워크북 시트"
      >
        {sheets.map((sheet, index) => {
          const selected = index === activeIndex
          return (
            <button
              key={`${sheet.name}-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelectIndex(index)}
              className={cn(
                'max-w-[11rem] truncate rounded-t-md border border-b-0 px-3 py-1.5 text-xs transition-colors',
                selected
                  ? 'relative z-[1] -mb-px border-border bg-card font-medium text-foreground'
                  : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/70',
              )}
            >
              {sheet.name}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <Tabs
      value={String(activeIndex)}
      onValueChange={(value) => onSelectIndex(Number(value))}
      className={cn('w-full', className)}
    >
      <TabsList
        variant="line"
        className="scrollbar-thin h-auto w-full max-w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
      >
        {sheets.map((sheet, index) => (
          <TabsTrigger
            key={`${sheet.name}-${index}`}
            value={String(index)}
            className="shrink-0 rounded-none px-3 py-1.5 text-xs"
          >
            {sheet.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}