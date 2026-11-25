import { useCallback, useEffect, useState } from 'react'

import App from '@/App.tsx'
import { BootScreen } from '@/components/BootScreen'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  bootstrapTableDetection,
  type BootPhase,
} from '@/lib/table-detection/bootstrap'

const INITIAL_PHASE: BootPhase = {
  id: 'app-init',
  detail: '시작하는 중…',
}

export function AppRoot() {
  const [phase, setPhase] = useState<BootPhase>(INITIAL_PHASE)
  const [ready, setReady] = useState(false)
  const [bootKey, setBootKey] = useState(0)

  const runBootstrap = useCallback(() => {
    void bootstrapTableDetection(setPhase)
      .then(() => {
        window.setTimeout(() => setReady(true), 400)
      })
      .catch(() => {
        /* phase set to error in bootstrap */
      })
  }, [])

  useEffect(() => {
    runBootstrap()
  }, [runBootstrap, bootKey])

  const handleRetry = useCallback(() => {
    setReady(false)
    setPhase(INITIAL_PHASE)
    setBootKey((key) => key + 1)
  }, [])

  return (
    <>
      <ThemeToggle className="fixed top-4 right-4 z-50 sm:top-5 sm:right-6" />
      {!ready ? (
        <BootScreen
          phase={phase}
          onRetry={phase.id === 'error' ? handleRetry : undefined}
        />
      ) : (
        <App />
      )}
    </>
  )
}