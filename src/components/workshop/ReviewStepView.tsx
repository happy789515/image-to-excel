import { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, Save } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'

import { EditableExcelSheetTable } from '@/components/EditableExcelSheetTable'
import { SheetTabStrip } from '@/components/workshop/SheetTabStrip'
import { Button } from '@/components/ui/button'
import { buildXlsxBlob } from '@/lib/excel/build-xlsx'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { exportSheetsEqual } from '@/lib/excel/sheets-equal'
import { downloadXlsxFile } from '@/lib/excel/download-xlsx'
import {
  motionInitial,
  motionTransition,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import { scaleInTight, springSnappy } from '@/lib/motion/variants'
import { cn } from 'cn'

type Props = {
  committedSheets: ExportSheet[]
  activeIndex: number
  onSelectIndex: (index: number) => void
  downloadFileName: string
  reviewCommitted: boolean
  onDirtyChange: (dirty: boolean) => void
  onCommit: (sheets: ExportSheet[]) => void
}

function committedSheetsKey(sheets: ExportSheet[]): string {
  return sheets
    .map((s) => `${s.name}:${s.rows.length}:${s.rows.map((r) => r.join('\x1e')).join('\x1f')}`)
    .join('\x00')
}

export function ReviewStepView(props: Props) {
  const key = useMemo(
    () => committedSheetsKey(props.committedSheets),
    [props.committedSheets],
  )
  return <ReviewStepEditor key={key} {...props} />
}

function ReviewStepEditor({
  committedSheets,
  activeIndex,
  onSelectIndex,
  downloadFileName,
  reviewCommitted,
  onDirtyChange,
  onCommit,
}: Props) {
  const [draftSheets, setDraftSheets] = useState<ExportSheet[]>(committedSheets)

  const dirty = useMemo(
    () => !exportSheetsEqual(draftSheets, committedSheets),
    [committedSheets, draftSheets],
  )

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  const active = draftSheets[activeIndex] ?? draftSheets[0]
  if (!active) return null

  const updateActiveRows = (rows: string[][]) => {
    setDraftSheets((prev) =>
      prev.map((s, i) => (i === activeIndex ? { ...s, rows } : s)),
    )
  }

  const handleDownload = () => {
    if (!dirty && !reviewCommitted) onCommit(draftSheets)
    const blob = buildXlsxBlob(draftSheets)
    downloadXlsxFile(blob, downloadFileName)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <WorkbookToolbar
        downloadFileName={downloadFileName}
        dirty={dirty}
        reviewCommitted={reviewCommitted}
        onSave={() => onCommit(draftSheets)}
        onDownload={handleDownload}
      />

      <EditableExcelSheetTable
        sheet={active}
        onChange={updateActiveRows}
        maxPreviewRows={Math.max(active.rows.length, 1)}
        showChrome
        className="flex min-h-0 flex-1 flex-col bg-[#e8e8e8]/50 dark:bg-muted/30"
      />

      <SheetTabStrip
        sheets={draftSheets}
        activeIndex={activeIndex}
        onSelectIndex={onSelectIndex}
        variant="workbook"
      />
    </div>
  )
}

function WorkbookToolbar({
  downloadFileName,
  dirty,
  reviewCommitted,
  onSave,
  onDownload,
}: {
  downloadFileName: string
  dirty: boolean
  reviewCommitted: boolean
  onSave: () => void
  onDownload: () => void
}) {
  const reduced = useReducedMotion()
  const transition = motionTransition(reduced, springSnappy)
  const statusKey =
    !dirty && reviewCommitted ? 'saved' : dirty ? 'dirty' : 'none'

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <FileSpreadsheet className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" aria-hidden />
      <span
        className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
        title={downloadFileName}
      >
        {downloadFileName}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        {statusKey !== 'none' ? (
          <m.span
            key={statusKey}
            className={cn(
              'shrink-0 text-[10px]',
              statusKey === 'saved' && 'text-muted-foreground',
              statusKey === 'dirty' && 'text-amber-600 dark:text-amber-500',
            )}
            variants={scaleInTight}
            initial={motionInitial(reduced)}
            animate="animate"
            exit="exit"
            transition={transition}
          >
            {statusKey === 'saved' ? '저장됨' : '미저장'}
          </m.span>
        ) : null}
      </AnimatePresence>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={!dirty}
        onClick={onSave}
      >
        <Save className="size-3.5" aria-hidden />
        저장
      </Button>
      <Button type="button" size="xs" onClick={onDownload}>
        <Download className="size-3.5" aria-hidden />
        xlsx 다운로드
      </Button>
    </div>
  )
}