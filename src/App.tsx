import { LogOut, Table2 } from 'lucide-react'
import { m } from 'motion/react'

import { Workshop } from '@/components/workshop/Workshop'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import {
  motionFrom,
  motionInitial,
  motionTransition,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import {
  fadeUp,
  springSnappy,
  staggerContainerFast,
  staggerItem,
} from '@/lib/motion/variants'

type AppProps = {
  username: string
  onLogout: () => void
}

function App({ username, onLogout }: AppProps) {
  const reduced = useReducedMotion()
  const transition = motionTransition(reduced, springSnappy)

  return (
    <m.div
      className="flex h-svh flex-col overflow-hidden"
      variants={staggerContainerFast}
      initial={motionInitial(reduced)}
      animate="animate"
    >
      <m.header
        variants={staggerItem}
        transition={transition}
        className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4"
      >
        <m.div
          className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          initial={motionFrom(reduced, { opacity: 0, scale: 0.9 })}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...transition, delay: reduced ? 0 : 0.05 }}
          aria-hidden
        >
          <Table2 className="size-4.5" strokeWidth={2} />
        </m.div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Image to Excel
          </p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {username}으로 로그인됨 · 이미지에서 표를 추출합니다
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={onLogout}
        >
          <LogOut className="size-3.5" aria-hidden />
          로그아웃
        </Button>
        <ThemeToggle className="shrink-0 self-center" />
      </m.header>

      <m.div
        className="flex min-h-0 flex-1 flex-col"
        variants={fadeUp}
        initial={motionInitial(reduced)}
        animate="animate"
        transition={{ ...transition, delay: reduced ? 0 : 0.05 }}
      >
        <Workshop />
      </m.div>
    </m.div>
  )
}

export default App