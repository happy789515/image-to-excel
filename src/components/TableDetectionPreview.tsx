import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Loader2, Plus, Scan, Settings } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'

import {
  EditableBBoxLayer,
  type EditableBox,
} from '@/components/EditableBBoxLayer'
import { RegionSheetStrip } from '@/components/workshop/RegionSheetStrip'
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
import { BboxCropPanel } from '@/components/BboxCropPanel'
import { PanZoomViewport } from '@/components/PanZoomViewport'
import { defaultBoxTitle, normalizeBoxTitles, withTitleOnAppend } from '@/lib/bbox/box-title'
import {
  computeFitLayout,
  defaultCenterBox,
  type ImageLayout,
} from '@/lib/bbox/geometry'
import { detectionEmptyHintMessage } from '@/lib/detection-messages'
import { putDetection, type TableJson } from '@/lib/api/projects'
import { detectTablesInImage } from '@/lib/table-detection/detector'
import type { TableDetectionBox } from '@/lib/table-detection/types'
import type { WorkflowPhaseId } from '@/lib/workflow/types'
import {
  motionInitial,
  motionTransition,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import { fadeUp, springSnappy, staggerContainerFast, staggerItem } from '@/lib/motion/variants'
import { cn } from 'cn'
import { useProjectWorkshop } from '@/hooks/use-project-workshop'
import { tablesForImage } from '@/lib/project/selectors'

type Props = {
  imageId: string
  imageUrl: string
  imageBlob: Blob | null
  serverTables: TableJson[]
  detectionMeta: {
    threshold: number
    emptyHint: boolean
    selectedId: string | null
  } | null
  onPhase?: (phase: WorkflowPhaseId, detail?: string) => void
  onBusyChange?: (busy: boolean) => void
}

type Phase = 'idle' | 'detecting' | 'done' | 'error'

function toEditable(items: TableDetectionBox[]): EditableBox[] {
  return items.map((item, index) => ({
    ...item,
    id: `det-${index}-${crypto.randomUUID()}`,
    title: defaultBoxTitle(index),
  }))
}

function tablesToEditable(tables: TableJson[]): EditableBox[] {
  return normalizeBoxTitles(
    tables.map((t) => ({
      id: t.id,
      title: t.title,
      label: t.label,
      score: t.score,
      box: t.box,
    })),
  )
}

function resolveSelectedId(
  boxes: EditableBox[],
  preferred: string | null,
): string | null {
  if (preferred && boxes.some((b) => b.id === preferred)) return preferred
  return boxes[0]?.id ?? null
}

function boxToPayload(box: EditableBox) {
  return {
    id: box.id,
    title: box.title,
    label: box.label,
    score: box.score,
    box: box.box,
  }
}

export function TableDetectionPreview(props: Props) {
  return <TableDetectionPreviewInner key={props.imageId} {...props} />
}

function TableDetectionPreviewInner({
  imageId,
  imageUrl,
  imageBlob,
  serverTables,
  detectionMeta,
  onPhase,
  onBusyChange,
}: Props) {
  const fromServer = serverTables.length > 0
  const { projectId, setDetail } = useProjectWorkshop()
  const cropSourceRef = useRef<HTMLImageElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [phase, setPhase] = useState<Phase>(fromServer ? 'done' : 'idle')
  const [boxes, setBoxes] = useState<EditableBox[]>(() =>
    fromServer ? tablesToEditable(serverTables) : [],
  )
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    fromServer
      ? resolveSelectedId(
          tablesToEditable(serverTables),
          detectionMeta?.selectedId ?? null,
        )
      : null,
  )
  const [error, setError] = useState<string | null>(() =>
    fromServer
      ? detectionEmptyHintMessage(
          serverTables.length === 0 && Boolean(detectionMeta?.emptyHint),
        )
      : null,
  )
  const [emptyHint, setEmptyHint] = useState(
    () => detectionMeta?.emptyHint ?? (fromServer ? serverTables.length === 0 : false),
  )
  const [threshold, setThreshold] = useState(
    () => detectionMeta?.threshold ?? 0.5,
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(
    null,
  )
  const [imageRevision, setImageRevision] = useState(0)
  const [fitLayout, setFitLayout] = useState<ImageLayout | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<number | null>(null)
  const saveAbortRef = useRef<AbortController | null>(null)
  const stateRef = useRef({
    threshold,
    emptyHint,
    selectedId,
    boxes,
  })

  useEffect(() => {
    stateRef.current = { threshold, emptyHint, selectedId, boxes }
  }, [boxes, emptyHint, selectedId, threshold])

  const busy = phase === 'detecting'

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  const flushDetectionSave = useCallback(async () => {
    if (phase !== 'done' && phase !== 'error') return
    saveAbortRef.current?.abort()
    const ac = new AbortController()
    saveAbortRef.current = ac
    const { threshold: th, emptyHint: eh, selectedId: sid, boxes: bx } =
      stateRef.current
    try {
      const next = await putDetection(
        projectId,
        imageId,
        {
          threshold: th,
          emptyHint: eh,
          selectedId: sid,
          boxes: bx.map(boxToPayload),
        },
        ac.signal,
      )
      if (!ac.signal.aborted) {
        setDetail(next)
        setBoxes(tablesToEditable(tablesForImage(next, imageId)))
        setSaveError(null)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (err instanceof Error) setSaveError(err.message)
    }
  }, [imageId, phase, projectId, setDetail])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void flushDetectionSave()
    }, 600)
  }, [flushDetectionSave])

  useEffect(() => {
    if (phase !== 'done') return
    scheduleSave()
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [boxes, threshold, selectedId, emptyHint, phase, scheduleSave])

  useEffect(() => {
    return () => {
      void flushDetectionSave()
    }
  }, [imageId, flushDetectionSave])

  const applyDetection = useCallback(
    (editable: EditableBox[], noTables: boolean) => {
      setBoxes(editable)
      setSelectedId(resolveSelectedId(editable, detectionMeta?.selectedId ?? null))
      setEmptyHint(noTables)
      setError(noTables ? detectionEmptyHintMessage(true) : null)
      setPhase('done')
      onPhase?.(
        'review',
        noTables
          ? '검출된 영역이 없습니다. 영역을 추가하세요.'
          : '영역을 확인한 뒤 시트 그룹 단계로 이동하세요.',
      )
    },
    [detectionMeta?.selectedId, onPhase],
  )

  const runDetection = useCallback(
    async (isStale?: () => boolean) => {
      if (!imageBlob) return
      setError(null)
      setEmptyHint(false)
      setSaveError(null)
      try {
        setPhase('detecting')
        onPhase?.('detecting', '브라우저 ONNX 모델로 표 bbox를 검출하는 중…')
        const file =
          imageBlob instanceof File
            ? imageBlob
            : new File([imageBlob], 'image', { type: imageBlob.type })
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
    [applyDetection, imageBlob, onPhase, threshold],
  )

  useEffect(() => {
    if (fromServer) {
      onPhase?.('review', '저장된 표 영역을 불러왔습니다.')
      return
    }
    if (!imageBlob) return
    let cancelled = false
    const file =
      imageBlob instanceof File
        ? imageBlob
        : new File([imageBlob], 'image', { type: imageBlob.type })

    void Promise.resolve()
      .then(() => {
        if (cancelled) return
        setError(null)
        setEmptyHint(false)
        setSaveError(null)
        setPhase('detecting')
        onPhase?.('detecting', '브라우저 ONNX 모델로 표 bbox를 검출하는 중…')
        return detectTablesInImage(file, { threshold })
      })
      .then((result) => {
        if (cancelled || !result) return
        const editable = toEditable(result)
        setBoxes(editable)
        setSelectedId(
          resolveSelectedId(editable, detectionMeta?.selectedId ?? null),
        )
        setEmptyHint(result.length === 0)
        setError(detectionEmptyHintMessage(result.length === 0))
        setPhase('done')
        onPhase?.(
          'review',
          result.length === 0
            ? '검출된 영역이 없습니다. 영역을 추가하세요.'
            : '영역을 확인한 뒤 시트 그룹 단계로 이동하세요.',
        )
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setPhase('error')
        setError('표 검출 중 오류가 발생했습니다.')
        onPhase?.('error', '표 검출 실패')
      })

    return () => {
      cancelled = true
    }
    // Auto-detect once per image mount; threshold changes use manual re-detect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- imageId reset via outer key
  }, [fromServer, imageBlob])

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

  const reduced = useReducedMotion()
  const stepTransition = motionTransition(reduced, springSnappy)

  const alerts = useMemo(() => {
    const items: string[] = []
    if (error) items.push(error)
    if (saveError) items.push(saveError)
    return items
  }, [error, saveError])

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

      <AnimatePresence initial={false}>
        {alerts.map((msg) => (
          <m.div
            key={msg}
            variants={fadeUp}
            initial={motionInitial(reduced)}
            animate="animate"
            exit="exit"
            transition={stepTransition}
          >
            <Alert variant="destructive">
              <AlertDescription>{msg}</AlertDescription>
            </Alert>
          </m.div>
        ))}
      </AnimatePresence>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden">
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
              imageId={imageId}
              threshold={threshold}
              busy={busy || !imageBlob}
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
                  onLoad={() => refreshFitLayout()}
                />
                {fitLayout ? (
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

      {boxes.length > 0 ? (
        <m.div
          variants={staggerContainerFast}
          initial={motionInitial(reduced)}
          animate="animate"
        >
          <m.div variants={staggerItem} transition={stepTransition}>
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
            />
          </m.div>
        </m.div>
      ) : null}
    </div>
  )
}

function DetectToolbar({
  imageId,
  threshold,
  busy,
  naturalSize,
  onThreshold,
  onAddBox,
  onRedetect,
  detecting,
}: {
  imageId: string
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
              htmlFor={`th-${imageId}`}
              className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
            >
              {threshold.toFixed(2)}
            </Label>
            <Slider
              id={`th-${imageId}`}
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