import { motion, useReducedMotion } from 'framer-motion'
import { TiltFrame } from './TiltFrame'
import { ProductShot } from './ProductShot'

type Props = {
  desktopAlt: string
}

export function HeroScene({ desktopAlt }: Props) {
  const reduce = useReducedMotion()

  return (
    <div className="mkt-hero-scene">
      <div className="mkt-hero-orbs" aria-hidden>
        <motion.span
          className="mkt-orb is-a"
          animate={reduce ? undefined : { x: [0, 18, -8, 0], y: [0, -22, 10, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="mkt-orb is-b"
          animate={reduce ? undefined : { x: [0, -24, 12, 0], y: [0, 16, -14, 0], scale: [1, 0.94, 1.06, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="mkt-orb is-c"
          animate={reduce ? undefined : { x: [0, 10, -16, 0], y: [0, 20, -6, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="mkt-hero-grid" aria-hidden />
      <TiltFrame className="mkt-hero-tilt" maxTilt={12} float>
        <ProductShot src="/marketing/desktop.png" alt={desktopAlt} className="is-hero" />
      </TiltFrame>
      <motion.div
        className="mkt-hero-chip is-pos"
        aria-hidden
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        POS
      </motion.div>
      <motion.div
        className="mkt-hero-chip is-erp"
        aria-hidden
        animate={reduce ? undefined : { y: [0, 8, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      >
        ERP OS
      </motion.div>
    </div>
  )
}
