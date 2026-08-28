import { motion, useReducedMotion } from 'framer-motion'
import { useI18n } from '../i18n'
import { MktStagger, MktStaggerItem } from './MktReveal'

const MARQUEE_KEYS = [
  'mktSocialMarquee1',
  'mktSocialMarquee2',
  'mktSocialMarquee3',
  'mktSocialMarquee4',
  'mktSocialMarquee5',
] as const

const STATS = [
  { value: 'mktHeroStat1Value', label: 'mktHeroStat1Label' },
  { value: 'mktHeroStat2Value', label: 'mktHeroStat2Label' },
  { value: 'mktHeroStat3Value', label: 'mktHeroStat3Label' },
] as const

function MarqueePills({ segment }: { segment: string }) {
  const { t } = useI18n()
  const keys = [...MARQUEE_KEYS, ...MARQUEE_KEYS, ...MARQUEE_KEYS]

  return (
    <>
      {keys.map((key, i) => (
        <span key={`${segment}-${key}-${i}`} className="mkt-proof-pill">
          {t(key)}
        </span>
      ))}
    </>
  )
}

export function MktSocialProof() {
  const { t } = useI18n()
  const reduce = useReducedMotion()

  return (
    <section className="mkt-proof" aria-label={t('mktSocialTitle')}>
      <MktStagger className="mkt-proof-stats">
        {STATS.map((stat) => (
          <MktStaggerItem key={stat.value}>
            <div className="mkt-proof-stat">
              <motion.strong
                initial={reduce ? false : { opacity: 0, scale: 0.82 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                {t(stat.value)}
              </motion.strong>
              <span>{t(stat.label)}</span>
            </div>
          </MktStaggerItem>
        ))}
      </MktStagger>
      <div className="mkt-proof-marquee" aria-hidden>
        <div className="mkt-proof-track">
          <div className="mkt-proof-segment">
            <MarqueePills segment="a" />
          </div>
          <div className="mkt-proof-segment">
            <MarqueePills segment="b" />
          </div>
        </div>
      </div>
    </section>
  )
}
