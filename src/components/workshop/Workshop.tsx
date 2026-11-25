import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Images } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'

import { TableDetectionPreview } from '@/components/TableDetectionPreview'
import { WorkshopSidebar } from '@/components/workshop/WorkshopSidebar'
import { WorkflowStepBar } from '@/components/workshop/WorkflowStepBar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isImageFile } from '@/lib/image-upload'
import type { WorkshopStepBridge } from '@/lib/workflow/workshop-step-bridge'
import { useUploadQueue } from '@/lib/workflow/use-upload-queue'
import { useWorkflowPhase } from '@/lib/workflow/use-workflow-phase'
import type { WorkshopStepId } from '@/lib/workflow/workshop-steps'
import type { WorkflowPhaseId } from '@/lib/workflow/types'
import {
  loadQueueWorkshopProgress,
  patchActiveFileProgress,
  progressFromStepAccess,
  type FileWorkshopProgress,
} from '@/lib/workshop-progress'
import {
  motionInitial,
  motionTransition,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import {
  fadeUp,
  springSnappy,
  staggerContainerFast,
  staggerItem,
} from '@/lib/motion/variants'

export function Workshop() {
  const {
    queue,
    activeId,
    activeItem,
    error,
    setActiveId,
    appendFiles,
    removeFile,
    clearAll,
    accept,
  } = useUploadQueue()

  const { setWorkflowPhase } = useWorkflowPhase(activeId)
  const [stepBridge, setStepBridge] = useState<WorkshopStepBridge | null>(null)
  const [pendingFileId, setPendingFileId] = useState<string | null>(null)
  const [progressByFileId, setProgressByFileId] = useState<
    Record<string, FileWorkshopProgress>
  >({})
  const stepBridgeRef = useRef<WorkshopStepBridge | null>(null)

  const queueKey = useMemo(
    () => queue.map((item) => item.id).join('\0'),
    [queue],
  )

  useEffect(() => {
    const ids = queue.map((item) => item.id)
    let cancelled = false
    void loadQueueWorkshopProgress(ids).then((loaded) => {
      if (cancelled) return
      setProgressByFileId((prev) =>
        patchActiveFileProgress(
          { ...prev, ...loaded },
          stepBridgeRef.current,
        ),
      )
    })
    return () => {
      cancelled = true
    }
  }, [queue, queueKey])

  const handleStepBridgeChange = useCallback(
    (bridge: WorkshopStepBridge | null) => {
      stepBridgeRef.current = bridge
      setStepBridge(bridge)
      if (bridge) {
        setProgressByFileId((prev) => ({
          ...prev,
          [bridge.fileId]: progressFromStepAccess(
            bridge.current,
            bridge.access,
            bridge.reviewCommitted,
            bridge.exportReady,
          ),
        }))
      }
    },
    [],
  )

  const handleSelectFile = useCallback(
    (id: string) => {
      if (id === activeId) return
      if (stepBridge?.reviewDirty) {
        setPendingFileId(id)
        return
      }
      setActiveId(id)
    },
    [activeId, setActiveId, stepBridge?.reviewDirty],
  )

  const startedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!activeItem) return
    if (startedRef.current.has(activeItem.id)) return
    startedRef.current.add(activeItem.id)
    if (!isImageFile(activeItem.file)) {
      setWorkflowPhase('error', 'PDF는 표 검출을 지원하지 않습니다.')
    }
  }, [activeItem, setWorkflowPhase])

  const onPhase = useCallback(
    (p: WorkflowPhaseId, detail?: string) =>
      setWorkflowPhase(p, detail ?? null),
    [setWorkflowPhase],
  )

  return (
    <div className="flex min-h-0 flex-1 w-full flex-col lg:flex-row">
      <WorkshopSidebar
        queue={queue}
        activeId={activeId}
        progressByFileId={progressByFileId}
        onSelect={handleSelectFile}
        onRemove={removeFile}
        onAppend={appendFiles}
        onClearAll={clearAll}
        accept={accept}
        error={error}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        {activeItem && isImageFile(activeItem.file) && stepBridge ? (
          <WorkflowStepBar
            current={stepBridge.current}
            access={stepBridge.access}
            busy={stepBridge.busy}
            onNavigate={stepBridge.navigate}
          />
        ) : (
          <WorkflowStepBar
            current={'detect' satisfies WorkshopStepId}
            access={{ detect: true, convert: false, review: false }}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <WorkPanel
            panelKey={activeItem?.id ?? 'empty'}
            activeItem={activeItem}
            onPhase={onPhase}
            onStepBridgeChange={handleStepBridgeChange}
          />
        </div>
      </div>

      <Dialog
        open={pendingFileId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingFileId(null)
        }}
      >
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>저장되지 않은 변경사항</DialogTitle>
            <DialogDescription>
              검수 단계에서 수정한 내용이 아직 저장되지 않았습니다. 저장하지 않고
              다른 이미지로 이동하면 변경 사항이 사라집니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingFileId(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const id = pendingFileId
                setPendingFileId(null)
                if (id) setActiveId(id)
              }}
            >
              저장 안 함
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WorkPanel({
  panelKey,
  activeItem,
  onPhase,
  onStepBridgeChange,
}: {
  panelKey: string
  activeItem: ReturnType<typeof useUploadQueue>['activeItem']
  onPhase: (p: WorkflowPhaseId, detail?: string) => void
  onStepBridgeChange: (bridge: WorkshopStepBridge | null) => void
}) {
  const reduced = useReducedMotion()
  const transition = motionTransition(reduced, springSnappy)

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={panelKey}
        className="flex min-h-0 flex-1 flex-col"
        variants={fadeUp}
        initial={motionInitial(reduced)}
        animate="animate"
        exit="exit"
        transition={transition}
      >
        {!activeItem ? (
          <m.div
            className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
            role="status"
            variants={staggerContainerFast}
            initial={motionInitial(reduced)}
            animate="animate"
          >
            <m.div
              variants={staggerItem}
              transition={transition}
              className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20"
              aria-hidden
            >
              <Images className="size-8 text-primary" strokeWidth={1.75} />
            </m.div>
            <m.p
              variants={staggerItem}
              transition={transition}
              className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
            >
              이미지를 선택해 주세요
            </m.p>
            <m.p
              variants={staggerItem}
              transition={transition}
              className="max-w-md text-sm text-muted-foreground sm:text-base"
            >
              왼쪽 목록에서 이미지를 고르면 표 검출 화면이 열립니다.
            </m.p>
          </m.div>
        ) : !isImageFile(activeItem.file) ? (
          <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            PDF는 현재 브라우저 표 검출 미리보기를 지원하지 않습니다.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <TableDetectionPreview
              fileId={activeItem.id}
              imageUrl={activeItem.previewUrl}
              file={activeItem.file}
              onPhase={onPhase}
              onStepBridgeChange={onStepBridgeChange}
            />
          </div>
        )}
      </m.div>
    </AnimatePresence>
  )
}