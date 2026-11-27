import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Play, PlayCircle } from 'lucide-react'
import { cn } from 'cn'

import { EditableExcelSheetTable } from '@/components/EditableExcelSheetTable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { SheetCropThumb } from '@/components/workshop/SheetCropThumb'
import { useProjectWorkshop } from '@/hooks/use-project-workshop'
import { patchSheet, postSheetExtract } from '@/lib/api/projects'
import type { SheetJson } from '@/lib/api/projects'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import {
  buildCropsForTables,
  CROP_PAYLOAD_TOO_LARGE_MSG,
  cropPayloadOverLimit,
  EXTRACT_CROP_PROFILE,
} from '@/lib/project/crop-payload'
import {
  imageNameById,
  sheetIsReady,
  sheetsSorted,
  tablesInSheet,
} from '@/lib/project/selectors'

type Props = {
  fetchImageBlob: (imageId: string, signal?: AbortSignal) => Promise<Blob>
}

export function ProjectConvertStepView({ fetchImageBlob }: Props) {
  const { projectId, detail, setDetail } = useProjectWorkshop()
  const sheets = useMemo(() => sheetsSorted(detail), [detail])
  const imageNames = useMemo(() => imageNameById(detail), [detail])
  const [activeSheetId, setActiveSheetId] = useState<string | null>(
    sheets[0]?.id ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [runningSheetId, setRunningSheetId] = useState<string | null>(null)
  const [runningAll, setRunningAll] = useState(false)
  const [sheetErrors, setSheetErrors] = useState<Record<string, string>>({})
  const saveTimerRef = useRef<number | null>(null)
  const saveAbortRef = useRef<AbortController | null>(null)
  const pendingRowsRef = useRef<{ sheetId: string; rows: string[][] } | null>(
    null,
  )

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const pending = pendingRowsRef.current
      pendingRowsRef.current = null
      if (!pending) return
      void patchSheet(projectId, pending.sheetId, { rows: pending.rows })
        .then(setDetail)
        .catch((err) => console.error('Failed to flush sheet edit', err))
    },
    [projectId, setDetail],
  )

  useEffect(() => {
    if (activeSheetId && sheets.some((s) => s.id === activeSheetId)) return
    setActiveSheetId(sheets[0]?.id ?? null)
  }, [activeSheetId, sheets])

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? sheets[0]
  const previewJoined = Boolean(activeSheet?.rows?.length)

  const sheetStatus = (sheet: SheetJson): {
    label: string
    variant: 'secondary' | 'default' | 'destructive' | 'outline'
  } => {
    if (runningSheetId === sheet.id || (runningAll && !sheetErrors[sheet.id])) {
      return { label: '추출 중', variant: 'default' }
    }
    if (sheetErrors[sheet.id]) {
      return { label: '오류', variant: 'destructive' }
    }
    if (sheet.stale) {
      return { label: '오래됨', variant: 'outline' }
    }
    if (sheet.rows && sheet.rows.length > 0) {
      return { label: '완료', variant: 'secondary' }
    }
    return { label: '대기', variant: 'outline' }
  }

  const extractOne = useCallback(
    async (sheetId: string) => {
      const sheet = detail.sheets.find((s) => s.id === sheetId)
      if (!sheet) return
      const members = tablesInSheet(detail, sheetId)
      if (members.length === 0) {
        setSheetErrors((prev) => ({
          ...prev,
          [sheetId]: '이 시트에 표가 없습니다.',
        }))
        return
      }
      setError(null)
      setRunningSheetId(sheetId)
      setSheetErrors((prev) => {
        const next = { ...prev }
        delete next[sheetId]
        return next
      })
      try {
        const blobById = new Map<string, Blob>()
        for (const m of members) {
          blobById.set(m.imageId, await fetchImageBlob(m.imageId))
        }
        const crops = await buildCropsForTables(
          members,
          blobById,
          EXTRACT_CROP_PROFILE,
        )
        if (cropPayloadOverLimit(crops)) {
          throw new Error(CROP_PAYLOAD_TOO_LARGE_MSG)
        }
        const next = await postSheetExtract(projectId, sheetId, crops)
        setDetail(next)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setSheetErrors((prev) => ({ ...prev, [sheetId]: err.message }))
        }
      } finally {
        setRunningSheetId(null)
      }
    },
    [detail, fetchImageBlob, projectId, setDetail],
  )

  const extractAll = useCallback(async () => {
    setRunningAll(true)
    setError(null)
    try {
      for (const sheet of sheetsSorted(detail)) {
        if (sheetIsReady(sheet)) continue
        await extractOne(sheet.id)
      }
    } finally {
      setRunningAll(false)
    }
  }, [detail, extractOne])

  const scheduleRowSave = useCallback(
    (sheetId: string, rows: string[][]) => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }
      pendingRowsRef.current = { sheetId, rows }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null
        pendingRowsRef.current = null
        saveAbortRef.current?.abort()
        const ac = new AbortController()
        saveAbortRef.current = ac
        void patchSheet(projectId, sheetId, { rows }, ac.signal)
          .then((next) => {
            if (!ac.signal.aborted) setDetail(next)
          })
          .catch((err) => {
            if (err instanceof Error && err.name === 'AbortError') return
            if (err instanceof Error) setError(err.message)
          })
      }, 600)
    },
    [projectId, setDetail],
  )

  const exportSheet: ExportSheet | null = activeSheet
    ? { name: activeSheet.name, rows: activeSheet.rows ?? [] }
    : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={runningAll || sheets.length === 0}
          onClick={() => void extractAll()}
        >
          {runningAll ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PlayCircle className="size-4" />
          )}
          전체 추출
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          'grid min-h-0 flex-1 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]',
          previewJoined
            ? 'gap-0 overflow-hidden rounded-xl border border-primary/40 bg-card ring-1 ring-primary/15'
            : 'gap-3',
        )}
      >
        <div
          className={cn(
            'min-h-0 space-y-2 overflow-y-auto',
            previewJoined ? 'border-r border-primary/20 p-2' : '-m-1 p-1',
          )}
        >
          {sheets.map((sheet) => {
            const status = sheetStatus(sheet)
            const isActive = activeSheet?.id === sheet.id
            return (
              <Card
                key={sheet.id}
                onClick={() => setActiveSheetId(sheet.id)}
                className={cn(
                  'cursor-pointer',
                  isActive &&
                    (previewJoined
                      ? 'bg-primary/8 shadow-none ring-1 ring-inset ring-primary/30'
                      : 'border-primary/40 ring-1 ring-primary/20'),
                )}
              >
                <CardHeader className="space-y-1 p-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setActiveSheetId(sheet.id)}
                    >
                      <CardTitle className="truncate text-sm">{sheet.name}</CardTitle>
                    </button>
                    <Badge variant={status.variant} className="shrink-0 text-[10px]">
                      {status.label}
                    </Badge>
                  </div>
                  {sheetErrors[sheet.id] ? (
                    <p className="text-[10px] text-destructive">
                      {sheetErrors[sheet.id]}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-2 p-3 pt-0">
                  {tablesInSheet(detail, sheet.id).length > 0 ? (
                    <ul className="space-y-1">
                      {tablesInSheet(detail, sheet.id).map((table) => (
                        <li key={table.id}>
                          <SheetCropThumb
                            table={table}
                            imageName={imageNames.get(table.imageId) ?? ''}
                            fetchImageBlob={fetchImageBlob}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    className="w-full"
                    disabled={
                      runningAll ||
                      runningSheetId === sheet.id ||
                      tablesInSheet(detail, sheet.id).length === 0
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      void extractOne(sheet.id)
                    }}
                  >
                    {runningSheetId === sheet.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    추출
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Tabs
          value={activeSheet?.id ?? ''}
          onValueChange={setActiveSheetId}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          {sheets.map((s) => (
            <TabsContent
              key={s.id}
              value={s.id}
              className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              {exportSheet && activeSheet?.id === s.id ? (
                <EditableExcelSheetTable
                  sheet={exportSheet}
                  onChange={(rows) => scheduleRowSave(s.id, rows)}
                  className={cn(
                    'flex min-h-0 flex-1 flex-col',
                    previewJoined
                      ? 'border-0'
                      : 'rounded-lg border border-border',
                  )}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
                  추출을 실행하면 데이터가 표시됩니다.
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}