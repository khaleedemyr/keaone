import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import type { MouseEvent, ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  maxTilt?: number
  float?: boolean
}

export function TiltFrame({ children, className = '', maxTilt = 10, float = false }: Props) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxTilt, -maxTilt]), { stiffness: 180, damping: 22 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxTilt, maxTilt]), { stiffness: 180, damping: 22 })

  function onMove(event: MouseEvent<HTMLDivElement>) {
    if (reduce) return
    const rect = event.currentTarget.getBoundingClientRect()
    x.set((event.clientX - rect.left) / rect.width - 0.5)
    y.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  function onLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <div className={`mkt-tilt-wrap ${className}`.trim()} style={{ perspective: 1200 }}>
      <motion.div
        className={`mkt-tilt ${float ? 'is-float' : ''}`.trim()}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div className="mkt-tilt-glare" aria-hidden />
        <div className="mkt-tilt-inner">{children}</div>
      </motion.div>
    </div>
  )
}
