export const IMAGE_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/bmp': ['.bmp'],
  'image/tiff': ['.tif', '.tiff'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
} as const

export const PDF_ACCEPT = {
  'application/pdf': ['.pdf'],
} as const

export const UPLOAD_ACCEPT = {
  ...IMAGE_ACCEPT,
  ...PDF_ACCEPT,
} as const

export const IMAGE_ACCEPT_LABEL =
  'PNG, JPG, WebP, GIF, BMP, TIFF, HEIC'

export const UPLOAD_ACCEPT_LABEL = `${IMAGE_ACCEPT_LABEL}, PDF`

export const MAX_IMAGE_FILES = 20

const PASTE_TYPE_PREFIX = 'image/'

export function isUploadableMime(type: string): boolean {
  if (type === 'application/pdf') return true
  if (type.startsWith(PASTE_TYPE_PREFIX)) return true
  return type in IMAGE_ACCEPT
}

export function defaultClipboardFileName(mime: string): string {
  if (mime === 'application/pdf') return `clipboard-${Date.now()}.pdf`
  if (mime === 'image/jpeg') return `clipboard-${Date.now()}.jpg`
  if (mime === 'image/png') return `clipboard-${Date.now()}.png`
  if (mime === 'image/webp') return `clipboard-${Date.now()}.webp`
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin'
  return `clipboard-${Date.now()}.${ext}`
}

export function filesFromClipboard(data: DataTransfer): File[] {
  const result: File[] = []
  for (const item of data.items) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (!file || !isUploadableMime(file.type)) continue

    const name =
      file.name && file.name.length > 0 && !/^image\.(png|jpe?g)$/i.test(file.name)
        ? file.name
        : defaultClipboardFileName(file.type)

    result.push(
      new File([file], name, {
        type: file.type,
        lastModified: file.lastModified || Date.now(),
      }),
    )
  }
  return result
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith(PASTE_TYPE_PREFIX)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}