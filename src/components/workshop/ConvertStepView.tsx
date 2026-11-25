import type { RefObject } from 'react'
import { ImageIcon, TableProperties } from 'lucide-react'

import { BboxCropPanel } from '@/components/BboxCropPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditableExcelSheetTable } from '@/components/EditableExcelSheetTable'
import { RegionSheetStrip } from '@/components/workshop/RegionSheetStrip'
import type { EditableBox } from '@/components/EditableBBoxLayer'
import type { ExportSheet } from '@/lib/excel/build-xlsx'

type Props = {
  imageRef: RefObject<HTMLImageElement | null>
  imageRevision: number
  boxes: EditableBox[]
  selectedId: string | null
  onSelectBox: (id: string) => void
  sheets: ExportSheet[] | null
  activeSheetIndex: number
  onSelectSheetIndex: (index: number) => void
  onSheetsChange: (sheets: ExportSheet[]) => void
  converting: boolean
}

export function ConvertStepView({
  imageRef,
  imageRevision,
  boxes,
  selectedId,
  onSelectBox,
  sheets,
  activeSheetIndex,
  onSelectSheetIndex,
  onSheetsChange,
  converting,
}: Props) {
  const activeSheet = sheets?.[activeSheetIndex] ?? sheets?.[0]

  const updateActiveSheetRows = (rows: string[][]) => {
    if (!sheets) return
    const next = sheets.map((s, i) =>
      i === activeSheetIndex ? { ...s, rows } : s,
    )
    onSheetsChange(next)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-2">
        <Card
          aria-label="잘라낸 표 이미지"
          className="flex min-h-0 flex-col overflow-hidden bg-card py-0"
        >
          <CardHeader className="flex-row items-center gap-2 border-b border-border py-2">
            <ImageIcon className="size-3.5 text-muted-foreground" aria-hidden />
            <CardTitle className="text-xs">표 영역</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <BboxCropPanel
              imageRef={imageRef}
              imageRevision={imageRevision}
              boxes={boxes}
              selectedId={selectedId}
            />
          </CardContent>
        </Card>

        <Card aria-label="추출된 표 데이터" className="flex min-h-0 flex-col overflow-hidden py-0">
          <CardHeader className="flex-row items-center gap-2 border-b border-border py-2">
            <TableProperties className="size-3.5 text-muted-foreground" aria-hidden />
            <CardTitle className="text-xs">셀 데이터</CardTitle>
            {activeSheet ? (
              <p className="ml-auto truncate text-[10px] text-muted-foreground">
                {activeSheet.rows.length}행
              </p>
            ) : null}
          </CardHeader>

          {activeSheet ? (
            <CardContent className="flex min-h-0 flex-1 flex-col">
              <EditableExcelSheetTable
                sheet={activeSheet}
                onChange={updateActiveSheetRows}
                className="flex min-h-0 flex-1 flex-col"
              />
            </CardContent>
          ) : (
            <CardContent className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-foreground">
                {converting ? 'Gemini API로 표를 읽는 중…' : '변환을 실행하면 데이터가 표시됩니다'}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                아래에서 Excel 변환을 시작하세요. 완료 후 셀을 직접 수정할 수 있습니다.
              </p>
            </CardContent>
          )}
        </Card>
      </div>

      {boxes.length > 0 ? (
        <RegionSheetStrip
          imageRef={imageRef}
          imageRevision={imageRevision}
          boxes={boxes}
          selectedId={selectedId}
          onSelect={(id) => {
            onSelectBox(id)
            const index = boxes.findIndex((b) => b.id === id)
            if (index >= 0) onSelectSheetIndex(index)
          }}
        />
      ) : null}
    </div>
  )
}