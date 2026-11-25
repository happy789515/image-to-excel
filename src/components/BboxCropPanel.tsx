import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { Crop } from 'lucide-react'

import type { EditableBox } from '@/components/EditableBBoxLayer'
import { PanZoomViewport } from '@/components/PanZoomViewport'
import { computeFitLayout } from '@/lib/bbox/geometry'
import { drawCropPreview, PREVIEW_PAD_RATIO } from '@/lib/image/crop'
import { cn } from 'cn'

type Props = {
  imageRef: RefObject<HTMLImageElement | null>
  imageRevision: number
  boxes: EditableBox[]
  selectedId: string | null
  showTitle?: boolean
}

function boxKey(box: EditableBox['box']): string {
  return `${box.xmin.toFixed(2)}-${box.ymin.toFixed(2)}-${box.xmax.toFixed(2)}-${box.ymax.toFixed(2)}`
}

export function BboxCropPanel({
  imageRef,
  imageRevision,
  boxes,
  selectedId,
  showTitle = true,
}: Props) {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const viewportHostRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const [fitSize, setFitSize] = useState<{ w: number; h: number } | null>(null)
  const [hasImage, setHasImage] = useState(false)

  const refreshFitSize = useCallback(() => {
    const host = viewportHostRef.current
    const canvas = mainCanvasRef.current
    if (!host || !canvas?.width || !canvas.height) return
    const rect = host.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    const layout = computeFitLayout(
      canvas.width,
      canvas.height,
      rect.width,
      rect.height,
    )
    setFitSize({ w: layout.renderedW, h: layout.renderedH })
  }, [])

  const signature = useMemo(
    () => boxes.map((b) => `${b.id}:${boxKey(b.box)}`).join('|'),
    [boxes],
  )

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const img = imageRef.current
      const main = mainCanvasRef.current
      setHasImage(Boolean(img?.naturalWidth))
      if (!img?.naturalWidth || !main) return

      const selected = boxes.find((b) => b.id === selectedId) ?? boxes[0]
      if (selected) {
        const ok = drawCropPreview(img, selected.box, main, {
          padRatio: PREVIEW_PAD_RATIO,
          maxDimension: 1600,
        })
        if (ok) refreshFitSize()
      }

    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [imageRef, imageRevision, refreshFitSize, signature, boxes, selectedId])

  useEffect(() => {
    const host = viewportHostRef.current
    if (!host) return undefined
    const observer = new ResizeObserver(() => refreshFitSize())
    observer.observe(host)
    return () => observer.disconnect()
  }, [refreshFitSize])

  const selected = boxes.find((b) => b.id === selectedId) ?? boxes[0]

  if (boxes.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
        검출된 영역이 없습니다.
        <br />
        영역을 추가하거나 다시 검출하세요.
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', showTitle ? 'gap-2' : 'gap-0')}>
      {showTitle ? (
        <p className="flex shrink-0 items-center gap-1.5">
          <Crop className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            잘라낸 미리보기
          </span>
        </p>
      ) : null}

      <div
        ref={viewportHostRef}
        className={cn(
          'relative flex min-h-0 flex-1 overflow-hidden',
          showTitle
            ? 'rounded-lg border border-border bg-card p-2'
            : 'min-h-0',
        )}
      >
        {!hasImage ? (
          <p className="m-auto text-sm text-muted-foreground">원본 이미지 로딩 중…</p>
        ) : (
          <PanZoomViewport
            className="min-h-0 flex-1"
            minimap={{ kind: 'canvas', canvasRef: mainCanvasRef }}
            resetKey={`${signature}:${selectedId ?? ''}:${fitSize?.w ?? 0}:${fitSize?.h ?? 0}`}
          >
            <div
              className="relative shrink-0"
              style={
                fitSize
                  ? { width: fitSize.w, height: fitSize.h }
                  : undefined
              }
            >
              <canvas
                ref={mainCanvasRef}
                className="block size-full"
                aria-label={
                  selected ? `${selected.title} 잘라낸 영역` : '잘라낸 미리보기'
                }
              />
            </div>
          </PanZoomViewport>
        )}
      </div>
    </div>
  )
}