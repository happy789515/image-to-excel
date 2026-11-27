import { useContext } from 'react'

import { ProjectWorkshopContext } from '@/context/project-workshop-context'

export function useProjectWorkshop() {
  const ctx = useContext(ProjectWorkshopContext)
  if (!ctx) {
    throw new Error(
      'useProjectWorkshop must be used within ProjectWorkshopProvider',
    )
  }
  return ctx
}