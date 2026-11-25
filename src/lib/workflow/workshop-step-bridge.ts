import type { StepAccess } from '@/components/workshop/WorkflowStepBar'
import type { WorkshopStepId } from '@/lib/workflow/workshop-steps'

export type WorkshopStepBridge = {
  fileId: string
  current: WorkshopStepId
  access: StepAccess
  busy: boolean
  navigate: (step: WorkshopStepId) => void
  reviewDirty: boolean
  reviewCommitted: boolean
  /** Convert produced sheet data that is still valid for current boxes. */
  exportReady: boolean
}