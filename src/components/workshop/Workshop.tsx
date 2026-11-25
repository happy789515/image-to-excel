import { useEffect, useRef, useState } from 'react'

import { TableDetectionPreview } from '@/components/TableDetectionPreview'
import { WorkshopSidebar } from '@/components/workshop/WorkshopSidebar'
import { WorkflowStepBar } from '@/components/workshop/WorkflowStepBar'
import { isImageFile } from '@/lib/image-upload'
import type { WorkshopStepBridge } from '@/lib/workflow/workshop-step-bridge'
import { useUploadQueue } from '@/lib/workflow/use-upload-queue'
import { useWorkflowPhase } from '@/lib/workflow/use-workflow-phase'
import type { WorkshopStepId } from '@/lib/workflow/workshop-steps'
import type { WorkflowPhaseId } from '@/lib/workflow/types'

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

  const startedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!activeItem) return
    if (startedRef.current.has(activeItem.id)) return
    startedRef.current.add(activeItem.id)
    if (!isImageFile(activeItem.file)) {
      setWorkflowPhase('error', 'PDF는 표 검출을 지원하지 않습니다.')
    }
  }, [activeItem, setWorkflowPhase])

  const onPhase = (p: WorkflowPhaseId, detail?: string) =>
    setWorkflowPhase(p, detail ?? null)

  return (
    <div className="flex min-h-0 flex-1 w-full flex-col lg:flex-row">
      <WorkshopSidebar
        queue={queue}
        activeId={activeId}
        onSelect={setActiveId}
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

        <div className="flex min-h-0 flex-1 flex-col">
          <WorkPanel
            activeItem={activeItem}
            onPhase={onPhase}
            onStepBridgeChange={setStepBridge}
          />
        </div>
      </div>
    </div>
  )
}

function WorkPanel({
  activeItem,
  onPhase,
  onStepBridgeChange,
}: {
  activeItem: ReturnType<typeof useUploadQueue>['activeItem']
  onPhase: (p: WorkflowPhaseId, detail?: string) => void
  onStepBridgeChange: (bridge: WorkshopStepBridge | null) => void
}) {
  if (!activeItem) {
    return (
      <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        이미지를 선택하면 검출 화면이 열립니다.
      </p>
    )
  }

  if (!isImageFile(activeItem.file)) {
    return (
      <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        PDF는 현재 브라우저 표 검출 미리보기를 지원하지 않습니다.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
      <TableDetectionPreview
        key={activeItem.id}
        fileId={activeItem.id}
        imageUrl={activeItem.previewUrl}
        file={activeItem.file}
        onPhase={onPhase}
        onStepBridgeChange={onStepBridgeChange}
      />
    </div>
  )
}