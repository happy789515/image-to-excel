import type { StepAccess } from '@/components/workshop/WorkflowStepBar'
import type { WorkshopStepId } from '@/lib/workflow/workshop-steps'

export type WorkshopStepBridge = {
  current: WorkshopStepId
  access: StepAccess
  busy: boolean
  navigate: (step: WorkshopStepId) => void
  reviewDirty: boolean
  reviewCommitted: boolean
}