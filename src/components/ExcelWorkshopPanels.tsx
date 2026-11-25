import { Download } from 'lucide-react'

import { ExcelSheetTable } from '@/components/ExcelSheetTable'
import { SheetTabStrip } from '@/components/workshop/SheetTabStrip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { downloadXlsxFile } from '@/lib/excel/download-xlsx'

type Props = {
  sheets: ExportSheet[]
  activeIndex: number
  onSelectIndex: (index: number) => void
  blob: Blob
  downloadFileName: string
  onBackToEdit: () => void
}

export function ExcelWorkshopPanels({
  sheets,
  activeIndex,
  onSelectIndex,
  blob,
  downloadFileName,
  onBackToEdit,
}: Props) {
  const active = sheets[activeIndex] ?? sheets[0]
  if (!active) return null

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden">
      <Card className="flex min-h-0 flex-col overflow-hidden py-0">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 border-b border-border">
          <CardTitle className="text-xs">Excel · 시트 목록</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onBackToEdit}>
              영역 편집
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => downloadXlsxFile(blob, downloadFileName)}
            >
              <Download aria-hidden />
              다운로드
            </Button>
          </div>
        </CardHeader>
        {sheets.length > 1 ? (
          <SheetTabStrip
            sheets={sheets}
            activeIndex={activeIndex}
            onSelectIndex={onSelectIndex}
          />
        ) : (
          <p className="shrink-0 border-b border-border px-3 py-2 text-xs text-muted-foreground">
            시트: {active.name}
          </p>
        )}
        <CardContent className="flex min-h-0 flex-1 flex-col pt-3">
          <ExcelSheetTable sheet={active} className="flex min-h-0 flex-1 flex-col" />
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-col overflow-hidden py-0">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-xs">{active.name}</CardTitle>
          <CardDescription className="text-[10px]">{downloadFileName}</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col pt-3">
          <ExcelSheetTable sheet={active} className="flex min-h-0 flex-1 flex-col" />
        </CardContent>
      </Card>
    </div>
  )
}