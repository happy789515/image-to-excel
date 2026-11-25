import { AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  mode?: 'sync' | 'wait' | 'popLayout'
  initial?: boolean
}

export function MotionPresence({
  children,
  mode = 'wait',
  initial = false,
}: Props) {
  return (
    <AnimatePresence mode={mode} initial={initial}>
      {children}
    </AnimatePresence>
  )
}