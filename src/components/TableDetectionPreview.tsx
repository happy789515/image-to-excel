import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  Download,
  Image,
  Loader2,
  Plus,
  Scan,
  Settings,
  Table2,
} from 'lucide-react'

import {
  EditableBBoxLayer,
  type EditableBox,
} from '@/components/EditableBBoxLayer'
import { ConvertStepView } from '@/components/workshop/ConvertStepView'
import { RegionSheetStrip } from '@/components/workshop/RegionSheetStrip'
import { ReviewStepView } from '@/components/workshop/ReviewStepView'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { defaultBoxTitle, withTitleOnAppend } from '@/lib/bbox/box-title'
import {
  computeFitLayout,
  defaultCenterBox,
  type ImageLayout,
} from '@/lib/bbox/geometry'
import {
  detectionEmptyHintMessage,
  loadDetectionResult,
  persistDetectionResult,
} from '@/lib/detection-persist'
import {
  exportSessionMatches,
  exportStillValid,
  boxesGeometrySignature,
} from '@/lib/workshop-export-signature'
import {
  getWorkshopHydration,
  setWorkshopHydration,
} from '@/lib/workshop-hydration-cache'
import {
  loadWorkshopSession,
  persistWorkshopSession,
  resolveWorkshopStepAfterRestore,
} from '@/lib/workshop-persist'
import type { StoredDetection } from '@/lib/detection-persist'
import type { StoredWorkshopSession } from '@/lib/workshop-persist'
import { BboxCropPanel } from '@/components/BboxCropPanel'
import {
  TableExportActions,
  TableExportStatus,
  type ExportReady,
} from '@/components/TableExportPanel'
import { useTableExport } from '@/hooks/use-table-export'
import { buildXlsxBlob } from '@/lib/excel/build-xlsx'
import type { ExportSheet } from '@/lib/excel/build-xlsx'
import { detectTablesInImage } from '@/lib/table-detection/detector'
import type { TableDetectionBox } from '@/lib/table-detection/types'
import type { WorkshopStepBridge } from '@/lib/workflow/workshop-step-bridge'
import {
  type WorkshopStepId,
} from '@/lib/workflow/workshop-steps'
import type { WorkflowPhaseId } from '@/lib/workflow/types'
import type { StepAccess } from '@/components/workshop/WorkflowStepBar'
import { PanZoomViewport } from '@/components/PanZoomViewport'
import { cn } from 'cn'

type Props = {
  fileId: string
  imageUrl: string
  file: File
  onPhase?: (phase: WorkflowPhaseId, detail?: string) => void
  onStepBridgeChange?: (bridge: WorkshopStepBridge | null) => void
}

type Phase = 'idle' | 'detecting' | 'done' | 'error'

function toEditable(items: TableDetectionBox[]): EditableBox[] {
  return items.map((item, index) => ({
    ...item,
    id: `det-${index}-${crypto.randomUUID()}`,
    title: defaultBoxTitle(index),
  }))
}

function resolveSelectedId(
  boxes: EditableBox[],
  preferred: string | null,
): string | null {
  if (preferred && boxes.some((b) => b.id === preferred)) return preferred
  return boxes[0]?.id ?? null
}

