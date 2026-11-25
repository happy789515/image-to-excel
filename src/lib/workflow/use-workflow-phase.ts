import { useCallback, useEffect, useRef, useState } from 'react'

import type { WorkflowPhaseId } from './types'

export function useWorkflowPhase(fileId: string | null) {
  const [phase, setPhase] = useState<WorkflowPhaseId>('idle')
  const [phaseDetail, setPhaseDetail] = useState<string | null>(null)
  const [errorAt, setErrorAt] = useState<WorkflowPhaseId | null>(null)
  const phaseStoreRef = useRef<
    Map<
      string,
      {
        phase: WorkflowPhaseId
        detail: string | null
        errorAt: WorkflowPhaseId | null
      }
    >
  >(new Map())

  useEffect(() => {
    if (!fileId) {
      setPhase('idle')
      setPhaseDetail(null)
      setErrorAt(null)
      return
    }
    const saved = phaseStoreRef.current.get(fileId)
    setPhase(saved?.phase ?? 'idle')
    setPhaseDetail(saved?.detail ?? null)
    setErrorAt(saved?.errorAt ?? null)
  }, [fileId])

  const setWorkflowPhase = useCallback(
    (next: WorkflowPhaseId, detail?: string | null) => {
      if (!fileId) return
      setPhase(next)
      const d = detail ?? null
      setPhaseDetail(d)

      let at: WorkflowPhaseId | null = null
      if (next === 'error') {
        const prev = phaseStoreRef.current.get(fileId)?.phase
        at =
          prev &&
          prev !== 'error' &&
          prev !== 'idle' &&
          prev !== 'complete'
            ? prev
            : 'review'
        setErrorAt(at)
      } else {
        setErrorAt(null)
      }

      phaseStoreRef.current.set(fileId, {
        phase: next,
        detail: d,
        errorAt: at,
      })
    },
    [fileId],
  )

  return { phase, phaseDetail, errorAt, setWorkflowPhase }
}