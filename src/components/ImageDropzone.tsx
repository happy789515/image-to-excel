import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { AlertCircle, FileImage, FileText, Upload, X } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  filesFromClipboard,
  formatFileSize,
  isImageFile,
  MAX_IMAGE_FILES,
  UPLOAD_ACCEPT,
  UPLOAD_ACCEPT_LABEL,
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
import { cn } from 'cn'
import { TableDetectionPreview } from '@/components/TableDetectionPreview'

type QueuedImage = {
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

export function ImageDropzone() {
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

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      appendFiles(accepted, rejected)
    },
    [appendFiles],
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

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } =
    useDropzone({
      onDrop,
      accept: UPLOAD_ACCEPT,
      maxFiles: MAX_IMAGE_FILES,
      noClick: true,
      noKeyboard: false,
    })

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

  const totalSize = useMemo(
    () => queue.reduce((sum, item) => sum + item.file.size, 0),
    [queue],
  )

  return (
    <div className="flex flex-col gap-6">
      <DropzoneSurface
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        isDragReject={isDragReject}
        onBrowse={open}
        hasFiles={queue.length > 0}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {queue.length > 0 ? (
        <section aria-label="선택한 파일" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                {queue.length}개 선택됨
              </p>
              <p className="text-sm text-muted-foreground">
                총 {formatFileSize(totalSize)} · 이 기기에만 저장 (새로고침 유지)
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>
              전체 삭제
            </Button>
          </div>

          <ul className="divide-y divide-border rounded-xl border border-border">
            {queue.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2.5 first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50',
                  activeItem?.id === item.id && 'bg-muted/60',
                )}
                onClick={() => setActiveId(item.id)}
              >
                <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  {isImageFile(item.file) ? (
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-0.5 text-muted-foreground">
                      <FileText className="size-5" aria-hidden />
                      <span className="text-[9px] font-medium">PDF</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(item.file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${item.file.name} 제거`}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(item.id)
                  }}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>

          {activeItem && isImageFile(activeItem.file) ? (
            <TableDetectionPreview
              key={activeItem.id}
              fileId={activeItem.id}
              imageUrl={activeItem.previewUrl}
              file={activeItem.file}
            />
          ) : activeItem ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              PDF는 표 검출 미리보기를 지원하지 않습니다.
            </p>
          ) : null}

          <Button type="button" size="lg" className="w-full" disabled>
            엑셀로 변환 (곧 제공)
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            변환 기능은 다음 단계에서 연결됩니다.
          </p>
        </section>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        지원 형식: {UPLOAD_ACCEPT_LABEL} · Ctrl+V 붙여넣기
      </p>
    </div>
  )
}

type DropzoneSurfaceProps = {
  getRootProps: ReturnType<typeof useDropzone>['getRootProps']
  getInputProps: ReturnType<typeof useDropzone>['getInputProps']
  isDragActive: boolean
  isDragReject: boolean
  onBrowse: () => void
  hasFiles: boolean
}

function DropzoneSurface({
  getRootProps,
  getInputProps,
  isDragActive,
  isDragReject,
  onBrowse,
  hasFiles,
}: DropzoneSurfaceProps) {
  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
        'border-border/90 bg-card/60 shadow-sm hover:border-primary/35 hover:bg-accent/40',
        isDragActive && !isDragReject &&
          'border-primary bg-primary/8 ring-4 ring-primary/15',
        isDragReject && 'border-destructive bg-destructive/5',
        hasFiles && 'py-10',
      )}
    >
      <input {...getInputProps()} aria-label="이미지 파일 선택" />
      <div
        className={cn(
          'flex size-14 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border/80',
          isDragActive && !isDragReject && 'bg-primary/10 ring-primary/50',
        )}
      >
        {isDragReject ? (
          <AlertCircle className="size-6 text-destructive" aria-hidden />
        ) : isDragActive ? (
          <FileImage className="size-6 text-primary" aria-hidden />
        ) : (
          <Upload className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-base font-medium text-foreground">
          {isDragReject
            ? '이미지 파일만 올릴 수 있습니다'
            : isDragActive
              ? '여기에 놓으세요'
              : '이미지·PDF를 끌어다 놓거나 Ctrl+V'}
        </p>
        <p className="text-sm text-muted-foreground">
          클립보드의 스크린샷·복사한 파일도 바로 추가됩니다
        </p>
      </div>
      <Button type="button" variant="secondary" size="lg" onClick={onBrowse}>
        파일 선택
      </Button>
    </div>
  )
}