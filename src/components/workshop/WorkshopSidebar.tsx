import { useCallback, useState } from 'react'
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone'
import {
  AlertCircle,
  FileImage,
  FileText,
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
import {
  formatFileSize,
  isImageFile,
  MAX_IMAGE_FILES,
  UPLOAD_ACCEPT_LABEL,
} from '@/lib/image-upload'
import { FileQueueStepProgress } from '@/components/workshop/FileQueueStepProgress'
import type { FileWorkshopProgress } from '@/lib/workshop-progress'
import type { QueuedImage } from '@/lib/workflow/use-upload-queue'
import {
  listItemTransition,
  motionInitial,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import { fadeSlideFromLeft } from '@/lib/motion/variants'
import { cn } from 'cn'

type Props = {
  queue: QueuedImage[]
  activeId: string | null
  progressByFileId: Record<string, FileWorkshopProgress>
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onAppend: (accepted: File[], rejected: FileRejection[]) => void
  onClearAll: () => void
  accept: Accept
  error: string | null
}

export function WorkshopSidebar({
  queue,
  activeId,
  progressByFileId,
  onSelect,
  onRemove,
  onAppend,
  onClearAll,
  accept,
  error,
}: Props) {
  const reduced = useReducedMotion()
  const itemTransition = listItemTransition(reduced)

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      onAppend(accepted, rejected)
    },
    [onAppend],
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } =
    useDropzone({
      onDrop,
      accept,
      maxFiles: MAX_IMAGE_FILES,
      noClick: true,
      noKeyboard: false,
    })

  const totalSize = queue.reduce((sum, item) => sum + item.file.size, 0)
  const [clearAllOpen, setClearAllOpen] = useState(false)

  const confirmClearAll = () => {
    onClearAll()
    setClearAllOpen(false)
  }

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:w-72 lg:max-w-[min(100%,20rem)] xl:w-80">
      <div className="border-b border-sidebar-border px-3 py-3">
        <p className="text-sm font-semibold text-foreground">이미지</p>
        <p className="text-xs text-muted-foreground">
          파일마다 독립 워크플로 · 최대 {MAX_IMAGE_FILES}개
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
            {isDragReject
              ? '지원하지 않는 형식'
              : isDragActive
                ? '여기에 놓기'
                : '드래그 · Ctrl+V'}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={open}>
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
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {queue.length}개 · {formatFileSize(totalSize)}
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setClearAllOpen(true)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                전체 삭제
              </Button>
            </div>
            <Dialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
              <DialogContent className="sm:max-w-sm" showCloseButton>
                <DialogHeader>
                  <DialogTitle>전체 이미지를 삭제할까요?</DialogTitle>
                  <DialogDescription>
                    목록의 {queue.length}개 파일과 각 파일의 검출·변환 기록이
                    모두 지워집니다. 되돌릴 수 없습니다.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setClearAllOpen(false)}
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={confirmClearAll}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    삭제
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              <AnimatePresence initial={false}>
                {queue.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    active={activeId === item.id}
                    progress={progressByFileId[item.id]}
                    reduced={reduced}
                    transition={itemTransition}
                    onSelect={() => onSelect(item.id)}
                    onRemove={() => onRemove(item.id)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            {UPLOAD_ACCEPT_LABEL} · 이 기기에만 저장
          </p>
        )}
      </div>
    </aside>
  )
}

function QueueRow({
  item,
  active,
  progress,
  reduced,
  transition,
  onSelect,
  onRemove,
}: {
  item: QueuedImage
  active: boolean
  progress: FileWorkshopProgress | undefined
  reduced: boolean
  transition: ReturnType<typeof listItemTransition>
  onSelect: () => void
  onRemove: () => void
}) {
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
        {active && !reduced ? (
          <m.span
            layoutId="sidebar-active-accent"
            className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-primary"
            transition={transition}
            aria-hidden
          />
        ) : null}
        <button
          type="button"
          onClick={onSelect}
          className="relative flex min-w-0 flex-1 items-center gap-2 rounded-md pl-1 text-left transition-colors hover:bg-background"
        >
          <ThumbPreview file={item.file} previewUrl={item.previewUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">
              {item.file.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatFileSize(item.file.size)}
            </span>
            {isImageFile(item.file) ? (
              <FileQueueStepProgress progress={progress} className="mt-1" />
            ) : null}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={`${item.file.name} 제거`}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
    </m.li>
  )
}

function ThumbPreview({
  file,
  previewUrl,
}: {
  file: File
  previewUrl: string
}) {
  return (
    <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {isImageFile(file) ? (
        <img src={previewUrl} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center text-muted-foreground">
          <FileText className="size-4" aria-hidden />
        </div>
      )}
    </div>
  )
}