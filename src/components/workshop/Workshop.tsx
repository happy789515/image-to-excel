import { useCallback, useEffect, useMemo, useState } from 'react'
import { Images, Loader2 } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'

import { TableDetectionPreview } from '@/components/TableDetectionPreview'
import { GroupStepView } from '@/components/workshop/GroupStepView'
import { ProjectConvertStepView } from '@/components/workshop/ProjectConvertStepView'
import { ProjectReviewStepView } from '@/components/workshop/ProjectReviewStepView'
import { WorkshopSidebar } from '@/components/workshop/WorkshopSidebar'
import { WorkflowStepBar } from '@/components/workshop/WorkflowStepBar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDetectPendingImages } from '@/hooks/use-detect-pending-images'
import { useProjectWorkshop } from '@/hooks/use-project-workshop'
import { useProjectImages } from '@/hooks/use-project-images'
import { tablesForImage } from '@/lib/project/selectors'
import type { WorkshopStepId } from '@/lib/workflow/workshop-steps'
import {
  motionInitial,
  motionTransition,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import { fadeUp, springSnappy } from '@/lib/motion/variants'

export function Workshop() {
  const {
    detail,
    setDetail,
    step,
    setStep,
    stepAccess,
    loadError,
  } = useProjectWorkshop()

  const images = useProjectImages({
    projectId: detail.project.id,
    detail,
    onDetail: setDetail,
  })
  const { activeId, fetchImageBlob } = images

  useDetectPendingImages({
    projectId: detail.project.id,
    detail,
    activeId,
    fetchImageBlob,
    onDetail: setDetail,
  })

  const [detectBusy, setDetectBusy] = useState(false)
  const [loadedBlob, setLoadedBlob] = useState<{
    id: string
    blob: Blob
  } | null>(null)
  const [imageLoadError, setImageLoadError] = useState<string | null>(null)

  const activeImage = useMemo(
    () => detail.images.find((i) => i.id === images.activeId) ?? null,
    [detail.images, images.activeId],
  )

  const serverTables = useMemo(
    () =>
      images.activeId
        ? tablesForImage(detail, images.activeId)
        : [],
    [detail, images.activeId],
  )

  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    void fetchImageBlob(activeId)
      .then((blob) => {
        if (!cancelled) {
          setLoadedBlob({ id: activeId, blob })
          setImageLoadError(null)
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof Error && err.name === 'AbortError') return
        setImageLoadError(
          err instanceof Error ? err.message : '이미지를 불러오지 못했습니다.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [activeId, fetchImageBlob])

  const imageBlob =
    loadedBlob && loadedBlob.id === activeId ? loadedBlob.blob : null

  const navigateStep = useCallback(
    (target: WorkshopStepId) => {
      if (!stepAccess[target]) return
      setStep(target)
    },
    [setStep, stepAccess],
  )

  const stepBusy = detectBusy

  return (
    <div className="flex min-h-0 flex-1 w-full flex-row">
      <WorkshopSidebar
        detail={detail}
        queue={images.queue}
        activeId={images.activeId}
        onSelect={images.setActiveId}
        onRemove={images.removeFile}
        onAppend={images.appendFiles}
        accept={images.accept}
        error={images.error}
        uploading={images.uploading}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <WorkflowStepBar
          current={step}
          access={stepAccess}
          busy={stepBusy}
          onNavigate={navigateStep}
        />

        {loadError ? (
          <Alert variant="destructive" className="m-3 mb-0">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {step === 'detect' ? (
            <DetectPanel
              activeId={images.activeId}
              activeItem={images.activeItem}
              imageLoadError={imageLoadError}
              activeImage={activeImage}
              serverTables={serverTables}
              imageBlob={imageBlob}
              onBusyChange={setDetectBusy}
            />
          ) : null}
          {step === 'group' ? (
            <GroupStepView fetchImageBlob={images.fetchImageBlob} />
          ) : null}
          {step === 'convert' ? (
            <ProjectConvertStepView fetchImageBlob={images.fetchImageBlob} />
          ) : null}
          {step === 'review' ? <ProjectReviewStepView /> : null}
        </div>
      </div>
    </div>
  )
}

function DetectPanel({
  activeId,
  activeItem,
  imageLoadError,
  activeImage,
  serverTables,
  imageBlob,
  onBusyChange,
}: {
  activeId: string | null
  activeItem: ReturnType<typeof useProjectImages>['activeItem']
  imageLoadError: string | null
  activeImage: ReturnType<typeof useProjectWorkshop>['detail']['images'][number] | null
  serverTables: ReturnType<typeof tablesForImage>
  imageBlob: Blob | null
  onBusyChange: (busy: boolean) => void
}) {
  const reduced = useReducedMotion()
  const transition = motionTransition(reduced, springSnappy)

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={activeId ?? 'empty'}
        className="flex min-h-0 flex-1 flex-col"
        variants={fadeUp}
        initial={motionInitial(reduced)}
        animate="animate"
        exit="exit"
        transition={transition}
      >
        {imageLoadError ? (
          <Alert variant="destructive" className="m-3">
            <AlertDescription>{imageLoadError}</AlertDescription>
          </Alert>
        ) : null}

        {!activeItem ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Images className="size-8 text-primary" strokeWidth={1.75} />
            </div>
            <p className="text-xl font-semibold tracking-tight">이미지를 추가하세요</p>
            <p className="max-w-md text-base text-muted-foreground">
              왼쪽에서 이미지를 업로드하면 표 검출을 시작할 수 있습니다.
            </p>
          </div>
        ) : !imageBlob ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <TableDetectionPreview
              imageId={activeItem.id}
              imageUrl={activeItem.previewUrl}
              imageBlob={imageBlob}
              serverTables={serverTables}
              detectionMeta={activeImage?.detection ?? null}
              onBusyChange={onBusyChange}
            />
          </div>
        )}
      </m.div>
    </AnimatePresence>
  )
}