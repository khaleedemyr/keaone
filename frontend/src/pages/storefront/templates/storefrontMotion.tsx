import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from 'framer-motion'
import { useRef, type PointerEvent, type ReactNode } from 'react'

const ease = [0.16, 1, 0.3, 1] as const

type RevealProps = {
  children: ReactNode
  className?: string
  id?: string
  delay?: number
  y?: number
  x?: number
  once?: boolean
  as?: 'div' | 'section' | 'article' | 'header' | 'li'
}

/** Scroll-in fade + slide + blur. Aggressive defaults. */
export function Reveal({
  children,
  className,
  id,
  delay = 0,
  y = 64,
  x = 0,
  once = true,
  as = 'div',
}: RevealProps) {
  const reduce = useReducedMotion()
  const Tag = motion[as]

  if (reduce) {
    return <div id={id} className={className}>{children}</div>
  }

  return (
    <Tag
      id={id}
      className={className}
      initial={{ opacity: 0, y, x, scale: 0.94, filter: 'blur(12px)' }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once, margin: '-4% 0px -6% 0px', amount: 0.15 }}
      transition={{ duration: 0.85, delay, ease }}
    >
      {children}
    </Tag>
  )
}

type StaggerProps = {
  children: ReactNode
  className?: string
  id?: string
  delay?: number
  stagger?: number
  as?: 'div' | 'ul' | 'section'
}

/** Parent that staggers child motion items. */
export function Stagger({ children, className, id, delay = 0, stagger = 0.1, as = 'div' }: StaggerProps) {
  const reduce = useReducedMotion()
  const Tag = motion[as]

  if (reduce) {
    return <div id={id} className={className}>{children}</div>
  }

  return (
    <Tag
      id={id}
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-4% 0px', amount: 0.12 }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
    >
      {children}
    </Tag>
  )
}

export const staggerItem = {
  hidden: { opacity: 0, y: 48, scale: 0.92, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.65, ease },
  },
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'article' | 'li'
}) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  if (reduce) return <div className={className}>{children}</div>
  return (
    <Tag className={className} variants={staggerItem}>
      {children}
    </Tag>
  )
}

type Tilt3DProps = {
  children: ReactNode
  className?: string
  maxTilt?: number
  glare?: boolean
  lift?: number
}

/** Perspective tilt on pointer move — strong 3D card feel. */
export function Tilt3D({ children, className, maxTilt = 16, glare = true, lift = 14 }: Tilt3DProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 280, damping: 18 })
  const springY = useSpring(y, { stiffness: 280, damping: 18 })
  const rotateX = useTransform(springY, [-0.5, 0.5], [maxTilt, -maxTilt])
  const rotateY = useTransform(springX, [-0.5, 0.5], [-maxTilt, maxTilt])
  const glareX = useTransform(springX, [-0.5, 0.5], [0, 100])
  const glareY = useTransform(springY, [-0.5, 0.5], [0, 100])
  const glareBg = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.55), transparent 50%)`
  const scale = useSpring(1, { stiffness: 320, damping: 22 })

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  function onMove(e: PointerEvent) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
    scale.set(1.04)
  }

  function onLeave() {
    x.set(0)
    y.set(0)
    scale.set(1)
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        rotateX,
        rotateY,
        scale,
        transformStyle: 'preserve-3d',
        transformPerspective: 1100,
        willChange: 'transform',
      }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div style={{ transform: `translateZ(${lift}px)`, transformStyle: 'preserve-3d' }}>{children}</div>
      {glare ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
          style={{ background: glareBg, opacity: 0.75 }}
        />
      ) : null}
    </motion.div>
  )
}

type FloatProps = HTMLMotionProps<'div'> & {
  children: ReactNode
  amplitude?: number
  duration?: number
}

/** Floating loop for decorative blobs / hero accents. */
export function Float({ children, className, amplitude = 18, duration = 4.2, ...rest }: FloatProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amplitude, 0], rotate: [0, 2.5, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

type ParallaxProps = {
  children: ReactNode
  className?: string
  /** Scroll travel in px (positive = moves up slower). */
  offset?: number
}

/** Parallax tied to scroll within parent. */
export function Parallax({ children, className, offset = 90 }: ParallaxProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.12, 1, 1.08])

  if (reduce) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    )
  }

  return (
    <div ref={ref} className={`${className ?? ''} overflow-hidden`}>
      <motion.div style={{ y, scale }}>{children}</motion.div>
    </div>
  )
}

type HeroEnterProps = {
  children: ReactNode
  className?: string
  delay?: number
}

/** First-paint hero entrance — punchier. */
export function HeroEnter({ children, className, delay = 0 }: HeroEnterProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 52, scale: 0.92, filter: 'blur(14px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 1, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

/** Hover lift for clickable cards. */
export function HoverLift({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      whileHover={{ y: -12, scale: 1.035 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
    >
      {children}
    </motion.div>
  )
}

/** Subtle magnetic pull toward pointer — good for CTAs / product tiles. */
export function Magnetic({
  children,
  className,
  strength = 28,
}: {
  children: ReactNode
  className?: string
  strength?: number
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 260, damping: 16 })
  const springY = useSpring(y, { stiffness: 260, damping: 16 })

  if (reduce) return <div className={className}>{children}</div>

  function onMove(e: PointerEvent) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    x.set((dx / rect.width) * strength)
    y.set((dy / rect.height) * strength)
  }

  function onLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: springX, y: springY }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </motion.div>
  )
}

/** Scale-pop for badges / sale chips. */
export function ScalePop({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ type: 'spring', stiffness: 420, damping: 14, delay }}
    >
      {children}
    </motion.div>
  )
}
