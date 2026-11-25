import {
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react'
import { Crop } from 'lucide-react'

import type { EditableBox } from '@/components/EditableBBoxLayer'
import { PanZoomViewport } from '@/components/PanZoomViewport'
import { drawCropPreview, PREVIEW_PAD_RATIO } from '@/lib/image/crop'

type Props = {
  imageRef: RefObject<HTMLImageElement | null>
  imageRevision: number
  boxes: EditableBox[]
  selectedId: string | null
}

function boxKey(box: EditableBox['box']): string {
  return `${box.xmin.toFixed(2)}-${box.ymin.toFixed(2)}-${box.xmax.toFixed(2)}-${box.ymax.toFixed(2)}`
}

export function BboxCropPanel({
  imageRef,
  imageRevision,
  boxes,
  selectedId,
}: Props) {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  const signature = useMemo(
    () => boxes.map((b) => `${b.id}:${boxKey(b.box)}`).join('|'),
    [boxes],
  )

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const img = imageRef.current
      const main = mainCanvasRef.current
      if (!img?.naturalWidth || !main) return

      const selected = boxes.find((b) => b.id === selectedId) ?? boxes[0]
      if (selected) {
        drawCropPreview(img, selected.box, main, {
          padRatio: PREVIEW_PAD_RATIO,
          maxDimension: 1600,
        })
      }

    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [imageRef, imageRevision, signature, boxes, selectedId])

  const selected = boxes.find((b) => b.id === selectedId) ?? boxes[0]
  const hasImage = Boolean(imageRef.current?.naturalWidth)

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
    <div className="flex h-full min-h-0 flex-col gap-2">
      <p className="flex shrink-0 items-center gap-1.5">
        <Crop className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-semibold tracking-tight text-foreground">
          잘라낸 미리보기
        </span>
      </p>

      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card p-2">
        {!hasImage ? (
          <p className="m-auto text-sm text-muted-foreground">원본 이미지 로딩 중…</p>
        ) : (
          <PanZoomViewport
            className="min-h-0 flex-1"
            minimap={{ kind: 'canvas', canvasRef: mainCanvasRef }}
            resetKey={`${signature}:${selectedId ?? ''}`}
          >
            <canvas
              ref={mainCanvasRef}
              className="block max-h-[min(70vh,100%)] max-w-full"
              aria-label={selected ? `${selected.title} 잘라낸 영역` : '잘라낸 미리보기'}
            />
          </PanZoomViewport>
        )}
      </div>
    </div>
  )
}