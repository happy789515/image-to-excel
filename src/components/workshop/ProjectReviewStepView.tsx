import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'

import { EditableExcelSheetTable } from '@/components/EditableExcelSheetTable'
import { SheetTabStrip } from '@/components/workshop/SheetTabStrip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useProjectWorkshop } from '@/hooks/use-project-workshop'
import { buildXlsxBlob } from '@/lib/excel/build-xlsx'
import { downloadXlsxFile } from '@/lib/excel/download-xlsx'
import { canDownload, exportSheetsFromDetail } from '@/lib/project/selectors'

export function ProjectReviewStepView() {
  const { detail } = useProjectWorkshop()
  const sheets = useMemo(() => exportSheetsFromDetail(detail), [detail])
  const [activeIndex, setActiveIndex] = useState(0)
  const download = canDownload(detail)
  const fileName = `${detail.project.name}.xlsx`

  const active = sheets[activeIndex] ?? sheets[0]
  if (!active) {
    return (
      <p className="p-6 text-sm text-muted-foreground">표시할 시트가 없습니다.</p>
    )
  }

  const handleDownload = () => {
    if (!download.ok) return
    const blob = buildXlsxBlob(sheets)
    downloadXlsxFile(blob, fileName)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card m-3">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <FileSpreadsheet
          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={fileName}>
          {fileName}
        </span>
        <Button
          type="button"
          size="xs"
          disabled={!download.ok}
          onClick={handleDownload}
        >
          <Download className="size-3.5" aria-hidden />
          xlsx 다운로드
        </Button>
      </div>

      {!download.ok && download.reason ? (
        <Alert className="m-3 mb-0">
          <AlertDescription>{download.reason}</AlertDescription>
        </Alert>
      ) : null}

      <EditableExcelSheetTable
        sheet={active}
        readOnly
        maxPreviewRows={Math.max(active.rows.length, 1)}
        showChrome
        className="flex min-h-0 flex-1 flex-col bg-[#e8e8e8]/50 dark:bg-muted/30"
      />

      <SheetTabStrip
        sheets={sheets}
        activeIndex={activeIndex}
        onSelectIndex={setActiveIndex}
        variant="workbook"
      />
    </div>
  )
}