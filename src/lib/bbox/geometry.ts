import type { TableDetectionBox } from '@/lib/table-detection/types'

export const MIN_BOX_PX = 16

export type ImageLayout = {
  naturalW: number
  naturalH: number
  renderedW: number
  renderedH: number
  offsetX: number
  offsetY: number
  scale: number
}

export function computeImageLayout(img: HTMLImageElement): ImageLayout | null {
  const naturalW = img.naturalWidth
  const naturalH = img.naturalHeight
  if (!naturalW || !naturalH) return null

  const rect = img.getBoundingClientRect()
  const scale = Math.min(rect.width / naturalW, rect.height / naturalH)
  const renderedW = naturalW * scale
  const renderedH = naturalH * scale
  const offsetX = (rect.width - renderedW) / 2
  const offsetY = (rect.height - renderedH) / 2

  return {
    naturalW,
    naturalH,
    renderedW,
    renderedH,
    offsetX,
    offsetY,
    scale,
  }
}

export function clampBox(
  box: TableDetectionBox['box'],
  naturalW: number,
  naturalH: number,
): TableDetectionBox['box'] {
  let { xmin, ymin, xmax, ymax } = box

  if (xmax - xmin < MIN_BOX_PX) {
    xmax = xmin + MIN_BOX_PX
  }
  if (ymax - ymin < MIN_BOX_PX) {
    ymax = ymin + MIN_BOX_PX
  }

  xmin = Math.max(0, Math.min(xmin, naturalW - MIN_BOX_PX))
  ymin = Math.max(0, Math.min(ymin, naturalH - MIN_BOX_PX))
  xmax = Math.max(MIN_BOX_PX, Math.min(xmax, naturalW))
  ymax = Math.max(MIN_BOX_PX, Math.min(ymax, naturalH))

  if (xmax - xmin < MIN_BOX_PX) xmax = xmin + MIN_BOX_PX
  if (ymax - ymin < MIN_BOX_PX) ymax = ymin + MIN_BOX_PX

  return { xmin, ymin, xmax, ymax }
}

export function clientToNatural(
  clientX: number,
  clientY: number,
  img: HTMLImageElement,
): { x: number; y: number } | null {
  const layout = computeImageLayout(img)
  if (!layout) return null

  const rect = img.getBoundingClientRect()
  const localX = clientX - rect.left - layout.offsetX
  const localY = clientY - rect.top - layout.offsetY

  if (localX < 0 || localY < 0 || localX > layout.renderedW || localY > layout.renderedH) {
    return null
  }

  return {
    x: localX / layout.scale,
    y: localY / layout.scale,
  }
}

export function defaultCenterBox(
  naturalW: number,
  naturalH: number,
): TableDetectionBox['box'] {
  const w = naturalW * 0.45
  const h = naturalH * 0.35
  const xmin = (naturalW - w) / 2
  const ymin = (naturalH - h) / 2
  return clampBox(
    { xmin, ymin, xmax: xmin + w, ymax: ymin + h },
    naturalW,
    naturalH,
  )
}