import type { Variants, Transition } from 'motion/react'

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 0.85,
}

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
  mass: 0.9,
}

export const instant: Transition = { duration: 0 }

export function transitionFor(reduced: boolean, t: Transition = springSnappy): Transition {
  return reduced ? instant : t
}

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export const fadeUpStrong: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
}

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
}

export const scaleInTight: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

export const fadeSlideX: Variants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
}

export const fadeSlideXReverse: Variants = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 16 },
}

export const fadeSlideFromLeft: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8, height: 0, marginTop: 0, marginBottom: 0 },
}

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
  exit: {
    transition: { staggerChildren: 0.03, staggerDirection: -1 },
  },
}

export const staggerContainerFast: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
}

export const panelSwitchForward: Variants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
}

export const panelSwitchBack: Variants = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 16 },
}

export const detectPanel: Variants = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
}