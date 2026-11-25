import { clampBox } from '@/lib/bbox/geometry'
import type { TableDetectionBox } from '@/lib/table-detection/types'

import {
  drawToBuffer,
  loadImageFromFile,
  type TableImageBuffer,
} from '@/lib/image/canvas-utils'

const PAD_RATIO = 0.04

/** UI preview matches on-screen bbox; export still uses {@link PAD_RATIO}. */
export const PREVIEW_PAD_RATIO = 0

export type CropOptions = {
  padRatio?: number
}

function paddedBox(
  box: TableDetectionBox['box'],
  naturalW: number,
  naturalH: number,
  padRatio: number,
): TableDetectionBox['box'] {
  const w = box.xmax - box.xmin
  const h = box.ymax - box.ymin
  const padX = w * padRatio
  const padY = h * padRatio
  return clampBox(
    {
      xmin: box.xmin - padX,
      ymin: box.ymin - padY,
      xmax: box.xmax + padX,
      ymax: box.ymax + padY,
    },
    naturalW,
    naturalH,
  )
}

export type CropPreviewOptions = {
  padRatio?: number
  maxDimension?: number
}

function cropSourceRect(
  img: HTMLImageElement,
  box: TableDetectionBox['box'],
  padRatio: number,
): { sx: number; sy: number; sw: number; sh: number } | null {
  if (!img.naturalWidth || !img.naturalHeight) return null
  const region = paddedBox(box, img.naturalWidth, img.naturalHeight, padRatio)
  const sx = Math.round(region.xmin)
  const sy = Math.round(region.ymin)
  const sw = Math.round(region.xmax - region.xmin)
  const sh = Math.round(region.ymax - region.ymin)
  if (sw < 2 || sh < 2) return null
  return { sx, sy, sw, sh }
}

function previewDestSize(
  sw: number,
  sh: number,
  maxDimension: number,
): { dw: number; dh: number } {
  if (maxDimension <= 0) return { dw: sw, dh: sh }
  const long = Math.max(sw, sh)
  if (long <= maxDimension) return { dw: sw, dh: sh }
  const scale = maxDimension / long
  return { dw: Math.max(1, Math.round(sw * scale)), dh: Math.max(1, Math.round(sh * scale)) }
}

export function drawCropPreview(
  img: HTMLImageElement,
  box: TableDetectionBox['box'],
  canvas: HTMLCanvasElement,
  options?: CropPreviewOptions,
): boolean {
  const padRatio = options?.padRatio ?? PREVIEW_PAD_RATIO
  const maxDimension = options?.maxDimension ?? 1600
  const rect = cropSourceRect(img, box, padRatio)
  if (!rect) return false
  const { sx, sy, sw, sh } = rect
  const { dw, dh } = previewDestSize(sw, sh, maxDimension)

  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)
  return true
}

export async function cropTableRegion(
  file: Blob,
  box: TableDetectionBox['box'],
  options?: CropOptions,
): Promise<TableImageBuffer> {
  const padRatio = options?.padRatio ?? PAD_RATIO

  const img = await loadImageFromFile(file)
  const naturalW = img.naturalWidth
  const naturalH = img.naturalHeight
  const region = paddedBox(box, naturalW, naturalH, padRatio)

  const sx = Math.round(region.xmin)
  const sy = Math.round(region.ymin)
  const sw = Math.round(region.xmax - region.xmin)
  const sh = Math.round(region.ymax - region.ymin)

  return drawToBuffer(img, sx, sy, sw, sh, sw, sh)
}