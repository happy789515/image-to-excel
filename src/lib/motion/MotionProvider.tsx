import { LazyMotion, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export function MotionProvider({ children }: Props) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}