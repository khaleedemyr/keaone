import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useI18n } from '../i18n'
import { subscribeLoading, type LoadingSnapshot } from '../loading/store'

const SIZE = 120
const STROKE = 6
const RADIUS = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * RADIUS

export function LoadingOverlay() {
  const { t } = useI18n()
  const [state, setState] = useState<LoadingSnapshot>({ active: false, overlay: false, progress: 0 })

  useEffect(() => subscribeLoading(setState), [])

  const clamped = Math.min(100, Math.max(0, state.progress))
  const offset = CIRC * (1 - clamped / 100)

  return (
    <>
      <AnimatePresence>
        {state.active ? (
          <motion.div
            className="kea-load-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clamped}
            aria-label={t('loadingWork')}
          >
            <div className="kea-load-bar-fill" style={{ width: `${clamped}%` }} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {state.overlay ? (
          <motion.div
            className="kea-load-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="kea-load-card"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="kea-load-ring" aria-hidden>
                <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
                  <defs>
                    <linearGradient id="kea-load-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3ee8c5" />
                      <stop offset="100%" stopColor="#8b6cff" />
                    </linearGradient>
                  </defs>
                  <circle
                    className="kea-load-track-ring"
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    strokeWidth={STROKE}
                  />
                  <circle
                    className="kea-load-arc"
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke="url(#kea-load-grad)"
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                  />
                </svg>
                <span className="kea-load-percent">{clamped}%</span>
              </div>
              <p className="kea-load-title">{t('loadingWork')}</p>
              <p className="kea-load-hint">{t('loadingWait')}</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
