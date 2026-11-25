import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'

import { ExcelSheetTable } from '@/components/ExcelSheetTable'
import { SheetTabStrip } from '@/components/workshop/SheetTabStrip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { downloadXlsxFile } from '@/lib/excel/download-xlsx'

type Props = {
  sheets: ExportSheet[]
  blob: Blob
  downloadFileName: string
  warnings?: string | null
}

export function ExcelResultPreview({
  sheets,
  blob,
  downloadFileName,
  warnings,
}: Props) {
  const sheetsKey = useMemo(
    () => sheets.map((s) => s.name).join('\0'),
    [sheets],
  )
  const [activeIndexByKey, setActiveIndexByKey] = useState(() => ({
    key: sheetsKey,
    index: 0,
  }))
  const activeIndex =
    activeIndexByKey.key === sheetsKey
      ? Math.min(activeIndexByKey.index, Math.max(0, sheets.length - 1))
      : 0
  const setActiveIndex = (index: number) => {
    setActiveIndexByKey({ key: sheetsKey, index })
  }

  const active = sheets[activeIndex] ?? sheets[0]

  if (!active) return null

  return (
    <Card className="border-primary/25 shadow-sm">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-sm">Excel 미리보기</CardTitle>
          <CardDescription>내용을 확인한 뒤 다운로드하세요. ({downloadFileName})</CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => downloadXlsxFile(blob, downloadFileName)}
        >
          <Download aria-hidden />
          xlsx 다운로드
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {warnings ? (
          <Alert>
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              {warnings}
            </AlertDescription>
          </Alert>
        ) : null}

        {sheets.length > 1 ? (
          <SheetTabStrip
            sheets={sheets}
            activeIndex={activeIndex}
            onSelectIndex={setActiveIndex}
          />
        ) : (
          <p className="text-xs text-muted-foreground">시트: {active.name}</p>
        )}

        <ExcelSheetTable
          sheet={active}
          className="max-h-[min(50vh,420px)] flex flex-col"
        />
      </CardContent>
    </Card>
  )
}