import { AlertTriangle, CircleDashed, CircleDot, Loader2 } from 'lucide-react'

import {
  PHASE_DISPLAY,
  PIPELINE_PHASES,
  type WorkflowPhaseId,
} from '@/lib/workflow/types'
import { cn } from 'cn'

type Props = {
  current: WorkflowPhaseId
  detail?: string | null
  errorAt?: WorkflowPhaseId | null
}

const BUSY_PHASES: WorkflowPhaseId[] = ['detecting', 'extracting', 'packaging']

function pipelineIndex(
  phase: WorkflowPhaseId,
  errorAt?: WorkflowPhaseId | null,
): number {
  if (phase === 'complete') return PIPELINE_PHASES.length
  if (phase === 'error') {
    const anchor = errorAt ?? 'detecting'
    const idx = PIPELINE_PHASES.indexOf(anchor)
    return idx >= 0 ? idx : 0
  }
  if (phase === 'idle') return -1
  const idx = PIPELINE_PHASES.indexOf(phase)
  return idx >= 0 ? idx : 1
}

function statusLabel(phase: WorkflowPhaseId): string {
  if (phase === 'idle') return '대기'
  if (phase === 'complete') return '완료'
  if (phase === 'error') return '오류'
  if (BUSY_PHASES.includes(phase)) return '처리 중'
  return '편집 가능'
}

function defaultDetail(phase: WorkflowPhaseId): string | null {
  if (phase === 'idle') return '이미지를 선택하거나 업로드하세요.'
  if (phase === 'complete') return 'Excel 파일을 다운로드할 수 있습니다.'
  if (phase === 'error') return '작업 내역에서 원인을 확인하세요.'
  return null
}

export function WorkflowPhaseBar({ current, detail, errorAt }: Props) {
  const title =
    current === 'error' && errorAt
      ? `${PHASE_DISPLAY[errorAt].title} — 오류`
      : PHASE_DISPLAY[current].title
  const progressAt = pipelineIndex(current, errorAt)
  const subtitle = detail?.trim() || defaultDetail(current)
  const busy = BUSY_PHASES.includes(current)

  return (
    <header className="shrink-0 border-b border-border bg-card/80 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <StatusBadge phase={current} busy={busy} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">현재 작업</p>
            <p className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </p>
          </div>
        </div>

        <nav
          className="min-w-0 flex-[1.4] sm:max-w-md lg:max-w-lg"
          aria-label="파이프라인 진행"
        >
          <div className="flex gap-1" role="list">
            {PIPELINE_PHASES.map((phaseId, i) => {
              const done = progressAt > i
              const active = progressAt === i
              const { rail } = PHASE_DISPLAY[phaseId]
              const failed = current === 'error' && active

              return (
                <ConfigurationSegment
                  key={phaseId}
                  done={done}
                  active={active}
                  failed={failed}
                  complete={current === 'complete'}
                  label={rail}
                  ariaCurrent={active ? 'step' : undefined}
                />
              )
            })}
          </div>
        </nav>

        {subtitle ? (
          <p
            className={cn(
              'min-w-0 text-sm sm:max-w-xs sm:flex-1 sm:text-right',
              current === 'error' ? 'text-destructive' : 'text-muted-foreground',
              current === 'complete' && !detail && 'text-primary',
            )}
            aria-live="polite"
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </header>
  )
}

function StatusBadge({ phase, busy }: { phase: WorkflowPhaseId; busy: boolean }) {
  const label = statusLabel(phase)
  const isError = phase === 'error'
  const isComplete = phase === 'complete'
  const isIdle = phase === 'idle'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        isIdle && 'bg-muted text-muted-foreground ring-border',
        !isIdle && !isError && !isComplete && 'bg-primary/10 text-foreground ring-primary/25',
        isComplete && 'bg-primary/15 text-primary ring-primary/30',
        isError && 'bg-destructive/10 text-destructive ring-destructive/25',
      )}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : isError ? (
        <AlertTriangle className="size-3.5" aria-hidden />
      ) : isComplete ? (
        <CircleDot className="size-3.5" aria-hidden />
      ) : (
        <CircleDashed className="size-3.5" aria-hidden />
      )}
      {label}
    </span>
  )
}

function ConfigurationSegment({
  done,
  active,
  failed,
  complete,
  label,
  ariaCurrent,
}: {
  done: boolean
  active: boolean
  failed: boolean
  complete: boolean
  label: string
  ariaCurrent?: 'step'
}) {
  return (
    <div
      role="listitem"
      className="flex min-w-0 flex-1 flex-col gap-1.5"
      aria-current={ariaCurrent}
    >
      <span
        className={cn(
          'block h-1.5 w-full overflow-hidden rounded-full bg-muted',
          (done || complete) && 'bg-primary/25',
        )}
      >
        <span
          className={cn(
            'block h-full rounded-full transition-[width] duration-300 ease-out',
            done || complete
              ? 'w-full bg-primary'
              : active
                ? cn('w-full', failed ? 'bg-destructive' : 'bg-primary')
                : 'w-0',
          )}
        />
      </span>
      <span
        className={cn(
          'block truncate text-center text-[10px] font-medium tracking-tight',
          active && !failed && 'text-foreground',
          failed && 'text-destructive',
          done && 'text-muted-foreground',
          !active && !done && 'text-muted-foreground/80',
        )}
      >
        {label}
      </span>
    </div>
  )
}