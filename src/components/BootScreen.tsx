import { AlertCircle, Check, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  BOOT_STEP_LABELS,
  type BootPhase,
  type BootPhaseId,
} from '@/lib/table-detection/bootstrap'
import { cn } from 'cn'

const STEP_ORDER: Exclude<BootPhaseId, 'error'>[] = [
  'app-init',
  'runtime',
  'model-download',
  'model-init',
  'ready',
]

type Props = {
  phase: BootPhase
  onRetry?: () => void
}

function stepStatus(
  stepId: Exclude<BootPhaseId, 'error'>,
  currentId: BootPhaseId,
): 'done' | 'current' | 'pending' {
  if (currentId === 'error') {
    const failedIndex = STEP_ORDER.indexOf('model-download')
    const stepIndex = STEP_ORDER.indexOf(stepId)
    if (stepIndex < failedIndex) return 'done'
    if (stepIndex === failedIndex) return 'current'
    return 'pending'
  }

  const currentIndex = STEP_ORDER.indexOf(
    currentId === 'ready' ? 'ready' : currentId,
  )
  const stepIndex = STEP_ORDER.indexOf(stepId)

  if (stepIndex < currentIndex) return 'done'
  if (stepIndex === currentIndex) return 'current'
  return 'pending'
}

export function BootScreen({ phase, onRetry }: Props) {
  const isError = phase.id === 'error'
  const isReady = phase.id === 'ready'

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border/80 bg-card/90 p-8 shadow-[0_12px_40px_color-mix(in_oklch,var(--foreground),transparent_94%)]">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Image to Excel
          </h1>
          <p
            className={cn(
              'text-sm',
              isError ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {phase.detail}
          </p>
        </div>

        <ol className="space-y-3" aria-label="시작 단계">
          {STEP_ORDER.map((stepId) => {
            const status = stepStatus(stepId, phase.id)
            return (
              <li
                key={stepId}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                  status === 'current' &&
                    'border-primary/40 bg-primary/5 text-foreground',
                  status === 'done' && 'border-border bg-muted/30 text-foreground',
                  status === 'pending' &&
                    'border-transparent text-muted-foreground',
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center">
                  {status === 'done' ? (
                    <Check className="size-4 text-primary" aria-hidden />
                  ) : status === 'current' ? (
                    <Loader2
                      className="size-4 animate-spin text-primary"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="size-1.5 rounded-full bg-muted-foreground/40"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="font-medium">{BOOT_STEP_LABELS[stepId]}</span>
              </li>
            )
          })}
        </ol>

        {isError ? (
          <div className="flex flex-col items-center gap-3">
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" aria-hidden />
              네트워크 또는 브라우저 설정을 확인해 주세요.
            </p>
            {onRetry ? (
              <Button type="button" onClick={onRetry}>
                다시 시도
              </Button>
            ) : null}
          </div>
        ) : null}

        {isReady ? (
          <p className="text-center text-xs text-muted-foreground">
            곧 메인 화면으로 이동합니다…
          </p>
        ) : null}
      </div>
    </div>
  )
}