import { loadDetectionResult } from '@/lib/detection-persist'
import type { WorkshopStepBridge } from '@/lib/workflow/workshop-step-bridge'
import {
  type WorkshopStepId,
  workshopStepIndex,
} from '@/lib/workflow/workshop-steps'
import { exportSessionMatches } from '@/lib/workshop-export-signature'
import { loadWorkshopSession } from '@/lib/workshop-persist'
import type { StoredDetection } from '@/lib/detection-persist'
import type { StoredWorkshopSession } from '@/lib/workshop-persist'

export type FileWorkshopProgress = {
  step: WorkshopStepId
  detectDone: boolean
  convertDone: boolean
  reviewDone: boolean
}

export function deriveFileWorkshopProgress(
  detection: StoredDetection | null,
  session: StoredWorkshopSession | null,
): FileWorkshopProgress {
  const detectDone = Boolean(detection?.boxes.length)
  const exportOk =
    Boolean(session) &&
    Boolean(detection) &&
    exportSessionMatches(session!, detection!.boxes)

  const convertDone = exportOk
  const reviewDone = exportOk && Boolean(session?.reviewCommitted)
  const step: WorkshopStepId =
    session?.workshopStep ??
    (reviewDone ? 'review' : convertDone ? 'convert' : 'detect')

  return { step, detectDone, convertDone, reviewDone }
}

export async function loadFileWorkshopProgress(
  fileId: string,
): Promise<FileWorkshopProgress> {
  const [detection, session] = await Promise.all([
    loadDetectionResult(fileId),
    loadWorkshopSession(fileId),
  ])
  return deriveFileWorkshopProgress(detection, session)
}

export async function loadQueueWorkshopProgress(
  fileIds: string[],
): Promise<Record<string, FileWorkshopProgress>> {
  if (fileIds.length === 0) return {}
  const entries = await Promise.all(
    fileIds.map(async (id) => {
      try {
        return [id, await loadFileWorkshopProgress(id)] as const
      } catch {
        return [
          id,
          {
            step: 'detect' as const,
            detectDone: false,
            convertDone: false,
            reviewDone: false,
          },
        ] as const
      }
    }),
  )
  return Object.fromEntries(entries)
}

/** Live progress for the actively edited image (from step bar bridge). */
export function progressFromStepAccess(
  step: WorkshopStepId,
  access: { convert: boolean; review: boolean },
  reviewCommitted: boolean,
  exportReady = false,
): FileWorkshopProgress {
  const idx = workshopStepIndex(step)
  return {
    step,
    detectDone: idx > 0 || access.convert,
    convertDone: idx > 1 || access.review || (idx === 1 && exportReady),
    reviewDone:
      step === 'review' && reviewCommitted,
  }
}

export function patchActiveFileProgress(
  loaded: Record<string, FileWorkshopProgress>,
  bridge: WorkshopStepBridge | null,
): Record<string, FileWorkshopProgress> {
  if (!bridge) return loaded
  return {
    ...loaded,
    [bridge.fileId]: progressFromStepAccess(
      bridge.current,
      bridge.access,
      bridge.reviewCommitted,
      bridge.exportReady,
    ),
  }
}