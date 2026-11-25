import { useCallback, useState } from 'react'

import type { WorkflowPhaseId } from './types'

type PhaseSnapshot = {
  phase: WorkflowPhaseId
  detail: string | null
  errorAt: WorkflowPhaseId | null
}

const IDLE: PhaseSnapshot = { phase: 'idle', detail: null, errorAt: null }

export function useWorkflowPhase(fileId: string | null) {
  const [phaseByFileId, setPhaseByFileId] = useState<
    Record<string, PhaseSnapshot>
  >({})

  const snapshot: PhaseSnapshot = fileId
    ? (phaseByFileId[fileId] ?? IDLE)
    : IDLE

  const setWorkflowPhase = useCallback(
    (next: WorkflowPhaseId, detail?: string | null) => {
      if (!fileId) return
      const d = detail ?? null

      setPhaseByFileId((prev) => {
        let errorAt: WorkflowPhaseId | null = null
        if (next === 'error') {
          const prevPhase = prev[fileId]?.phase
          errorAt =
            prevPhase &&
            prevPhase !== 'error' &&
            prevPhase !== 'idle' &&
            prevPhase !== 'complete'
              ? prevPhase
              : 'review'
        }
        return {
          ...prev,
          [fileId]: { phase: next, detail: d, errorAt },
        }
      })
    },
    [fileId],
  )

  return {
    phase: snapshot.phase,
    phaseDetail: snapshot.detail,
    errorAt: snapshot.errorAt,
    setWorkflowPhase,
  }
}