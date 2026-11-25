export type TableImageBuffer = {
  width: number
  height: number
  data: ImageData
}

export function createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h)
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function drawToBuffer(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): TableImageBuffer {
  const canvas = createCanvas(dw, dh)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh)
  const data =
    canvas instanceof HTMLCanvasElement
      ? ctx.getImageData(0, 0, dw, dh)
      : (canvas as OffscreenCanvas).getContext('2d')!.getImageData(0, 0, dw, dh)
  return { width: dw, height: dh, data }
}

export function bufferToCanvas(buf: TableImageBuffer): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = buf.width
  c.height = buf.height
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.putImageData(buf.data, 0, 0)
  return c
}

export function bufferToBlob(buf: TableImageBuffer, type = 'image/png'): Promise<Blob> {
  const c = bufferToCanvas(buf)
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type)
  })
}

export async function loadImageFromFile(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function cloneBuffer(buf: TableImageBuffer): TableImageBuffer {
  return {
    width: buf.width,
    height: buf.height,
    data: new ImageData(
      new Uint8ClampedArray(buf.data.data),
      buf.width,
      buf.height,
    ),
  }
}