import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { cn } from 'cn'

type Props = {
  sheets: ExportSheet[]
  activeIndex: number
  onSelectIndex: (index: number) => void
  className?: string
}

export function SheetTabStrip({
  sheets,
  activeIndex,
  onSelectIndex,
  className,
}: Props) {
  if (sheets.length === 0) return null

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