import { useCallback, useState } from 'react'
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone'
import {
  AlertCircle,
  FileImage,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileQueueStepProgress } from '@/components/workshop/FileQueueStepProgress'
import type { ProjectImageItem } from '@/hooks/use-project-images'
import {
  formatFileSize,
  MAX_IMAGE_FILES,
  PROJECT_UPLOAD_ACCEPT_LABEL,
} from '@/lib/image-upload'
import { MAX_PROJECT_IMAGES } from '@/lib/project/constants'
import type { ProjectDetail } from '@/lib/api/projects'
import { tableCountForImage } from '@/lib/project/selectors'
import {
  listItemTransition,
  motionInitial,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import { fadeSlideFromLeft } from '@/lib/motion/variants'
import { cn } from 'cn'

type Props = {
  detail: ProjectDetail
  queue: ProjectImageItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onAppend: (accepted: File[], rejected: FileRejection[]) => void
  accept: Accept
  error: string | null
  uploading: boolean
}

export function WorkshopSidebar({
  detail,
  queue,
  activeId,
  onSelect,
  onRemove,
  onAppend,
  accept,
  error,
  uploading,
}: Props) {
  const reduced = useReducedMotion()
  const itemTransition = listItemTransition(reduced)

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      void onAppend(accepted, rejected)
    },
    [onAppend],
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } =
    useDropzone({
      onDrop,
      accept,
      maxFiles: MAX_PROJECT_IMAGES,
      noClick: true,
      noKeyboard: false,
    })

  const totalSize = queue.reduce((sum, item) => sum + item.size, 0)

  return (
    <aside className="flex h-full w-72 max-w-[min(100%,20rem)] shrink-0 min-w-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-3 py-3">
        <p className="text-sm font-semibold text-foreground">이미지</p>
        <p className="text-xs text-muted-foreground">
          프로젝트당 최대 {MAX_IMAGE_FILES}장
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <m.div
          animate={{
            scale: !reduced && isDragActive && !isDragReject ? 1.02 : 1,
          }}
          transition={itemTransition}
          className="shrink-0"
        >
          <div
            {...getRootProps()}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border border-dashed border-sidebar-border px-3 py-4 text-center transition-colors',
              'bg-card hover:border-primary/35',
              isDragActive &&
                !isDragReject &&
                'border-primary bg-primary/8 ring-2 ring-primary/20',
              isDragReject && 'border-destructive bg-destructive/5',
            )}
          >
            <input {...getInputProps()} aria-label="이미지 파일 선택" />
            <div className="flex size-10 items-center justify-center rounded-full bg-background ring-1 ring-border">
              {isDragReject ? (
                <AlertCircle className="size-5 text-destructive" aria-hidden />
              ) : isDragActive ? (
                <FileImage className="size-5 text-primary" aria-hidden />
              ) : (
                <Upload className="size-5 text-muted-foreground" aria-hidden />
              )}
            </div>
            <p className="text-xs font-medium text-foreground">
              {uploading
                ? '업로드 중…'
                : isDragReject
                  ? '지원하지 않는 형식'
                  : isDragActive
                    ? '여기에 놓기'
                    : '드래그 · Ctrl+V'}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={open}
            >
              파일 업로드
            </Button>
          </div>
        </m.div>

        {error ? (
          <Alert variant="destructive" className="shrink-0 py-2">
            <AlertCircle aria-hidden />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

        {queue.length > 0 ? (
          <>
            <p className="shrink-0 text-xs text-muted-foreground">
              {queue.length}개 · {formatFileSize(totalSize)}
            </p>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              <AnimatePresence initial={false}>
                {queue.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    active={activeId === item.id}
                    detected={
                      detail.images.find((img) => img.id === item.id)
                        ?.detection != null
                    }
                    tableCount={tableCountForImage(detail, item.id)}
                    reduced={reduced}
                    transition={itemTransition}
                    onSelect={() => onSelect(item.id)}
                    onRemove={() => void onRemove(item.id)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            {PROJECT_UPLOAD_ACCEPT_LABEL} · 서버에 저장
          </p>
        )}
      </div>
    </aside>
  )
}

function QueueRow({
  item,
  active,
  detected,
  tableCount,
  reduced,
  transition,
  onSelect,
  onRemove,
}: {
  item: ProjectImageItem
  active: boolean
  detected: boolean
  tableCount: number
  reduced: boolean
  transition: ReturnType<typeof listItemTransition>
  onSelect: () => void
  onRemove: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <m.li
      layout={!reduced}
      variants={fadeSlideFromLeft}
      initial={motionInitial(reduced)}
      animate="animate"
      exit="exit"
      transition={transition}
    >
      <div
        className={cn(
          'relative flex w-full items-center gap-1 rounded-lg border border-transparent bg-card px-2 py-2 transition-colors',
          active && 'border-primary/30 bg-primary/10 ring-1 ring-inset ring-primary/25',
        )}
      >
        <button
          type="button"
          aria-label={`${item.name} 크게 보기`}
          onClick={() => setPreviewOpen(true)}
          className="group/thumb size-10 shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={item.previewUrl}
            alt=""
            className="size-full object-cover transition-transform duration-200 ease-out group-hover/thumb:scale-110 motion-reduce:transition-none"
          />
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="group/select relative flex min-w-0 flex-1 items-center rounded-md pl-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-xs font-medium transition-[font-weight] duration-150 group-hover/select:font-bold motion-reduce:transition-none"
              title={item.name}
            >
              {item.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatFileSize(item.size)}
            </span>
            <FileQueueStepProgress
              detected={detected}
              tableCount={tableCount}
              className="mt-1"
            />
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={`${item.name} 제거`}
          onClick={() => setConfirmOpen(true)}
        >
          <X />
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-4xl" showCloseButton>
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{item.name}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[75vh] justify-center overflow-auto rounded-lg bg-muted">
            <img
              src={item.previewUrl}
              alt={item.name}
              className="max-h-[75vh] w-auto max-w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>이미지 삭제</DialogTitle>
            <DialogDescription>
              「{item.name}」과 검출된 표가 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false)
                onRemove()
              }}
            >
              <Trash2 className="size-3.5" />
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </m.li>
  )
}