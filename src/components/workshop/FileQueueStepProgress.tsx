import { Badge } from '@/components/ui/badge'
import { cn } from 'cn'

type Props = {
  detected: boolean
  tableCount: number
  className?: string
}

export function FileQueueStepProgress({ detected, tableCount, className }: Props) {
  const label = !detected
    ? '검출 전'
    : tableCount > 0
      ? `표 ${tableCount}개`
      : '표 없음'
  return (
    <Badge
      variant={detected && tableCount > 0 ? 'secondary' : 'outline'}
      className={cn('mt-1 h-4 px-1.5 text-[10px] font-normal', className)}
    >
      {label}
    </Badge>
  )
}
