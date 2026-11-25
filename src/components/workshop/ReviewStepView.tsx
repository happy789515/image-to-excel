import { useMemo } from 'react'
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Layers,
  Rows3,
} from 'lucide-react'

import { ExcelSheetTable } from '@/components/ExcelSheetTable'
import { SheetTabStrip } from '@/components/workshop/SheetTabStrip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { downloadXlsxFile } from '@/lib/excel/download-xlsx'
import { cn } from 'cn'

type Props = {
  sheets: ExportSheet[]
  activeIndex: number
  onSelectIndex: (index: number) => void
  blob: Blob
  downloadFileName: string
  onBackToConvert: () => void
  onBackToDetect: () => void
}

function sheetStats(sheets: ExportSheet[]) {
  const rowTotal = sheets.reduce((sum, s) => sum + s.rows.length, 0)
  return { sheetCount: sheets.length, rowTotal }
}

export function ReviewStepView({
  sheets,
  activeIndex,
  onSelectIndex,
  blob,
  downloadFileName,
  onBackToConvert,
  onBackToDetect,
}: Props) {
  const stats = useMemo(() => sheetStats(sheets), [sheets])
  const active = sheets[activeIndex] ?? sheets[0]

  if (!active) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="grid shrink-0 gap-3 sm:grid-cols-3">
        <StatTile
          icon={Layers}
          label="시트"
          value={`${stats.sheetCount}개`}
        />
        <StatTile icon={Rows3} label="총 행" value={`${stats.rowTotal.toLocaleString()}행`} />
        <StatTile
          icon={FileSpreadsheet}
          label="파일"
          value={downloadFileName}
          truncate
        />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 border-b border-border">
          <div className="min-w-0">
            <CardTitle className="text-sm">최종 미리보기</CardTitle>
            <CardDescription>
              다운로드 전 시트별로 한 번 더 확인하세요.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onBackToConvert}>
              <ArrowLeft aria-hidden />
              데이터 수정
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => downloadXlsxFile(blob, downloadFileName)}
            >
              <Download aria-hidden />
              xlsx 다운로드
            </Button>
          </div>
        </CardHeader>

        <SheetTabStrip
          sheets={sheets}
          activeIndex={activeIndex}
          onSelectIndex={onSelectIndex}
          className="border-t-0 border-b"
        />

        <CardContent className="flex min-h-0 flex-1 flex-col">
          <ExcelSheetTable sheet={active} className="flex min-h-0 flex-1 flex-col" />
        </CardContent>
      </Card>

      <Card size="sm" className="bg-card">
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t-0 bg-transparent">
          <p className="text-xs text-muted-foreground">
            영역을 바꾸려면 표 검출 단계로 돌아가세요. 추출 결과는 다시 실행해야 합니다.
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={onBackToDetect}>
            표 검출로
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  truncate,
}: {
  icon: typeof Layers
  label: string
  value: string
  truncate?: boolean
}) {
  return (
    <Card size="sm" className="flex-row items-start gap-3 px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            'text-sm font-semibold text-foreground',
            truncate && 'truncate text-xs font-medium',
          )}
          title={truncate ? value : undefined}
        >
          {value}
        </p>
      </div>
    </Card>
  )
}