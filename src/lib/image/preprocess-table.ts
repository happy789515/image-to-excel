import {
  bufferToCanvas,
  createCanvas,
  type TableImageBuffer,
} from '@/lib/image/canvas-utils'

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function estimateSkewDegrees(buf: TableImageBuffer): number {
  const { width, height, data } = buf.data
  let sum = 0
  let count = 0
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = (y * width + x) * 4
      const gx =
        -luminance(data[i - 4]!, data[i - 3]!, data[i - 2]!) +
        luminance(data[i + 4]!, data[i + 5]!, data[i + 6]!)
      const gy =
        -luminance(data[i - width * 4]!, data[i - width * 4 + 1]!, data[i - width * 4 + 2]!) +
        luminance(data[i + width * 4]!, data[i + width * 4 + 1]!, data[i + width * 4 + 2]!)
      if (Math.abs(gx) < 8) continue
      const angle = (Math.atan2(gy, gx) * 180) / Math.PI
      if (Math.abs(angle) < 15) {
        sum += angle
        count += 1
      }
    }
  }
  return count > 0 ? sum / count : 0
}

export function rotateBuffer(buf: TableImageBuffer, degrees: number): TableImageBuffer {
  if (Math.abs(degrees) < 0.05) return buf
  const canvas = bufferToCanvas(buf)
  const rad = (degrees * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const w = buf.width
  const h = buf.height
  const dw = Math.ceil(w * cos + h * sin)
  const dh = Math.ceil(w * sin + h * cos)
  const outCanvas = createCanvas(dw, dh)
  const ctx =
    outCanvas instanceof HTMLCanvasElement
      ? outCanvas.getContext('2d')
      : (outCanvas as OffscreenCanvas).getContext('2d')
  if (!ctx) return buf
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, dw, dh)
  ctx.translate(dw / 2, dh / 2)
  ctx.rotate(rad)
  ctx.drawImage(canvas, -w / 2, -h / 2)
  const data = ctx.getImageData(0, 0, dw, dh)
  return { width: dw, height: dh, data }
}

export type PrepareTableBaseOptions = { deskew?: boolean }

export function prepareTableBase(
  buf: TableImageBuffer,
  options?: PrepareTableBaseOptions,
): TableImageBuffer {
  if (!options?.deskew) return buf
  const angle = estimateSkewDegrees(buf)
  if (Math.abs(angle) <= 0.4) return buf
  return rotateBuffer(buf, -angle)
}