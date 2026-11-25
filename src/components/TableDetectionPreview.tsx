import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Scan, Trash2 } from 'lucide-react'

import {
  EditableBBoxLayer,
  type EditableBox,
} from '@/components/EditableBBoxLayer'
import { Button } from '@/components/ui/button'
import { defaultBoxTitle, withTitleOnAppend } from '@/lib/bbox/box-title'
import { defaultCenterBox } from '@/lib/bbox/geometry'
import {
  detectionEmptyHintMessage,
  loadDetectionResult,
  persistDetectionResult,
} from '@/lib/detection-persist'
import { TableExportPanel } from '@/components/TableExportPanel'
import { detectTablesInImage } from '@/lib/table-detection/detector'
import type { TableDetectionBox } from '@/lib/table-detection/types'

type Props = {
  fileId: string
  imageUrl: string
  file: File
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

export function TableDetectionPreview({ fileId, imageUrl, file }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [boxes, setBoxes] = useState<EditableBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emptyHint, setEmptyHint] = useState(false)
  const [threshold, setThreshold] = useState(0.5)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(
    null,
  )
  const [cacheReady, setCacheReady] = useState(false)
  const skipAutoOnceRef = useRef(false)

  const onImageLoad = useCallback((img: HTMLImageElement) => {
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
  }, [])

  const applyDetection = useCallback(
    (editable: EditableBox[], noTables: boolean) => {
      setBoxes(editable)
      setSelectedId(resolveSelectedId(editable, null))
      setEmptyHint(noTables)
      setError(noTables ? detectionEmptyHintMessage(true) : null)
      setPhase('done')
    },
    [],
  )

  const runDetection = useCallback(
    async (isStale?: () => boolean) => {
      setError(null)
      setEmptyHint(false)
      try {
        setPhase('detecting')
        const result = await detectTablesInImage(file, { threshold })
        if (isStale?.()) return
        const editable = toEditable(result)
        applyDetection(editable, result.length === 0)
      } catch (err) {
        if (isStale?.()) return
        console.error(err)
        setPhase('error')
        setError('표 검출 중 오류가 발생했습니다.')
      }
    },
    [applyDetection, file, threshold],
  )

  useEffect(() => {
    let cancelled = false
    skipAutoOnceRef.current = false

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
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setCacheReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fileId])

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
    // fileId change handled by cache load; threshold changes do not re-auto.
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
  }, [
    fileId,
    boxes,
    threshold,
    selectedId,
    emptyHint,
    phase,
    cacheReady,
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
  }, [naturalSize, setBoxes, setSelectedId])

  const removeSelected = useCallback(() => {
    if (!selectedId) return
    setBoxes((prev) => prev.filter((item) => item.id !== selectedId))
    setSelectedId(null)
  }, [selectedId])

  const busy = phase === 'detecting'

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">표 검출 · 영역 편집</p>
          <p className="text-xs text-muted-foreground">
            드래그로 이동, 모서리로 크기 조절, 영역 추가·삭제
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label
            className="text-xs text-muted-foreground"
            htmlFor={`th-${fileId}`}
          >
            임계값 {threshold.toFixed(2)}
          </label>
          <input
            id={`th-${fileId}`}
            type="range"
            min={0.2}
            max={0.95}
            step={0.05}
            value={threshold}
            disabled={busy}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-24 accent-primary"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!naturalSize}
            onClick={addManualBox}
          >
            <Plus aria-hidden />
            영역 추가
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selectedId}
            onClick={removeSelected}
          >
            <Trash2 aria-hidden />
            선택 삭제
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void runDetection()}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Scan aria-hidden />
            )}
            {phase === 'detecting' ? '검출 중…' : '다시 검출'}
          </Button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg bg-muted/40 p-2">
        <div className="relative mx-auto w-fit max-w-full">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="업로드한 이미지"
            className="max-h-[min(70vh,640px)] w-auto max-w-full object-contain"
            onLoad={(e) => onImageLoad(e.currentTarget)}
          />
          <EditableBBoxLayer
            boxes={boxes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={setBoxes}
            imageRef={imgRef}
          />
        </div>
      </div>

      {boxes.length > 0 ? (
        <ul className="space-y-2" aria-live="polite">
          {boxes.map((b, i) => (
            <li
              key={b.id}
              className={
                b.id === selectedId
                  ? 'rounded-lg border border-primary/40 bg-primary/5 px-2 py-1.5'
                  : 'px-2 py-1.5'
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-foreground">#{i + 1}</span>
                <label className="sr-only" htmlFor={`title-${b.id}`}>
                  시트 이름
                </label>
                <input
                  id={`title-${b.id}`}
                  type="text"
                  value={b.title}
                  maxLength={31}
                  onClick={() => setSelectedId(b.id)}
                  onChange={(e) => {
                    const value = e.target.value
                    setBoxes((prev) =>
                      prev.map((item) =>
                        item.id === b.id ? { ...item, title: value } : item,
                      ),
                    )
                  }}
                  className="min-w-[8rem] flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                  placeholder="시트 이름"
                />
                <span className="text-[10px] text-muted-foreground">
                  {b.score > 0
                    ? `신뢰도 ${(b.score * 100).toFixed(1)}%`
                    : '수동'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <TableExportPanel file={file} boxes={boxes} />
    </div>
  )
}