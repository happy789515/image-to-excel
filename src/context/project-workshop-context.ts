import { createContext } from 'react'

import type { ProjectDetail } from '@/lib/api/projects'
import type { StepAccess } from '@/components/workshop/WorkflowStepBar'
import type { WorkshopStepId } from '@/lib/workflow/workshop-steps'

export type ProjectWorkshopContextValue = {
  projectId: string
  detail: ProjectDetail
  setDetail: (detail: ProjectDetail) => void
  reload: () => Promise<void>
  step: WorkshopStepId
  setStep: (step: WorkshopStepId) => void
  stepAccess: StepAccess
  loadError: string | null
}

export const ProjectWorkshopContext =
  createContext<ProjectWorkshopContextValue | null>(null)