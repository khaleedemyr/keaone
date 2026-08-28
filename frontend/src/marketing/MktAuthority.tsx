import { useI18n } from '../i18n'
import { MktReveal, MktStagger, MktStaggerItem } from './MktReveal'
import { MktSectionHead } from './MktSectionHead'

const PILLARS = [
  { icon: '⬡', title: 'mktAuth1Title', lead: 'mktAuth1Lead' },
  { icon: '◈', title: 'mktAuth2Title', lead: 'mktAuth2Lead' },
  { icon: '◎', title: 'mktAuth3Title', lead: 'mktAuth3Lead' },
] as const

export function MktAuthority() {
  const { t } = useI18n()

  return (
    <section className="mkt-section mkt-band" aria-labelledby="mkt-auth-heading">
      <MktReveal>
        <MktSectionHead
          eyebrow={t('mktAuthorityEyebrow')}
          id="mkt-auth-heading"
          title={t('mktAuthorityTitle')}
          lead={t('mktAuthorityLead')}
        />
      </MktReveal>
      <MktStagger className="mkt-auth-grid">
        {PILLARS.map((pillar) => (
          <MktStaggerItem key={pillar.title}>
            <article className="mkt-auth-card mkt-tilt-hover">
              <span className="mkt-auth-icon" aria-hidden>
                {pillar.icon}
              </span>
              <h3>{t(pillar.title)}</h3>
              <p>{t(pillar.lead)}</p>
            </article>
          </MktStaggerItem>
        ))}
      </MktStagger>
    </section>
  )
}
