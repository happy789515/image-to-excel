import { clampBox } from '@/lib/bbox/geometry'
import type { TableDetectionBox } from '@/lib/table-detection/types'

import {
  drawToBuffer,
  loadImageFromFile,
  type TableImageBuffer,
} from '@/lib/image/canvas-utils'
import { prepareTableBase } from '@/lib/image/preprocess-table'

const PAD_RATIO = 0.04
const MIN_SHORT_SIDE = 600

export type CropOptions = {
  padRatio?: number
  minShortSide?: number
  /** Run optional deskew (photo preset) inside prepareTableBase */
  deskew?: boolean
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

function upscaleIfNeeded(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  minShortSide: number,
): TableImageBuffer {
  const shortSide = Math.min(sw, sh)
  const scale = shortSide < minShortSide ? minShortSide / shortSide : 1
  const dw = Math.round(sw * scale)
  const dh = Math.round(sh * scale)
  return drawToBuffer(source, sx, sy, sw, sh, dw, dh)
}

export async function cropTableRegion(
  file: Blob,
  box: TableDetectionBox['box'],
  options?: CropOptions,
): Promise<TableImageBuffer> {
  const padRatio = options?.padRatio ?? PAD_RATIO
  const minShortSide = options?.minShortSide ?? MIN_SHORT_SIDE
  const deskew = options?.deskew ?? false

  const img = await loadImageFromFile(file)
  const naturalW = img.naturalWidth
  const naturalH = img.naturalHeight
  const region = paddedBox(box, naturalW, naturalH, padRatio)

  const sx = Math.round(region.xmin)
  const sy = Math.round(region.ymin)
  const sw = Math.round(region.xmax - region.xmin)
  const sh = Math.round(region.ymax - region.ymin)

  const upscaled = upscaleIfNeeded(img, sx, sy, sw, sh, minShortSide)
  return prepareTableBase(upscaled, { deskew })
}