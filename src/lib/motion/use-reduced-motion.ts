import { useReducedMotion as useMotionReducedMotion } from 'motion/react'
import type { Transition } from 'motion/react'

import { instant, transitionFor } from '@/lib/motion/variants'

export function useReducedMotion(): boolean {
  return useMotionReducedMotion() ?? false
}

export function motionTransition(
  reduced: boolean,
  transition?: Transition,
): Transition {
  return transitionFor(reduced, transition)
}

/** When reduced motion is on, skip enter animations (variant children). */
export function motionInitial(reduced: boolean): false | 'initial' {
  return reduced ? false : 'initial'
}

/** When reduced motion is on, skip custom enter targets. */
export function motionFrom<T extends Record<string, unknown>>(
  reduced: boolean,
  from: T,
): false | T {
  return reduced ? false : from
}

export function listItemTransition(reduced: boolean): Transition {
  return transitionFor(reduced, {
    type: 'spring',
    stiffness: 420,
    damping: 32,
  })
}

export { instant }