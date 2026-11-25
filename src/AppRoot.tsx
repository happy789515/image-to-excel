import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import App from '@/App.tsx'
import { BootScreen } from '@/components/BootScreen'
import { LoginScreen } from '@/components/LoginScreen'
import { ThemeToggle } from '@/components/ThemeToggle'
import { checkAuth, logoutApi } from '@/lib/api/auth'
import {
  bootstrapTableDetection,
  type BootPhase,
} from '@/lib/table-detection/bootstrap'

const INITIAL_PHASE: BootPhase = {
  id: 'app-init',
  detail: '시작하는 중…',
}

type AuthPhase = 'checking' | 'guest' | 'user'

export function AppRoot() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>('checking')
  const [authBackendMessage, setAuthBackendMessage] = useState<string | null>(
    null,
  )
  const [username, setUsername] = useState<string | null>(null)
  const [phase, setPhase] = useState<BootPhase>(INITIAL_PHASE)
  const [ready, setReady] = useState(false)
  const [bootKey, setBootKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void checkAuth()
      .then((result) => {
        if (cancelled) return
        if (!result.ready) {
          setAuthBackendMessage(result.message)
          setAuthPhase('guest')
          return
        }
        setAuthBackendMessage(null)
        if (result.user) {
          setUsername(result.user.username)
          setAuthPhase('user')
        } else {
          setAuthPhase('guest')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    if (authPhase !== 'user') return
    runBootstrap()
  }, [authPhase, runBootstrap, bootKey])

  const handleRetry = useCallback(() => {
    setReady(false)
    setPhase(INITIAL_PHASE)
    setBootKey((key) => key + 1)
  }, [])

  const handleLoggedIn = useCallback((name: string) => {
    setUsername(name)
    setAuthPhase('user')
    setReady(false)
    setPhase(INITIAL_PHASE)
    setBootKey((key) => key + 1)
  }, [])

  const handleLogout = useCallback(() => {
    void logoutApi()
      .then(() => {
        setUsername(null)
        setAuthPhase('guest')
        setReady(false)
        setPhase(INITIAL_PHASE)
      })
      .catch((err) => console.error(err))
  }, [])

  if (authPhase === 'checking') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <ThemeToggle className="fixed top-4 right-4 z-50 sm:top-5 sm:right-6" />
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="로그인 확인 중" />
      </div>
    )
  }

  if (authPhase === 'guest') {
    return (
      <LoginScreen
        onLoggedIn={handleLoggedIn}
        backendMessage={authBackendMessage}
      />
    )
  }

  return (
    <>
      {!ready ? (
        <>
          <ThemeToggle className="fixed top-4 right-4 z-50 sm:top-5 sm:right-6" />
          <BootScreen
            phase={phase}
            onRetry={phase.id === 'error' ? handleRetry : undefined}
          />
        </>
      ) : (
        <App username={username ?? ''} onLogout={() => void handleLogout()} />
      )}
    </>
  )
}