import { useState, type ReactNode, type RefObject } from 'react'
import { ImageIcon, Maximize2, TableProperties } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'

import { BboxCropPanel } from '@/components/BboxCropPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditableExcelSheetTable } from '@/components/EditableExcelSheetTable'
import { RegionSheetStrip } from '@/components/workshop/RegionSheetStrip'
import type { EditableBox } from '@/components/EditableBBoxLayer'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import {
  motionInitial,
  motionTransition,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import {
  fadeUp,
  springSnappy,
  staggerContainerFast,
  staggerItem,
} from '@/lib/motion/variants'
import { cn } from 'cn'

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
  exportActions?: ReactNode
  sheetStripAction?: ReactNode
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
  exportActions,
  sheetStripAction,
}: Props) {
  const reduced = useReducedMotion()
  const transition = motionTransition(reduced, springSnappy)

  const [cellDataExpanded, setCellDataExpanded] = useState(false)
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
      <m.div
        className="grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]"
        variants={staggerContainerFast}
        initial={motionInitial(reduced)}
        animate="animate"
      >
        <m.div
          variants={staggerItem}
          transition={transition}
          className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        >
          <Card
            aria-label="사진 영역"
            className="flex h-full min-h-0 min-w-0 flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card py-0 shadow-none ring-0"
          >
            <ConvertPanelHeader>
              <ImageIcon className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-foreground">
                사진 영역
              </span>
              {exportActions}
            </ConvertPanelHeader>
            <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col px-2 pb-2 pt-0">
              <BboxCropPanel
                imageRef={imageRef}
                imageRevision={imageRevision}
                boxes={boxes}
                selectedId={selectedId}
                showTitle={false}
              />
            </CardContent>
          </Card>
        </m.div>

        <m.div
          variants={staggerItem}
          transition={transition}
          className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        >
          <Card
            aria-label="추출된 표 데이터"
            className="flex h-full min-h-0 min-w-0 flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card py-0 shadow-none ring-0"
          >
            <ConvertPanelHeader>
              <TableProperties className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-foreground">
                셀 데이터
              </span>
              {activeSheet ? (
                <>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {activeSheet.rows.length}행
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="shrink-0"
                    onClick={() => setCellDataExpanded(true)}
                  >
                    <Maximize2 className="size-3.5" aria-hidden />
                    크게보기
                  </Button>
                </>
              ) : null}
            </ConvertPanelHeader>

            <AnimatePresence mode="wait" initial={false}>
              {activeSheet ? (
                <m.div
                  key="sheet-data"
                  variants={fadeUp}
                  initial={motionInitial(reduced)}
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                >
                  <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col px-2 pb-2 pt-0">
                    <EditableExcelSheetTable
                      sheet={activeSheet}
                      onChange={updateActiveSheetRows}
                      className="flex min-h-0 flex-1 flex-col"
                    />
                  </CardContent>
                </m.div>
              ) : (
                <m.div
                  key="sheet-empty"
                  variants={fadeUp}
                  initial={motionInitial(reduced)}
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                >
                  <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-2 pb-2 pt-0 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {converting
                        ? 'Gemini API로 표를 읽는 중…'
                        : '변환을 실행하면 데이터가 표시됩니다'}
                    </p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      사진 영역에서 Excel 변환을 실행하세요. 완료 후 셀을 직접 수정할
                      수 있습니다.
                    </p>
                  </CardContent>
                </m.div>
              )}
            </AnimatePresence>
          </Card>
        </m.div>
      </m.div>

      {activeSheet ? (
        <Dialog open={cellDataExpanded} onOpenChange={setCellDataExpanded}>
          <DialogContent
            showCloseButton
            className="flex h-[min(92vh,880px)] w-[min(96vw,1280px)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:max-w-none"
          >
            <DialogHeader className="shrink-0 text-left">
              <DialogTitle className="truncate">{activeSheet.name}</DialogTitle>
              <DialogDescription>
                {activeSheet.rows.length}행 · 조회 전용입니다. 수정은 패널에서 할 수
                있습니다.
              </DialogDescription>
            </DialogHeader>
            <EditableExcelSheetTable
              sheet={activeSheet}
              readOnly
              maxPreviewRows={activeSheet.rows.length}
              size="md"
              className="flex min-h-0 flex-1 flex-col"
            />
          </DialogContent>
        </Dialog>
      ) : null}

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
          action={sheetStripAction}
        />
      ) : null}
    </div>
  )
}

function ConvertPanelHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 flex-row flex-nowrap items-center gap-2 border-b border-border px-3',
        className,
      )}
    >
      {children}
    </div>
  )
}