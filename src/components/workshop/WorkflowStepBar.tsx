import {
  Check,
  Download,
  Loader2,
  Scan,
  Table2,
  type LucideIcon,
} from 'lucide-react'

import {
  WORKSHOP_STEP_LABELS,
  WORKSHOP_STEPS,
  type WorkshopStepId,
  workshopStepIndex,
} from '@/lib/workflow/workshop-steps'
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
  const currentIndex = workshopStepIndex(current)

  return (
    <header className="shrink-0 border-b border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <nav className="min-w-0 flex-1" aria-label="작업 단계">
          <ol className="flex gap-2 sm:gap-3" role="list">
            {WORKSHOP_STEPS.map((stepId, i) => {
              const done = i < currentIndex
              const active = stepId === current
              const reachable = access[stepId]
              const canClick = Boolean(onNavigate) && reachable && !busy && !active

              return (
                <li key={stepId} className="flex min-w-0 flex-1 items-stretch">
                  {i > 0 ? (
                    <span
                      className={cn(
                        'mr-2 hidden w-4 shrink-0 self-center border-t sm:block',
                        done || active ? 'border-primary/40' : 'border-border',
                      )}
                      aria-hidden
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => canClick && onNavigate?.(stepId)}
                    className={cn(
                      'flex min-w-0 flex-1 flex-col gap-1 rounded-lg border px-2 py-2 text-left transition-colors sm:px-3',
                      active &&
                        'border-primary/35 bg-primary/10 ring-1 ring-inset ring-primary/25',
                      !active &&
                        done &&
                        'border-primary/25 bg-card',
                      !active &&
                        !done &&
                        'border-border bg-card',
                      canClick && 'cursor-pointer',
                      !active && canClick && 'hover:border-border hover:bg-muted/60',
                      !active && !canClick && 'cursor-default opacity-70',
                    )}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className="flex items-center gap-2">
                      <StepMarker
                        stepId={stepId}
                        done={done}
                        active={active}
                        busy={active && busy}
                      />
                      <span
                        className={cn(
                          'truncate text-xs font-semibold tracking-tight sm:text-sm',
                          active ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {WORKSHOP_STEP_LABELS[stepId]}
                      </span>
                    </span>
                    <span className="hidden truncate text-[10px] text-muted-foreground sm:block">
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
  const Icon = STEP_ICON[stepId]

  if (busy) {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
  }
  if (done) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-3" strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
        active
          ? 'bg-primary/20 text-primary ring-primary/40'
          : 'bg-background text-muted-foreground ring-border',
      )}
      aria-hidden
    >
      <Icon className="size-3" strokeWidth={2.25} />
    </span>
  )
}