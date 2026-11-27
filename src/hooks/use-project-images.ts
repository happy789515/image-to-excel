import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileRejection } from 'react-dropzone'

import type { ProjectDetail } from '@/lib/api/projects'
import {
  deleteImage as deleteImageApi,
  getImageBlob,
  getProject,
  uploadImage,
} from '@/lib/api/projects'
import {
  filesFromClipboard,
  PROJECT_UPLOAD_ACCEPT,
  isProjectUploadMime,
} from '@/lib/image-upload'
import { MAX_PROJECT_IMAGES } from '@/lib/project/constants'
import { imagesSorted } from '@/lib/project/selectors'

export type ProjectImageItem = {
  id: string
  name: string
  mime: string
  size: number
  previewUrl: string
}

function rejectionMessage(rejections: FileRejection[]): string {
  const codes = new Set(
    rejections.flatMap((r) => r.errors.map((e) => e.code)),
  )
  if (codes.has('too-many-files')) {
    return `프로젝트당 최대 ${MAX_PROJECT_IMAGES}장까지 올릴 수 있습니다.`
  }
  if (codes.has('file-invalid-type')) {
    return 'PNG, JPEG, WebP 이미지만 업로드할 수 있습니다.'
  }
  return '업로드할 수 없는 파일이 포함되어 있습니다.'
}

type Options = {
  projectId: string
  detail: ProjectDetail
  onDetail: (detail: ProjectDetail) => void
}

export function useProjectImages({ projectId, detail, onDetail }: Options) {
  const [pickedActiveId, setPickedActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const blobCache = useRef(new Map<string, Blob>())
  const previewUrlsRef = useRef(new Map<string, string>())
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  const sortedImages = useMemo(() => imagesSorted(detail), [detail])

  const queue: ProjectImageItem[] = useMemo(() => {
    return sortedImages.map((img) => ({
      id: img.id,
      name: img.name,
      mime: img.mime,
      size: img.size,
      previewUrl: previewUrls[img.id] ?? '',
    }))
  }, [previewUrls, sortedImages])

  const activeId = useMemo(() => {
    if (queue.length === 0) return null
    if (pickedActiveId && queue.some((q) => q.id === pickedActiveId)) {
      return pickedActiveId
    }
    return queue[0]!.id
  }, [pickedActiveId, queue])

  const fetchImageBlob = useCallback(
    async (imageId: string, signal?: AbortSignal): Promise<Blob> => {
      const cached = blobCache.current.get(imageId)
      if (cached) return cached
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const blob = await getImageBlob(projectId, imageId)
      blobCache.current.set(imageId, blob)
      return blob
    },
    [projectId],
  )

  useEffect(() => {
    const liveIds = new Set(detail.images.map((i) => i.id))
    for (const id of [...blobCache.current.keys()]) {
      if (!liveIds.has(id)) blobCache.current.delete(id)
    }
  }, [detail.images])

  useEffect(() => {
    const urls = previewUrlsRef.current
    let cancelled = false
    const liveIds = new Set(detail.images.map((i) => i.id))
    for (const [id, url] of [...urls.entries()]) {
      if (!liveIds.has(id)) {
        URL.revokeObjectURL(url)
        urls.delete(id)
      }
    }
    for (const img of detail.images) {
      if (urls.has(img.id)) continue
      getImageBlob(projectId, img.id)
        .then((blob) => {
          if (cancelled || urls.has(img.id)) return
          const url = URL.createObjectURL(blob)
          urls.set(img.id, url)
          setPreviewUrls((prev) => ({ ...prev, [img.id]: url }))
        })
        .catch((err: unknown) => {
          console.error(err)
          if (!cancelled) setError('이미지를 불러오지 못했습니다.')
        })
    }
    return () => {
      cancelled = true
    }
  }, [detail.images, projectId])

  useEffect(() => {
    const urls = previewUrlsRef.current
    const cache = blobCache.current
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
      cache.clear()
    }
  }, [projectId])

  const appendFiles = useCallback(
    async (accepted: File[], rejected: FileRejection[] = []) => {
      setError(null)
      if (rejected.length > 0) {
        setError(rejectionMessage(rejected))
      }
      if (accepted.length === 0) return

      const remaining = MAX_PROJECT_IMAGES - detail.images.length
      if (remaining <= 0) {
        setError(`프로젝트당 최대 ${MAX_PROJECT_IMAGES}장까지 올릴 수 있습니다.`)
        return
      }

      const batch = accepted
        .filter((f) => isProjectUploadMime(f.type))
        .slice(0, remaining)

      if (accepted.length > remaining) {
        setError(`프로젝트당 최대 ${MAX_PROJECT_IMAGES}장까지 올릴 수 있습니다.`)
      }

      setUploading(true)
      try {
        for (const file of batch) {
          await uploadImage(
            projectId,
            file,
            file.name,
            file.type || 'application/octet-stream',
          )
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
      } finally {
        try {
          onDetail(await getProject(projectId))
        } catch (err) {
          console.error(err)
          const message =
            err instanceof Error
              ? err.message
              : '프로젝트를 불러오지 못했습니다.'
          setError((prev) => prev ?? message)
        }
        setUploading(false)
      }
    },
    [detail, onDetail, projectId],
  )

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return
      if (!event.clipboardData) return

      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
      }

      const pasted = filesFromClipboard(event.clipboardData).filter((f) =>
        isProjectUploadMime(f.type),
      )
      if (pasted.length === 0) return

      event.preventDefault()
      void appendFiles(pasted)
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [appendFiles])

  const removeFile = useCallback(
    async (imageId: string) => {
      setError(null)
      try {
        const next = await deleteImageApi(projectId, imageId)
        blobCache.current.delete(imageId)
        onDetail(next)
      } catch (err) {
        if (err instanceof Error) setError(err.message)
      }
    },
    [onDetail, projectId],
  )

  const activeItem = useMemo(() => {
    if (!activeId) return null
    return queue.find((q) => q.id === activeId) ?? null
  }, [activeId, queue])

  return {
    queue,
    activeId,
    activeItem,
    error,
    uploading,
    setActiveId: setPickedActiveId,
    appendFiles,
    removeFile,
    fetchImageBlob,
    accept: PROJECT_UPLOAD_ACCEPT,
    maxFiles: MAX_PROJECT_IMAGES,
  }
}
