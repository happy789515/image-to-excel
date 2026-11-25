import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileRejection } from 'react-dropzone'

import {
  filesFromClipboard,
  MAX_IMAGE_FILES,
  UPLOAD_ACCEPT,
} from '@/lib/image-upload'
import { deleteDetectionResult } from '@/lib/detection-persist'
import { clearWorkshopHydration } from '@/lib/workshop-hydration-cache'
import { deleteWorkshopSession } from '@/lib/workshop-persist'
import {
  clearPersistedUploads,
  loadPersistedUploads,
  persistErrorMessage,
  persistUploadQueue,
} from '@/lib/upload-persist'

export type QueuedImage = {
  id: string
  file: File
  previewUrl: string
}

function rejectionMessage(rejections: FileRejection[]): string {
  const codes = new Set(
    rejections.flatMap((r) => r.errors.map((e) => e.code)),
  )
  if (codes.has('too-many-files')) {
    return `한 번에 최대 ${MAX_IMAGE_FILES}개까지 올릴 수 있습니다.`
  }
  if (codes.has('file-invalid-type')) {
    return '이미지 또는 PDF만 업로드할 수 있습니다.'
  }
  return '업로드할 수 없는 파일이 포함되어 있습니다.'
}

function queuedFromFile(id: string, file: File): QueuedImage {
  return { id, file, previewUrl: URL.createObjectURL(file) }
}

export function useUploadQueue() {
  const [queue, setQueue] = useState<QueuedImage[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const persistWarned = useRef(false)

  const appendFiles = useCallback(
    (accepted: File[], rejected: FileRejection[] = []) => {
      setError(null)

      if (rejected.length > 0) {
        setError(rejectionMessage(rejected))
      }

      if (accepted.length === 0) return

      setQueue((prev) => {
        const remaining = MAX_IMAGE_FILES - prev.length
        if (remaining <= 0) {
          setError(`한 번에 최대 ${MAX_IMAGE_FILES}개까지 올릴 수 있습니다.`)
          return prev
        }

        const nextBatch = accepted
          .slice(0, remaining)
          .map((file) =>
            queuedFromFile(
              `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
              file,
            ),
          )

        if (accepted.length > remaining) {
          setError(`한 번에 최대 ${MAX_IMAGE_FILES}개까지 올릴 수 있습니다.`)
        }

        const merged = [...prev, ...nextBatch]
        if (prev.length === 0 && nextBatch.length > 0) {
          setActiveId(nextBatch[0].id)
        }
        return merged
      })
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { activeId: savedActive, items } = await loadPersistedUploads()
        if (cancelled || items.length === 0) return
        setQueue((prev) => {
          if (prev.length > 0) return prev
          return items.map((item) => queuedFromFile(item.id, item.file))
        })
        setActiveId((prev) => prev ?? savedActive)
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setStorageReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady) return undefined

    const handle = window.setTimeout(() => {
      const payload = queue.map((item) => ({ id: item.id, file: item.file }))
      void persistUploadQueue(payload, activeId).catch((err) => {
        console.error(err)
        if (persistWarned.current) return
        persistWarned.current = true
        setError(persistErrorMessage(err))
      })
    }, 400)

    return () => window.clearTimeout(handle)
  }, [queue, activeId, storageReady])

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

      const pasted = filesFromClipboard(event.clipboardData)
      if (pasted.length === 0) return

      event.preventDefault()
      appendFiles(pasted)
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [appendFiles])

  const removeFile = useCallback((id: string) => {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
    setActiveId((prev) => (prev === id ? null : prev))
    setError(null)
    void deleteDetectionResult(id).catch((err) => console.error(err))
    void deleteWorkshopSession(id).catch((err) => console.error(err))
    clearWorkshopHydration(id)
  }, [])

  const clearAll = useCallback(() => {
    queue.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    setQueue([])
    setActiveId(null)
    setError(null)
    void clearPersistedUploads().catch((err) => console.error(err))
  }, [queue])

  const activeItem = useMemo(() => {
    if (queue.length === 0) return null
    if (activeId) {
      const found = queue.find((item) => item.id === activeId)
      if (found) return found
    }
    return queue[0]
  }, [queue, activeId])

  return {
    queue,
    activeId,
    activeItem,
    error,
    setActiveId,
    appendFiles,
    removeFile,
    clearAll,
    accept: UPLOAD_ACCEPT,
    maxFiles: MAX_IMAGE_FILES,
  }
}