import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 6
const ZOOM_STEP = 1.12

export type PanZoomState = {
  scale: number
  panX: number
  panY: number
}

export type ViewportRect = {
  left: number
  top: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function usePanZoom(enabled = true) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<PanZoomState>({ scale: 1, panX: 0, panY: 0 })
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  const [contentSize, setContentSize] = useState({ w: 0, h: 0 })
  const panDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originPanX: number
    originPanY: number
  } | null>(null)

  const measure = useCallback(() => {
    const vp = viewportRef.current
    const content = contentRef.current
    if (!vp || !content) return
    const vpRect = vp.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const vw = vpRect.width
    const vh = vpRect.height
    const cw = contentRect.width
    const ch = contentRect.height
    setViewportSize({ w: vw, h: vh })
    setContentSize({ w: cw, h: ch })
    if (!enabled) return
    setState((prev) => {
      if (prev.scale > 1.001) return prev
      if (vw < 1 || cw < 1) return prev
      const panX = (vw - cw) / 2
      const panY = (vh - ch) / 2
      if (
        prev.scale === 1 &&
        Math.abs(prev.panX - panX) < 0.5 &&
        Math.abs(prev.panY - panY) < 0.5
      ) {
        return prev
      }
      return { scale: 1, panX, panY }
    })
  }, [enabled])

  useEffect(() => {
    const vp = viewportRef.current
    const content = contentRef.current
    if (!vp) return undefined
    const observer = new ResizeObserver(() => measure())
    observer.observe(vp)
    if (content) observer.observe(content)
    measure()
    return () => observer.disconnect()
  }, [measure])

  const centerAtUnitScale = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const vpRect = vp.getBoundingClientRect()
    const content = contentRef.current
    const cw = content?.getBoundingClientRect().width ?? contentSize.w
    const ch = content?.getBoundingClientRect().height ?? contentSize.h
    setContentSize({ w: cw, h: ch })
    setState({ scale: 1, panX: (vpRect.width - cw) / 2, panY: (vpRect.height - ch) / 2 })
  }, [contentSize.h, contentSize.w])

  const setScaleAroundPoint = useCallback(
    (nextScale: number, focalX: number, focalY: number) => {
      setState((prev) => {
        const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
        if (scale <= MIN_SCALE) {
          return {
            scale: 1,
            panX: (viewportSize.w - contentSize.w) / 2,
            panY: (viewportSize.h - contentSize.h) / 2,
          }
        }
        const worldX = (focalX - prev.panX) / prev.scale
        const worldY = (focalY - prev.panY) / prev.scale
        return {
          scale,
          panX: focalX - worldX * scale,
          panY: focalY - worldY * scale,
        }
      })
    },
    [contentSize.h, contentSize.w, viewportSize.h, viewportSize.w],
  )

  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (!enabled) return
      const vp = viewportRef.current
      if (!vp) return
      e.preventDefault()
      const rect = vp.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setState((prev) => {
        const nextScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE)
        if (nextScale <= MIN_SCALE) {
          return {
            scale: 1,
            panX: (viewportSize.w - contentSize.w) / 2,
            panY: (viewportSize.h - contentSize.h) / 2,
          }
        }
        const worldX = (mx - prev.panX) / prev.scale
        const worldY = (my - prev.panY) / prev.scale
        return {
          scale: nextScale,
          panX: mx - worldX * nextScale,
          panY: my - worldY * nextScale,
        }
      })
    },
    [contentSize.h, contentSize.w, enabled, viewportSize.h, viewportSize.w],
  )

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || !enabled) return undefined
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [enabled, onWheel])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || state.scale <= 1.001) return
      if (e.button !== 0 && e.button !== 1) return
      const target = e.target as HTMLElement
      if (target.closest('[data-pan-zoom-block]')) return
      panDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originPanX: state.panX,
        originPanY: state.panY,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [enabled, state.panX, state.panY, state.scale],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = panDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    setState((prev) => ({
      ...prev,
      panX: drag.originPanX + dx,
      panY: drag.originPanY + dy,
    }))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (panDragRef.current?.pointerId === e.pointerId) {
      panDragRef.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
  }, [])

  const viewportRect: ViewportRect | null =
    state.scale > 1.001 && contentSize.w > 0 && contentSize.h > 0
      ? {
          left: clamp(-state.panX / state.scale / contentSize.w, 0, 1),
          top: clamp(-state.panY / state.scale / contentSize.h, 0, 1),
          width: clamp(viewportSize.w / state.scale / contentSize.w, 0, 1),
          height: clamp(viewportSize.h / state.scale / contentSize.h, 0, 1),
        }
      : null

  const panHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }

  return {
    viewportRef,
    contentRef,
    state,
    viewportSize,
    contentSize,
    viewportRect,
    panHandlers,
    centerAtUnitScale,
    setScaleAroundPoint,
    showMinimap: enabled && state.scale > 1.02,
  }
}