import {
  Check,
  Download,
  Loader2,
  Scan,
  Table2,
  type LucideIcon,
} from 'lucide-react'
import { m } from 'motion/react'

import {
  WORKSHOP_STEP_LABELS,
  WORKSHOP_STEPS,
  type WorkshopStepId,
  workshopStepIndex,
} from '@/lib/workflow/workshop-steps'
import {
  motionFrom,
  motionInitial,
  motionTransition,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import { scaleInTight, springSnappy } from '@/lib/motion/variants'
import { cn } from 'cn'

export type StepAccess = Record<WorkshopStepId, boolean>

const STEP_ICON: Record<WorkshopStepId, LucideIcon> = {
  detect: Scan,
  convert: Table2,
  review: Download,
}

type Props = {
  current: WorkshopStepId
  access: StepAccess
  busy?: boolean
  onNavigate?: (step: WorkshopStepId) => void
}

export function WorkflowStepBar({
  current,
  access,
  busy = false,
  onNavigate,
}: Props) {
  const reduced = useReducedMotion()
  const transition = motionTransition(reduced, springSnappy)
  const currentIndex = workshopStepIndex(current)

  return (
    <header className="shrink-0 border-b border-border bg-card px-4 py-3">
      <div className="flex flex-row items-center gap-6">
        <nav className="min-w-0 flex-1" aria-label="작업 단계">
          <ol className="flex gap-3" role="list">
            {WORKSHOP_STEPS.map((stepId, i) => {
              const done = i < currentIndex
              const active = stepId === current
              const reachable = access[stepId]
              const canClick = Boolean(onNavigate) && reachable && !busy && !active

              return (
                <li key={stepId} className="flex min-w-0 flex-1 items-stretch">
                  {i > 0 ? (
                    <m.span
                      className={cn(
                        'mr-2 block w-4 shrink-0 self-center border-t',
                        done || active ? 'border-primary/40' : 'border-border',
                      )}
                      aria-hidden
                      initial={motionFrom(reduced, { scaleX: 0 })}
                      animate={{ scaleX: done || active ? 1 : 0.35 }}
                      transition={transition}
                      style={{ originX: 0 }}
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => canClick && onNavigate?.(stepId)}
                    className={cn(
                      'relative flex min-w-0 flex-1 flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors',
                      active &&
                        'border-primary/35 ring-1 ring-inset ring-primary/25',
                      !active &&
                        done &&
                        'border-primary/25 bg-card',
                      !active &&
                        !done &&
                        'border-border bg-card',
                      canClick && 'cursor-pointer',
                      !active && canClick && 'hover:border-border hover:bg-muted/60',
                      !active && !canClick && 'cursor-default opacity-70',
                      active && 'bg-primary/10',
                    )}
                    aria-current={active ? 'step' : undefined}
                  >
                    {active && !reduced ? (
                      <m.span
                        layoutId="workshop-step-active"
                        className="absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/25"
                        transition={transition}
                        aria-hidden
                      />
                    ) : null}
                    <span className="relative flex items-center gap-2">
                      <StepMarker
                        stepId={stepId}
                        done={done}
                        active={active}
                        busy={active && busy}
                      />
                      <span
                        className={cn(
                          'truncate text-sm font-semibold tracking-tight',
                          active ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {WORKSHOP_STEP_LABELS[stepId]}
                      </span>
                    </span>
                    <span className="relative truncate text-[10px] text-muted-foreground">
                      {i + 1}단계
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      </div>
    </header>
  )
}

function StepMarker({
  stepId,
  done,
  active,
  busy,
}: {
  stepId: WorkshopStepId
  done: boolean
  active: boolean
  busy: boolean
}) {
  const reduced = useReducedMotion()
  const transition = motionTransition(reduced, springSnappy)
  const Icon = STEP_ICON[stepId]

  if (busy) {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
  }
  if (done) {
    return (
      <m.span
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        variants={scaleInTight}
        initial={motionInitial(reduced)}
        animate="animate"
        transition={transition}
      >
        <Check className="size-3" strokeWidth={2.5} aria-hidden />
      </m.span>
    )
  }
  return (
    <m.span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
        active
          ? 'bg-primary/20 text-primary ring-primary/40'
          : 'bg-background text-muted-foreground ring-border',
      )}
      animate={
        active && !busy && !reduced
          ? { scale: [1, 1.08, 1] }
          : { scale: 1 }
      }
      transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-hidden
    >
      <Icon className="size-3" strokeWidth={2.25} />
    </m.span>
  )
}