import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  ChevronRight,
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
import { BboxCropPanel } from '@/components/BboxCropPanel'
import {
  TableExportPanel,
  type ExportReady,
} from '@/components/TableExportPanel'
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

function boxesSignature(boxes: EditableBox[]): string {
  return boxes
    .map(
      (b) =>
        `${b.id}:${b.title}:${b.box.xmin},${b.box.ymin},${b.box.xmax},${b.box.ymax}`,
    )
    .join('|')
}

export function TableDetectionPreview({
  fileId,
  imageUrl,
  file,
  onPhase,
  onStepBridgeChange,
}: Props) {
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
  const skipAutoOnceRef = useRef(false)
  const detectionHydratedFileIdRef = useRef<string | null>(null)
  const [exportSheets, setExportSheets] = useState<ExportSheet[] | null>(null)
  const [downloadFileName, setDownloadFileName] = useState('')
  const [exportSignature, setExportSignature] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)

  const boxesSig = useMemo(() => boxesSignature(boxes), [boxes])

  const exportBlob = useMemo(() => {
    if (!exportSheets?.length) return null
    return buildXlsxBlob(exportSheets)
  }, [exportSheets])

  const activeSheetIndex = useMemo(() => {
    if (!selectedId) return 0
    const idx = boxes.findIndex((b) => b.id === selectedId)
    return idx >= 0 ? idx : 0
  }, [boxes, selectedId])

  const exportStale = exportSheets !== null && exportSignature !== boxesSig

  const resetExport = useCallback(() => {
    setExportSheets(null)
    setDownloadFileName('')
    setExportSignature(null)
  }, [])

  useEffect(() => {
    setWorkshopStep('detect')
    resetExport()
  }, [fileId, resetExport])

  useEffect(() => {
    if (exportSignature !== null && exportSignature !== boxesSig) {
      resetExport()
      if (workshopStep === 'review') setWorkshopStep('convert')
    }
  }, [boxesSig, exportSignature, resetExport, workshopStep])

  const refreshFitLayout = useCallback(() => {
    const host = viewportRef.current
    const img = imgRef.current
    if (!host || !img?.naturalWidth) return
    const rect = host.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    setFitLayout(
      computeFitLayout(
        img.naturalWidth,
        img.naturalHeight,
        rect.width,
        rect.height,
      ),
    )
    setImageRevision((n) => n + 1)
  }, [])

  const onImageLoad = useCallback(
    (img: HTMLImageElement) => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
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
    async (isStale?: () => boolean) => {
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
    [applyDetection, file, threshold, onPhase],
  )

  useEffect(() => {
    let cancelled = false
    skipAutoOnceRef.current = false

    if (detectionHydratedFileIdRef.current === fileId) {
      setCacheReady(true)
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      try {
        const saved = await loadDetectionResult(fileId)
        if (cancelled) return
        if (saved) {
          skipAutoOnceRef.current = true
          setThreshold(saved.threshold)
          setBoxes(saved.boxes)
          setSelectedId(resolveSelectedId(saved.boxes, saved.selectedId))
          setEmptyHint(saved.emptyHint)
          setError(detectionEmptyHintMessage(saved.emptyHint))
          setPhase('done')
          onPhase?.(
            'review',
            '이전 검출 결과를 복원했습니다. 필요하면 다시 검출하세요.',
          )
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) {
          detectionHydratedFileIdRef.current = fileId
          setCacheReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fileId, onPhase])

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
      setExportSheets(result.sheets)
      setDownloadFileName(result.downloadFileName)
      setExportSignature(boxesSig)
    },
    [boxesSig, resetExport],
  )

  const navigateStep = useCallback(
    (target: WorkshopStepId) => {
      if (target === 'detect') {
        if (workshopStep === 'review') resetExport()
        setWorkshopStep('detect')
        return
      }
      if (target === 'convert' && boxes.length > 0) {
        setWorkshopStep('convert')
        return
      }
      if (
        target === 'review' &&
        exportSheets?.length &&
        exportBlob &&
        !exportStale
      ) {
        setWorkshopStep('review')
      }
    },
    [
      boxes.length,
      exportBlob,
      exportSheets?.length,
      exportStale,
      resetExport,
      workshopStep,
    ],
  )

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
      navigate: navigateStep,
    })
    return () => onStepBridgeChange?.(null)
  }, [busy, navigateStep, onStepBridgeChange, stepAccess, workshopStep])

  const handleExportReady = onExportReady

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {workshopStep === 'detect' && error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          'grid min-h-0 gap-3 overflow-hidden lg:grid-cols-2',
          workshopStep === 'detect' ? 'min-h-0 flex-1' : 'hidden',
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
              onRedetect={() => void runDetection()}
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
                  onLoad={(e) => onImageLoad(e.currentTarget)}
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
            imageRef={imgRef}
            imageRevision={imageRevision}
            boxes={boxes}
            selectedId={selectedId}
          />
        </section>
      </div>

      {workshopStep === 'detect' && boxes.length > 0 ? (
        <RegionSheetStrip
          imageRef={imgRef}
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
              onClick={() => navigateStep('convert')}
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
            imageRef={imgRef}
            imageRevision={imageRevision}
            boxes={boxes}
            selectedId={selectedId}
            onSelectBox={setSelectedId}
            sheets={exportStale ? null : exportSheets}
            activeSheetIndex={activeSheetIndex}
            onSelectSheetIndex={(index) => {
              setSelectedId(boxes[index]?.id ?? null)
            }}
            onSheetsChange={setExportSheets}
            converting={converting}
          />

          <div className="shrink-0 space-y-2 rounded-lg border border-border bg-card p-3">
            <TableExportPanel
              file={file}
              boxes={boxes}
              onPhase={onPhase}
              onExportReady={handleExportReady}
              onConvertingChange={setConverting}
              embedded
            />
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={converting}
              onClick={() => navigateStep('detect')}
            >
              표 검출로
            </Button>
            <Button
              type="button"
              disabled={
                !exportSheets?.length || exportStale || converting || !exportBlob
              }
              onClick={() => navigateStep('review')}
            >
              검수 및 다운로드
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </footer>
        </>
      ) : null}

      {workshopStep === 'review' && exportSheets && exportBlob ? (
        <ReviewStepView
          sheets={exportSheets}
          activeIndex={activeSheetIndex}
          onSelectIndex={(index) => setSelectedId(boxes[index]?.id ?? null)}
          blob={exportBlob}
          downloadFileName={downloadFileName}
          onBackToConvert={() => setWorkshopStep('convert')}
          onBackToDetect={() => {
            resetExport()
            setWorkshopStep('detect')
          }}
        />
      ) : null}
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