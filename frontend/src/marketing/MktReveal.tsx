import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

type Props = {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  scale?: number
  blur?: boolean
}

export function MktReveal({
  children,
  className = '',
  delay = 0,
  y = 28,
  scale = 1,
  blur = false,
}: Props) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, scale: scale < 1 ? scale : 1, filter: blur ? 'blur(10px)' : 'blur(0px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.18, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.65, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  )
}

export function MktHeroStagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function MktHeroItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 36, filter: 'blur(12px)' },
        show: {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          transition: { duration: 0.75, ease: EASE_OUT },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export function MktStagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.12 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function MktStaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 26, scale: 0.94, filter: 'blur(6px)' },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          transition: { duration: 0.6, ease: EASE_OUT },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
