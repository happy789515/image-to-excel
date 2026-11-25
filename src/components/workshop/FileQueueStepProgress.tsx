import { Check } from 'lucide-react'

import type { FileWorkshopProgress } from '@/lib/workshop-progress'
import {
  WORKSHOP_STEP_LABELS,
  WORKSHOP_STEPS,
  type WorkshopStepId,
} from '@/lib/workflow/workshop-steps'
import { cn } from 'cn'

const SHORT: Record<WorkshopStepId, string> = {
  detect: '검출',
  convert: '변환',
  review: '검수',
}

type Props = {
  progress: FileWorkshopProgress | undefined
  className?: string
}

function stepDone(progress: FileWorkshopProgress, step: WorkshopStepId): boolean {
  switch (step) {
    case 'detect':
      return progress.detectDone
    case 'convert':
      return progress.convertDone
    case 'review':
      return progress.reviewDone
    default:
      return false
  }
}

export function FileQueueStepProgress({ progress, className }: Props) {
  if (!progress) return null

  return (
    <ol
      className={cn('flex flex-wrap items-center gap-x-1 gap-y-0.5', className)}
      aria-label={`진행: ${WORKSHOP_STEP_LABELS[progress.step]}`}
    >
      {WORKSHOP_STEPS.map((stepId, i) => {
        const done = stepDone(progress, stepId)
        const current = progress.step === stepId
        return (
          <li key={stepId} className="flex items-center gap-0.5">
            {i > 0 ? (
              <span className="text-muted-foreground/50" aria-hidden>
                ·
              </span>
            ) : null}
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded px-0.5 text-[10px] leading-none',
                current && 'font-semibold text-primary',
                !current && done && 'text-foreground',
                !current && !done && 'text-muted-foreground',
              )}
            >
              {done ? (
                <Check
                  className={cn(
                    'size-2.5 shrink-0',
                    current ? 'text-primary' : 'text-emerald-600 dark:text-emerald-500',
                  )}
                  aria-hidden
                />
              ) : (
                <span
                  className={cn(
                    'size-2.5 shrink-0 rounded-full border',
                    current ? 'border-primary bg-primary/20' : 'border-muted-foreground/40',
                  )}
                  aria-hidden
                />
              )}
              {SHORT[stepId]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}