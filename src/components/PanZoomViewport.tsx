import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'

import { usePanZoom } from '@/hooks/use-pan-zoom'
import { cn } from 'cn'

type MinimapSource =
  | { kind: 'image'; src: string }
  | { kind: 'canvas'; canvasRef: RefObject<HTMLCanvasElement | null> }

type Props = {
  children: ReactNode
  className?: string
  enabled?: boolean
  minimap?: MinimapSource
  minimapClassName?: string
  /** Re-measure / re-center when this changes (e.g. new crop). */
  resetKey?: string | number
  cursorPan?: boolean
}

export function PanZoomViewport({
  children,
  className,
  enabled = true,
  minimap,
  minimapClassName,
  resetKey,
  cursorPan = true,
}: Props) {
  const {
    viewportRef,
    contentRef,
    state,
    viewportRect,
    panHandlers,
    centerAtUnitScale,
    showMinimap,
  } = usePanZoom(enabled)

  useEffect(() => {
    centerAtUnitScale()
  }, [centerAtUnitScale, resetKey])

  const minimapCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!showMinimap || !minimap) return
    const mini = minimapCanvasRef.current
    if (!mini) return
    const ctx = mini.getContext('2d')
    if (!ctx) return

    const draw = () => {
      if (minimap.kind === 'image') {
        const img = new Image()
        img.onload = () => {
          const w = mini.width
          const h = mini.height
          ctx.clearRect(0, 0, w, h)
          const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight)
          const dw = img.naturalWidth * scale
          const dh = img.naturalHeight * scale
          const ox = (w - dw) / 2
          const oy = (h - dh) / 2
          ctx.drawImage(img, ox, oy, dw, dh)
        }
        img.src = minimap.src
        return
      }
      const source = minimap.canvasRef.current
      if (!source?.width) return
      const w = mini.width
      const h = mini.height
      ctx.clearRect(0, 0, w, h)
      const scale = Math.min(w / source.width, h / source.height)
      const dw = source.width * scale
      const dh = source.height * scale
      const ox = (w - dw) / 2
      const oy = (h - dh) / 2
      ctx.drawImage(source, ox, oy, dw, dh)
    }

    draw()
  }, [minimap, showMinimap, resetKey])

  const transformStyle: CSSProperties = {
    transform: `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`,
    transformOrigin: '0 0',
  }

  const panCursorActive = cursorPan && state.scale > 1.02

  return (
    <div
      ref={viewportRef}
      className={cn(
        'group/panzoom relative size-full min-h-0 touch-none select-none',
        panCursorActive && 'cursor-grab active:cursor-grabbing',
        className,
      )}
      data-pan-cursor={panCursorActive ? '' : undefined}
      {...(enabled ? panHandlers : {})}
    >
      <div ref={contentRef} className="inline-block will-change-transform" style={transformStyle}>
        {children}
      </div>

      {showMinimap && viewportRect ? (
        <MinimapOverlay
          className={minimapClassName}
          viewportRect={viewportRect}
          minimap={minimap}
          minimapCanvasRef={minimapCanvasRef}
        />
      ) : null}
    </div>
  )
}

function MinimapOverlay({
  viewportRect,
  minimap,
  minimapCanvasRef,
  className,
}: {
  viewportRect: { left: number; top: number; width: number; height: number }
  minimap?: MinimapSource
  minimapCanvasRef: RefObject<HTMLCanvasElement | null>
  className?: string
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute right-2 top-2 z-20 overflow-hidden rounded-md border border-border bg-card/95 shadow-md backdrop-blur-sm',
        className ?? 'h-20 w-28',
      )}
      aria-hidden
    >
      {minimap ? (
        <canvas
          ref={minimapCanvasRef}
          width={112}
          height={80}
          className="block size-full object-contain opacity-90"
        />
      ) : (
        <div className="size-full bg-muted/40" />
      )}
      <div
        className="absolute border-2 border-primary bg-primary/25"
        style={{
          left: `${viewportRect.left * 100}%`,
          top: `${viewportRect.top * 100}%`,
          width: `${viewportRect.width * 100}%`,
          height: `${viewportRect.height * 100}%`,
        }}
      />
    </div>
  )
}