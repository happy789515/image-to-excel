import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'

import {
  clampBox,
  clientToNatural,
  computeImageLayout,
  type ImageLayout,
  MIN_BOX_PX,
} from '@/lib/bbox/geometry'
import type { TableDetectionBox } from '@/lib/table-detection/types'
import { cn } from 'cn'

export type EditableBox = TableDetectionBox & { id: string; title: string }

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move'

type DragState = {
  handle: Handle
  boxId: string
  startX: number
  startY: number
  origin: TableDetectionBox['box']
}

type Props = {
  boxes: EditableBox[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: Dispatch<SetStateAction<EditableBox[]>>
  imageRef: RefObject<HTMLImageElement | null>
}

function updateBox(
  boxes: EditableBox[],
  id: string,
  box: TableDetectionBox['box'],
): EditableBox[] {
  return boxes.map((item) =>
    item.id === id
      ? {
          ...item,
          box,
          score: item.score,
          label: item.label === 'table' ? item.label : 'table',
        }
      : item,
  )
}

export function EditableBBoxLayer({
  boxes,
  selectedId,
  onSelect,
  onChange,
  imageRef,
}: Props) {
  const [layout, setLayout] = useState<ImageLayout | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const refreshLayout = useCallback(() => {
    const img = imageRef.current
    if (!img) {
      setLayout(null)
      return
    }
    setLayout(computeImageLayout(img))
  }, [imageRef])

  useEffect(() => {
    const img = imageRef.current
    if (!img) return

    refreshLayout()
    const observer = new ResizeObserver(() => refreshLayout())
    observer.observe(img)
    img.addEventListener('load', refreshLayout)
    window.addEventListener('resize', refreshLayout)

    return () => {
      observer.disconnect()
      img.removeEventListener('load', refreshLayout)
      window.removeEventListener('resize', refreshLayout)
    }
  }, [imageRef, refreshLayout])

  const applyDrag = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current
      const img = imageRef.current
      const currentLayout = layout
      if (!drag || !img || !currentLayout) return

      const point = clientToNatural(clientX, clientY, img)
      if (!point) return

      const dx = point.x - drag.startX
      const dy = point.y - drag.startY
      const { origin } = drag
      let next = { ...origin }

      if (drag.handle === 'move') {
        const w = origin.xmax - origin.xmin
        const h = origin.ymax - origin.ymin
        let xmin = origin.xmin + dx
        let ymin = origin.ymin + dy
        xmin = Math.max(0, Math.min(xmin, currentLayout.naturalW - w))
        ymin = Math.max(0, Math.min(ymin, currentLayout.naturalH - h))
        next = { xmin, ymin, xmax: xmin + w, ymax: ymin + h }
      } else if (drag.handle === 'nw') {
        next.xmin = origin.xmin + dx
        next.ymin = origin.ymin + dy
      } else if (drag.handle === 'ne') {
        next.xmax = origin.xmax + dx
        next.ymin = origin.ymin + dy
      } else if (drag.handle === 'sw') {
        next.xmin = origin.xmin + dx
        next.ymax = origin.ymax + dy
      } else if (drag.handle === 'se') {
        next.xmax = origin.xmax + dx
        next.ymax = origin.ymax + dy
      }

      if (next.xmax - next.xmin < MIN_BOX_PX) {
        if (drag.handle === 'nw' || drag.handle === 'sw') {
          next.xmin = next.xmax - MIN_BOX_PX
        } else {
          next.xmax = next.xmin + MIN_BOX_PX
        }
      }
      if (next.ymax - next.ymin < MIN_BOX_PX) {
        if (drag.handle === 'nw' || drag.handle === 'ne') {
          next.ymin = next.ymax - MIN_BOX_PX
        } else {
          next.ymax = next.ymin + MIN_BOX_PX
        }
      }

      next = clampBox(next, currentLayout.naturalW, currentLayout.naturalH)
      onChange((prev) => updateBox(prev, drag.boxId, next))
    },
    [imageRef, layout, onChange],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      e.preventDefault()
      applyDrag(e.clientX, e.clientY)
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [applyDrag])

  const startDrag = (
    event: React.PointerEvent,
    boxId: string,
    handle: Handle,
    origin: TableDetectionBox['box'],
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const img = imageRef.current
    if (!img) return

    const point = clientToNatural(event.clientX, event.clientY, img)
    if (!point) return

    onSelect(boxId)
    dragRef.current = {
      handle,
      boxId,
      startX: point.x,
      startY: point.y,
      origin: { ...origin },
    }
  }

  if (!layout) return null

  return (
    <div
      className="absolute touch-none"
      style={{
        left: layout.offsetX,
        top: layout.offsetY,
        width: layout.renderedW,
        height: layout.renderedH,
      }}
      onPointerDown={() => onSelect(null)}
    >
      {boxes.map((item, index) => {
        const { xmin, ymin, xmax, ymax } = item.box
        const left = (xmin / layout.naturalW) * 100
        const top = (ymin / layout.naturalH) * 100
        const width = ((xmax - xmin) / layout.naturalW) * 100
        const height = ((ymax - ymin) / layout.naturalH) * 100
        const selected = item.id === selectedId

        return (
          <div
            key={item.id}
            className={cn(
              'absolute border-2 bg-primary/15',
              selected ? 'border-primary ring-2 ring-primary/30' : 'border-primary/80',
            )}
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
            onPointerDown={(e) => {
              e.stopPropagation()
              startDrag(e, item.id, 'move', item.box)
            }}
          >
            <span className="pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
              #{index + 1}{' '}
              {item.score > 0 ? `${(item.score * 100).toFixed(0)}%` : '수동'}
            </span>
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
              <button
                key={corner}
                type="button"
                aria-label={`영역 ${index + 1} ${corner} 모서리 조절`}
                className={cn(
                  'absolute size-3 rounded-sm border border-primary-foreground bg-primary',
                  corner === 'nw' && '-left-1.5 -top-1.5',
                  corner === 'ne' && '-right-1.5 -top-1.5',
                  corner === 'sw' && '-bottom-1.5 -left-1.5',
                  corner === 'se' && '-bottom-1.5 -right-1.5',
                )}
                onPointerDown={(e) => startDrag(e, item.id, corner, item.box)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}