export function TableDetectionPreview({
  fileId,
  imageUrl,
  file,
  onPhase,
  onStepBridgeChange,
}: Props) {
  /** Canvas crop source — always decodable (detect grid may be max-h-0 on convert). */
  const cropSourceRef = useRef<HTMLImageElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [workshopStep, setWorkshopStep] = useState<WorkshopStepId>('detect')
  const [boxes, setBoxes] = useState<EditableBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emptyHint, setEmptyHint] = useState(false)
  const [threshold, setThreshold] = useState(0.5)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(
    null,
  )
  const [imageRevision, setImageRevision] = useState(0)
  const [fitLayout, setFitLayout] = useState<ImageLayout | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [cacheReady, setCacheReady] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const skipAutoOnceRef = useRef(false)
  const workshopStepRef = useRef<WorkshopStepId>('detect')
  const onPhaseRef = useRef(onPhase)
  const [exportSheets, setExportSheets] = useState<ExportSheet[] | null>(null)
  const [downloadFileName, setDownloadFileName] = useState('')
  const [exportSignature, setExportSignature] = useState<string | null>(null)
  const [reviewCommitted, setReviewCommitted] = useState(false)
  const [reviewDirty, setReviewDirty] = useState(false)
  const [discardReviewOpen, setDiscardReviewOpen] = useState(false)
  const pendingStepRef = useRef<WorkshopStepId | null>(null)

  useEffect(() => {
    onPhaseRef.current = onPhase
  }, [onPhase])

  useEffect(() => {
    workshopStepRef.current = workshopStep
  }, [workshopStep])

  const exportBlob = useMemo(() => {
    if (!exportSheets?.length) return null
    return buildXlsxBlob(exportSheets)
  }, [exportSheets])

  const activeSheetIndex = useMemo(() => {
    if (!selectedId) return 0
    const idx = boxes.findIndex((b) => b.id === selectedId)
    return idx >= 0 ? idx : 0
  }, [boxes, selectedId])

  const exportStale =
    exportSheets !== null && !exportStillValid(boxes, exportSignature)

  const resetExport = useCallback(() => {
    setExportSheets(null)
    setDownloadFileName('')
    setExportSignature(null)
    setReviewCommitted(false)
    setReviewDirty(false)
  }, [])

  useEffect(() => {
    if (
      exportSheets === null ||
      exportSignature === null ||
      exportStillValid(boxes, exportSignature)
    ) {
      return
    }
    const step = workshopStep
    queueMicrotask(() => {
      resetExport()
      if (step === 'review') setWorkshopStep('convert')
    })
  }, [boxes, exportSheets, exportSignature, resetExport, workshopStep])

  const refreshFitLayout = useCallback(() => {
    const host = viewportRef.current
    const source = cropSourceRef.current
    if (!host || !source?.naturalWidth) return
    const rect = host.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    setFitLayout(
      computeFitLayout(
        source.naturalWidth,
        source.naturalHeight,
        rect.width,
        rect.height,
      ),
    )
    setImageRevision((n) => n + 1)
  }, [])

  const onCropSourceLoad = useCallback(
    (img: HTMLImageElement) => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
      setImageRevision((n) => n + 1)
      refreshFitLayout()
    },
    [refreshFitLayout],
  )

  useEffect(() => {
    const host = viewportRef.current
    if (!host) return undefined
    const observer = new ResizeObserver(() => refreshFitLayout())
    observer.observe(host)
    return () => observer.disconnect()
  }, [refreshFitLayout, imageUrl])

  useEffect(() => {
    const source = cropSourceRef.current
    if (source?.complete && source.naturalWidth > 0) {
      onCropSourceLoad(source)
    }
  }, [imageUrl, onCropSourceLoad])

  const applyDetection = useCallback(
    (editable: EditableBox[], noTables: boolean) => {
      setBoxes(editable)
      setSelectedId(resolveSelectedId(editable, null))
      setEmptyHint(noTables)
      setError(noTables ? detectionEmptyHintMessage(true) : null)
      setPhase('done')
      onPhase?.(
        'review',
        noTables
          ? '검출된 영역이 없습니다. 영역을 추가하세요.'
          : '영역을 확인한 뒤 엑셀 변환 단계로 이동하세요.',
      )
    },
    [onPhase],
  )

  const runDetection = useCallback(
    async (isStale?: () => boolean, invalidateDownstream = false) => {
      if (invalidateDownstream) resetExport()
      setError(null)
      setEmptyHint(false)
      try {
        setPhase('detecting')
        onPhase?.('detecting', '브라우저 ONNX 모델로 표 bbox를 검출하는 중…')
        const result = await detectTablesInImage(file, { threshold })
        if (isStale?.()) return
        const editable = toEditable(result)
        applyDetection(editable, result.length === 0)
      } catch (err) {
        if (isStale?.()) return
        console.error(err)
        setPhase('error')
        setError('표 검출 중 오류가 발생했습니다.')
        onPhase?.('error', '표 검출 실패')
      }
    },
    [applyDetection, file, resetExport, threshold, onPhase],
  )

  useEffect(() => {
    let cancelled = false
    skipAutoOnceRef.current = false

    const applyBundle = (
      saved: StoredDetection | null,
      session: StoredWorkshopSession | null,
    ) => {
      const boxesForSession = saved?.boxes ?? []

      if (saved) {
        skipAutoOnceRef.current = true
        setThreshold(saved.threshold)
        setBoxes(saved.boxes)
        setSelectedId(resolveSelectedId(saved.boxes, saved.selectedId))
        setEmptyHint(saved.emptyHint)
        setError(detectionEmptyHintMessage(saved.emptyHint))
        setPhase('done')
        onPhaseRef.current?.(
          'review',
          '이전 검출 결과를 복원했습니다. 필요하면 다시 검출하세요.',
        )
      } else {
        setWorkshopStep('detect')
        resetExport()
      }

      if (session) {
        const exportOk = exportSessionMatches(session, boxesForSession)
        if (exportOk) {
          setExportSheets(session.exportSheets)
          setDownloadFileName(session.downloadFileName)
          setExportSignature(session.exportSignature)
        } else {
          resetExport()
        }
        setReviewCommitted(Boolean(session.reviewCommitted) && exportOk)
        setWorkshopStep(
          resolveWorkshopStepAfterRestore(session.workshopStep, exportOk),
        )
      } else if (saved) {
        setWorkshopStep('detect')
        setReviewCommitted(false)
      }
    }

    const finishHydration = () => {
      if (cancelled) return
      setCacheReady(true)
      setSessionReady(true)
    }

    const cached = getWorkshopHydration(fileId)
    if (cached) {
      queueMicrotask(() => {
        if (cancelled) return
        applyBundle(cached.detection, cached.session)
        finishHydration()
      })
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      try {
        const [saved, session] = await Promise.all([
          loadDetectionResult(fileId),
          loadWorkshopSession(fileId),
        ])
        if (cancelled) return

        const bundle = { detection: saved, session }
        setWorkshopHydration(fileId, bundle)
        queueMicrotask(() => {
          if (cancelled) return
          applyBundle(saved, session)
          finishHydration()
        })
      } catch (err) {
        console.error(err)
        finishHydration()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fileId, resetExport])

  useEffect(() => {
    if (!cacheReady) return
    if (skipAutoOnceRef.current) {
      skipAutoOnceRef.current = false
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      void runDetection(() => cancelled)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cacheReady + fileId
  }, [cacheReady, fileId])

  useEffect(() => {
    if (!cacheReady || phase !== 'done') return undefined

    const handle = window.setTimeout(() => {
      void persistDetectionResult({
        fileId,
        threshold,
        selectedId,
        boxes,
        emptyHint,
      }).catch((err) => console.error(err))
    }, 400)

    return () => window.clearTimeout(handle)
  }, [fileId, boxes, threshold, selectedId, emptyHint, phase, cacheReady])

  useEffect(() => {
    if (!sessionReady) return undefined

    const handle = window.setTimeout(() => {
      const payload = {
        fileId,
        workshopStep,
        exportSheets,
        downloadFileName,
        exportSignature,
        reviewCommitted,
      }
      const cached = getWorkshopHydration(fileId)
      if (cached) {
        setWorkshopHydration(fileId, {
          ...cached,
          session: { ...payload, updatedAt: Date.now() },
        })
      }
      void persistWorkshopSession(payload).catch((err) => console.error(err))
    }, 400)

    return () => window.clearTimeout(handle)
  }, [
    fileId,
    workshopStep,
    exportSheets,
    downloadFileName,
    exportSignature,
    reviewCommitted,
    sessionReady,
  ])

  const addManualBox = useCallback(() => {
    if (!naturalSize) return
    const box = defaultCenterBox(naturalSize.w, naturalSize.h)
    const id = `manual-${crypto.randomUUID()}`
    setBoxes((prev) => [
      ...prev,
      withTitleOnAppend(prev, {
        id,
        label: 'table',
        score: 0,
        box,
      }),
    ])
    setSelectedId(id)
    setPhase('done')
    setEmptyHint(false)
    setError(null)
  }, [naturalSize])

  const removeBoxById = useCallback(
    (id: string) => {
      let nextBoxes: EditableBox[] = []
      setBoxes((prev) => {
        nextBoxes = prev.filter((item) => item.id !== id)
        return nextBoxes
      })
      setSelectedId(
        resolveSelectedId(nextBoxes, selectedId === id ? null : selectedId),
      )
      if (nextBoxes.length === 0) {
        setEmptyHint(true)
        setError(detectionEmptyHintMessage(true))
      }
    },
    [selectedId],
  )

  const onExportReady = useCallback(
    (result: ExportReady | null) => {
      if (!result) {
        resetExport()
        return
      }
      const signature = boxesGeometrySignature(boxes)
      setExportSheets(result.sheets)
      setDownloadFileName(result.downloadFileName)
      setExportSignature(signature)
      setReviewCommitted(false)
      const sessionPayload = {
        fileId,
        workshopStep: workshopStepRef.current,
        exportSheets: result.sheets,
        downloadFileName: result.downloadFileName,
        exportSignature: signature,
        reviewCommitted: false,
      }
      const cached = getWorkshopHydration(fileId)
      if (cached) {
        setWorkshopHydration(fileId, {
          ...cached,
          session: { ...sessionPayload, updatedAt: Date.now() },
        })
      }
      void persistWorkshopSession(sessionPayload).catch((err) =>
        console.error(err),
      )
    },
    [boxes, fileId, resetExport],
  )

  const exportCtrl = useTableExport({
    file,
    boxes,
    onPhase,
    onExportReady,
  })
  const { converting } = exportCtrl

  const navigateStepInner = useCallback(
    (target: WorkshopStepId) => {
      if (target === 'detect') {
        setWorkshopStep('detect')
        return
      }
      if (target === 'convert' && boxes.length > 0) {
        setWorkshopStep('convert')
        setImageRevision((n) => n + 1)
        return
      }
      if (
        target === 'review' &&
        exportSheets?.length &&
        exportBlob &&
        !exportStale
      ) {
        setReviewDirty(false)
        setWorkshopStep('review')
      }
    },
    [boxes.length, exportBlob, exportSheets?.length, exportStale],
  )

  const attemptNavigateStep = useCallback(
    (target: WorkshopStepId) => {
      if (workshopStep === 'review' && reviewDirty && target !== 'review') {
        pendingStepRef.current = target
        setDiscardReviewOpen(true)
        return
      }
      navigateStepInner(target)
    },
    [navigateStepInner, reviewDirty, workshopStep],
  )

  const handleReviewCommit = useCallback(
    (sheets: ExportSheet[]) => {
      setExportSheets(sheets)
      setReviewCommitted(true)
      setReviewDirty(false)
      const payload = {
        fileId,
        workshopStep,
        exportSheets: sheets,
        downloadFileName,
        exportSignature,
        reviewCommitted: true,
      }
      const cached = getWorkshopHydration(fileId)
      if (cached) {
        setWorkshopHydration(fileId, {
          ...cached,
          session: { ...payload, updatedAt: Date.now() },
        })
      }
      void persistWorkshopSession(payload).catch((err) => console.error(err))
    },
    [
      downloadFileName,
      exportSignature,
      fileId,
      workshopStep,
    ],
  )

  const handleConvertSheetsChange = useCallback(
    (sheets: ExportSheet[]) => {
      setExportSheets(sheets)
      setReviewCommitted(false)
      setReviewDirty(false)
    },
    [],
  )

  const confirmDiscardReview = useCallback(() => {
    setReviewDirty(false)
    const target = pendingStepRef.current
    pendingStepRef.current = null
    setDiscardReviewOpen(false)
    if (target) navigateStepInner(target)
  }, [navigateStepInner])

  const busy = phase === 'detecting' || converting

  const stepAccess: StepAccess = useMemo(
    () => ({
      detect: true,
      convert: boxes.length > 0 && phase !== 'detecting',
      review:
        Boolean(exportSheets?.length && exportBlob && !exportStale) && !converting,
    }),
    [boxes.length, converting, exportBlob, exportSheets?.length, exportStale, phase],
  )

  useEffect(() => {
    onStepBridgeChange?.({
      current: workshopStep,
      access: stepAccess,
      busy,
      navigate: attemptNavigateStep,
      reviewDirty,
      reviewCommitted,
    })
    return () => onStepBridgeChange?.(null)
  }, [
    attemptNavigateStep,
    busy,
    onStepBridgeChange,
    reviewCommitted,
    reviewDirty,
    stepAccess,
    workshopStep,
  ])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <img
        ref={cropSourceRef}
        src={imageUrl}
        alt=""
        width={1}
        height={1}
        decoding="async"
        loading="eager"
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 opacity-0"
        onLoad={(e) => onCropSourceLoad(e.currentTarget)}
      />
      {workshopStep === 'detect' && error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          'grid min-h-0 gap-3 overflow-hidden lg:grid-cols-2',
          workshopStep === 'detect'
            ? 'min-h-0 flex-1'
            : 'pointer-events-none max-h-0 min-h-0 overflow-hidden opacity-0',
        )}
        aria-hidden={workshopStep !== 'detect'}
      >
        <section
          aria-label="원본 이미지"
          className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="flex items-center gap-1.5">
              <Image className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="text-sm font-semibold tracking-tight text-foreground">
                원본
              </span>
            </p>
            <DetectToolbar
              fileId={fileId}
              threshold={threshold}
              busy={busy}
              naturalSize={naturalSize}
              onThreshold={setThreshold}
              onAddBox={addManualBox}
              onRedetect={() => void runDetection(undefined, true)}
              detecting={phase === 'detecting'}
            />
          </div>
          <div
            ref={viewportRef}
            className="flex h-full min-h-0 flex-1 overflow-hidden p-2"
          >
            <PanZoomViewport
              className="min-h-0 flex-1"
              minimap={{ kind: 'image', src: imageUrl }}
              resetKey={`${imageUrl}:${fitLayout?.renderedW ?? 0}:${fitLayout?.renderedH ?? 0}`}
            >
              <div
                className="relative shrink-0"
                style={
                  fitLayout
                    ? {
                        width: fitLayout.renderedW,
                        height: fitLayout.renderedH,
                      }
                    : undefined
                }
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="업로드한 이미지"
                  width={naturalSize?.w}
                  height={naturalSize?.h}
                  className={
                    fitLayout
                      ? 'block size-full'
                      : 'block max-h-full max-w-full object-contain'
                  }
                  draggable={false}
                  onLoad={() => refreshFitLayout()}
                />
                {fitLayout && workshopStep === 'detect' ? (
                  <EditableBBoxLayer
                    boxes={boxes}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onChange={setBoxes}
                    onRemove={removeBoxById}
                    imageRef={imgRef}
                  />
                ) : null}
              </div>
            </PanZoomViewport>
          </div>
        </section>

        <section
          aria-label="잘라낸 미리보기"
          className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-3"
        >
          <BboxCropPanel
            imageRef={cropSourceRef}
            imageRevision={imageRevision}
            boxes={boxes}
            selectedId={selectedId}
          />
        </section>
      </div>

      {workshopStep === 'detect' && boxes.length > 0 ? (
        <RegionSheetStrip
          imageRef={cropSourceRef}
          imageRevision={imageRevision}
          boxes={boxes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onTitleChange={(id, title) => {
            setBoxes((prev) =>
              prev.map((item) => (item.id === id ? { ...item, title } : item)),
            )
          }}
          onDelete={removeBoxById}
          action={
            <Button
              type="button"
              className="h-full min-h-[7.5rem] shrink-0 flex-col gap-2 px-4"
              disabled={boxes.length === 0 || phase === 'detecting'}
              onClick={() => attemptNavigateStep('convert')}
            >
              <Table2 className="size-5" aria-hidden />
              <span className="flex items-center gap-0.5">
                엑셀 변환
                <ChevronRight className="size-4" aria-hidden />
              </span>
            </Button>
          }
        />
      ) : null}

      {workshopStep === 'convert' ? (
        <>
          <ConvertStepView
            imageRef={cropSourceRef}
            imageRevision={imageRevision}
            boxes={boxes}
            selectedId={selectedId}
            onSelectBox={setSelectedId}
            sheets={exportStale ? null : exportSheets}
            activeSheetIndex={activeSheetIndex}
            onSelectSheetIndex={(index) => {
              setSelectedId(boxes[index]?.id ?? null)
            }}
            onSheetsChange={handleConvertSheetsChange}
            converting={converting}
            exportActions={<TableExportActions {...exportCtrl} size="xs" />}
            sheetStripAction={
              <Button
                type="button"
                className="h-full min-h-[7.5rem] shrink-0 flex-col gap-2 px-4"
                disabled={
                  !exportSheets?.length ||
                  exportStale ||
                  converting ||
                  !exportBlob
                }
                onClick={() => attemptNavigateStep('review')}
              >
                <Download className="size-5" aria-hidden />
                <span className="flex items-center gap-0.5">
                  검수 및 다운로드
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              </Button>
            }
          />

          <TableExportStatus {...exportCtrl} />
        </>
      ) : null}

      {workshopStep === 'review' && exportSheets && exportBlob ? (
        <ReviewStepView
          committedSheets={exportSheets}
          activeIndex={activeSheetIndex}
          onSelectIndex={(index) => setSelectedId(boxes[index]?.id ?? null)}
          downloadFileName={downloadFileName}
          reviewCommitted={reviewCommitted}
          onDirtyChange={setReviewDirty}
          onCommit={handleReviewCommit}
        />
      ) : null}

      <Dialog open={discardReviewOpen} onOpenChange={setDiscardReviewOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>저장되지 않은 변경사항</DialogTitle>
            <DialogDescription>
              검수 단계에서 수정한 내용이 아직 저장되지 않았습니다. 저장하지 않고
              이동하면 변경 사항이 사라집니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                pendingStepRef.current = null
                setDiscardReviewOpen(false)
              }}
            >
              취소
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDiscardReview}>
              저장 안 함
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetectToolbar({
  fileId,
  threshold,
  busy,
  naturalSize,
  onThreshold,
  onAddBox,
  onRedetect,
  detecting,
}: {
  fileId: string
  threshold: number
  busy: boolean
  naturalSize: { w: number; h: number } | null
  onThreshold: (v: number) => void
  onAddBox: () => void
  onRedetect: () => void
  detecting: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Popover>
        <PopoverTrigger
          type="button"
          disabled={busy}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          <Settings className="size-3.5" aria-hidden />
          설정
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-56">
          <PopoverHeader>
            <PopoverTitle>검출 임계값</PopoverTitle>
            <PopoverDescription>
              높을수록 확실한 표만 검출합니다.
            </PopoverDescription>
          </PopoverHeader>
          <div className="flex items-center gap-2">
            <Label
              htmlFor={`th-${fileId}`}
              className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
            >
              {threshold.toFixed(2)}
            </Label>
            <Slider
              id={`th-${fileId}`}
              min={0.2}
              max={0.95}
              step={0.05}
              value={[threshold]}
              disabled={busy}
              onValueChange={(v) => {
                const next = Array.isArray(v) ? v[0] : v
                if (typeof next === 'number') onThreshold(next)
              }}
              className="min-w-0 flex-1"
            />
          </div>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!naturalSize}
        onClick={onAddBox}
      >
        <Plus aria-hidden />
        영역 추가
      </Button>
      <Button type="button" size="sm" disabled={busy} onClick={onRedetect}>
        {detecting ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Scan aria-hidden />
        )}
        {detecting ? '검출 중…' : '다시 검출'}
      </Button>
    </div>
  )
}