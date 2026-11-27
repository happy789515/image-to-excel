import type { CropInput, TableJson } from '@/lib/api/projects'
import {
  EXTRACT_CROP_JPEG_QUALITY,
  EXTRACT_CROP_MAX_LONG,
  GROUP_CROP_JPEG_QUALITY,
  GROUP_CROP_MAX_LONG,
  MAX_CROP_PAYLOAD_BYTES,
} from '@/lib/project/constants'
import { cropTableRegion } from '@/lib/image/crop'
import {
  bufferToCanvas,
  drawToBuffer,
  type TableImageBuffer,
} from '@/lib/image/canvas-utils'

export type CropProfile = {
  maxLongSide: number
  jpegQuality: number
}

export const GROUP_CROP_PROFILE: CropProfile = {
  maxLongSide: GROUP_CROP_MAX_LONG,
  jpegQuality: GROUP_CROP_JPEG_QUALITY,
}

export const EXTRACT_CROP_PROFILE: CropProfile = {
  maxLongSide: EXTRACT_CROP_MAX_LONG,
  jpegQuality: EXTRACT_CROP_JPEG_QUALITY,
}

function scaledSize(
  w: number,
  h: number,
  maxLongSide: number,
): { dw: number; dh: number } {
  const long = Math.max(w, h)
  if (long <= maxLongSide) return { dw: w, dh: h }
  const scale = maxLongSide / long
  return {
    dw: Math.max(1, Math.round(w * scale)),
    dh: Math.max(1, Math.round(h * scale)),
  }
}

function canvasToJpegBase64(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('JPEG 인코딩에 실패했습니다.'))
          return
        }
        const bufAb = await blob.arrayBuffer()
        const bytes = new Uint8Array(bufAb)
        let binary = ''
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]!)
        }
        resolve(btoa(binary))
      },
      'image/jpeg',
      quality,
    )
  })
}

async function bufferToJpegBase64(
  buf: TableImageBuffer,
  profile: CropProfile,
): Promise<string> {
  const { dw, dh } = scaledSize(buf.width, buf.height, profile.maxLongSide)
  let payload = buf
  if (dw !== buf.width || dh !== buf.height) {
    const canvas = bufferToCanvas(buf)
    payload = drawToBuffer(canvas, 0, 0, buf.width, buf.height, dw, dh)
  }
  const outCanvas = bufferToCanvas(payload)
  return canvasToJpegBase64(outCanvas, profile.jpegQuality)
}

export function totalCropBase64Bytes(crops: CropInput[]): number {
  let total = 0
  for (const c of crops) {
    total += c.data.length
  }
  return total
}

export function cropPayloadOverLimit(crops: CropInput[]): boolean {
  return totalCropBase64Bytes(crops) > MAX_CROP_PAYLOAD_BYTES
}

export const CROP_PAYLOAD_TOO_LARGE_MSG =
  '제출할 이미지 크기가 너무 큽니다(19MB 초과). 이미지 수를 줄이거나 표 영역을 줄여 주세요.'

export async function buildCropsForTables(
  tables: TableJson[],
  imageBlobById: Map<string, Blob>,
  profile: CropProfile,
  signal?: AbortSignal,
): Promise<CropInput[]> {
  const crops: CropInput[] = []
  for (const table of tables) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const blob = imageBlobById.get(table.imageId)
    if (!blob) {
      throw new Error(`이미지를 불러오지 못했습니다: ${table.imageId}`)
    }
    const region = await cropTableRegion(blob, table.box)
    const data = await bufferToJpegBase64(region, profile)
    crops.push({
      tableId: table.id,
      mimeType: 'image/jpeg',
      data,
    })
  }
  return crops
}