import { useCallback, useMemo, useState, type ReactNode } from 'react'

import type { ProjectDetail } from '@/lib/api/projects'
import { getProject } from '@/lib/api/projects'
import { deriveStepAccess, defaultWorkshopStep } from '@/lib/project/selectors'
import type { WorkshopStepId } from '@/lib/workflow/workshop-steps'
import { ProjectWorkshopContext } from '@/context/project-workshop-context'

export function ProjectWorkshopProvider({
  projectId,
  initialDetail,
  children,
}: {
  projectId: string
  initialDetail: ProjectDetail
  children: ReactNode
}) {
  const [detail, setDetail] = useState(initialDetail)
  const [step, setStep] = useState<WorkshopStepId>(() =>
    defaultWorkshopStep(initialDetail),
  )
  const [loadError, setLoadError] = useState<string | null>(null)

  const stepAccess = useMemo(() => deriveStepAccess(detail), [detail])

  const reload = useCallback(async () => {
    try {
      const next = await getProject(projectId)
      setDetail(next)
      setLoadError(null)
    } catch (err) {
      if (err instanceof Error) setLoadError(err.message)
    }
  }, [projectId])

  const value = useMemo(
    () => ({
      projectId,
      detail,
      setDetail,
      reload,
      step,
      setStep,
      stepAccess,
      loadError,
    }),
    [detail, loadError, projectId, reload, step, stepAccess],
  )

  return (
    <ProjectWorkshopContext.Provider value={value}>
      {children}
    </ProjectWorkshopContext.Provider>
  )
}