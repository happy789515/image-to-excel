import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'

import App from '@/App.tsx'
import { BootScreen } from '@/components/BootScreen'
import { LoginScreen } from '@/components/LoginScreen'
import { ThemeToggle } from '@/components/ThemeToggle'
import { checkAuth, logoutApi } from '@/lib/api/auth'
import { AUTH_EXPIRED_EVENT } from '@/lib/api/projects'
import { setLocalUser } from '@/lib/local/db'
import {
  motionInitial,
  motionTransition,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import { fadeUp, springSnappy } from '@/lib/motion/variants'
import {
  bootstrapTableDetection,
  type BootPhase,
} from '@/lib/table-detection/bootstrap'

const INITIAL_PHASE: BootPhase = {
  id: 'app-init',
  detail: '시작하는 중…',
}

type AuthPhase = 'checking' | 'guest' | 'user'

type ShellId = 'checking' | 'guest' | 'boot' | 'workshop'

function shellId(authPhase: AuthPhase, ready: boolean): ShellId {
  if (authPhase === 'checking') return 'checking'
  if (authPhase === 'guest') return 'guest'
  if (!ready) return 'boot'
  return 'workshop'
}

export function AppRoot() {
  const reduced = useReducedMotion()
  const transition = motionTransition(reduced, springSnappy)

  const [authPhase, setAuthPhase] = useState<AuthPhase>('checking')
  const [authBackendMessage, setAuthBackendMessage] = useState<string | null>(
    null,
  )
  const [username, setUsername] = useState<string | null>(null)
  const [phase, setPhase] = useState<BootPhase>(INITIAL_PHASE)
  const [ready, setReady] = useState(false)
  const [bootKey, setBootKey] = useState(0)

  const screenKey = useMemo(
    () => shellId(authPhase, ready),
    [authPhase, ready],
  )

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
          setLocalUser(result.user.username)
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

  useEffect(() => {
    const onExpired = () => {
      setLocalUser(null)
      setUsername(null)
      setAuthPhase('guest')
      setReady(false)
      setPhase(INITIAL_PHASE)
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  const handleRetry = useCallback(() => {
    setReady(false)
    setPhase(INITIAL_PHASE)
    setBootKey((key) => key + 1)
  }, [])

  const handleLoggedIn = useCallback((name: string) => {
    setLocalUser(name)
    setUsername(name)
    setAuthPhase('user')
    setReady(false)
    setPhase(INITIAL_PHASE)
    setBootKey((key) => key + 1)
  }, [])

  const handleLogout = useCallback(() => {
    void logoutApi()
      .then(() => {
        setLocalUser(null)
        setUsername(null)
        setAuthPhase('guest')
        setReady(false)
        setPhase(INITIAL_PHASE)
      })
      .catch((err) => console.error(err))
  }, [])

  return (
    <AnimatePresence mode="wait">
      {screenKey === 'checking' ? (
        <m.div
          key="checking"
          className="flex min-h-svh items-center justify-center bg-background"
          variants={fadeUp}
          initial={motionInitial(reduced)}
          animate="animate"
          exit="exit"
          transition={transition}
        >
          <ThemeToggle className="fixed top-4 right-4 z-50 sm:top-5 sm:right-6" />
          <Loader2
            className="size-8 animate-spin text-muted-foreground"
            aria-label="로그인 확인 중"
          />
        </m.div>
      ) : null}

      {screenKey === 'guest' ? (
        <m.div
          key="guest"
          className="min-h-svh"
          variants={fadeUp}
          initial={motionInitial(reduced)}
          animate="animate"
          exit="exit"
          transition={transition}
        >
          <LoginScreen
            onLoggedIn={handleLoggedIn}
            backendMessage={authBackendMessage}
          />
        </m.div>
      ) : null}

      {screenKey === 'boot' ? (
        <m.div
          key="boot"
          className="min-h-svh bg-background"
          variants={fadeUp}
          initial={motionInitial(reduced)}
          animate="animate"
          exit="exit"
          transition={transition}
        >
          <ThemeToggle className="fixed top-4 right-4 z-50 sm:top-5 sm:right-6" />
          <BootScreen
            phase={phase}
            onRetry={phase.id === 'error' ? handleRetry : undefined}
          />
        </m.div>
      ) : null}

      {screenKey === 'workshop' ? (
        <m.div
          key="workshop"
          className="h-svh overflow-hidden"
          variants={fadeUp}
          initial={motionInitial(reduced)}
          animate="animate"
          exit="exit"
          transition={transition}
        >
          <App username={username ?? ''} onLogout={() => void handleLogout()} />
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}