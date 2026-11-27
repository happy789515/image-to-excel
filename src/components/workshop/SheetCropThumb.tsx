import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { TableJson } from '@/lib/api/projects'
import { drawCropPreview, PREVIEW_PAD_RATIO } from '@/lib/image/crop'

type Props = {
  table: TableJson
  imageName: string
  fetchImageBlob: (imageId: string, signal?: AbortSignal) => Promise<Blob>
}

async function renderCrop(
  blob: Blob,
  box: TableJson['box'],
  maxDimension: number,
): Promise<string> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    const ok = drawCropPreview(img, box, canvas, {
      padRatio: PREVIEW_PAD_RATIO,
      maxDimension,
    })
    if (!ok) throw new Error('Crop failed')
    return canvas.toDataURL('image/jpeg', 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function SheetCropThumb({ table, imageName, fetchImageBlob }: Props) {
  const [thumb, setThumb] = useState<string | null>(null)
  const [large, setLarge] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const { imageId } = table
  const { xmin, ymin, xmax, ymax } = table.box

  useEffect(() => {
    const ac = new AbortController()
    setLarge(null)
    void (async () => {
      try {
        const blob = await fetchImageBlob(imageId, ac.signal)
        const url = await renderCrop(blob, { xmin, ymin, xmax, ymax }, 160)
        if (!ac.signal.aborted) setThumb(url)
      } catch (err) {
        if (!ac.signal.aborted) console.error('Failed to render crop thumbnail', err)
      }
    })()
    return () => ac.abort()
  }, [fetchImageBlob, imageId, xmin, ymin, xmax, ymax])

  useEffect(() => {
    if (!open || large) return
    const ac = new AbortController()
    void (async () => {
      try {
        const blob = await fetchImageBlob(imageId, ac.signal)
        const url = await renderCrop(blob, { xmin, ymin, xmax, ymax }, 0)
        if (!ac.signal.aborted) setLarge(url)
      } catch (err) {
        if (!ac.signal.aborted) console.error('Failed to render large crop', err)
      }
    })()
    return () => ac.abort()
  }, [open, large, fetchImageBlob, imageId, xmin, ymin, xmax, ymax])

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`${imageName} ${table.title} 크게 보기`}
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-background p-1 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="h-10 w-14 shrink-0 overflow-hidden rounded bg-muted">
          {thumb ? (
            <img
              src={thumb}
              alt=""
              draggable={false}
              className="size-full object-cover"
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{table.title}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {imageName}
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="h-[92vh] w-[96vw] max-w-none sm:max-w-none"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {imageName} · {table.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-muted">
            {large ? (
              <img
                src={large}
                alt={`${imageName} ${table.title}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
