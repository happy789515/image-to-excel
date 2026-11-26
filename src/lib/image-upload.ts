export const PROJECT_IMAGE_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
} as const

export const PROJECT_UPLOAD_ACCEPT = PROJECT_IMAGE_ACCEPT

export const PROJECT_UPLOAD_ACCEPT_LABEL = 'PNG, JPG, WebP'

export const MAX_IMAGE_FILES = 30

const PASTE_TYPE_PREFIX = 'image/'

export function isProjectUploadMime(type: string): boolean {
  return type in PROJECT_IMAGE_ACCEPT
}

export function defaultClipboardFileName(mime: string): string {
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
    if (!file || !isProjectUploadMime(file.type)) continue

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

export function isImageFile(file: File | Blob): boolean {
  return file.type.startsWith(PASTE_TYPE_PREFIX)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatUpdatedAt(ms: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(ms))
}