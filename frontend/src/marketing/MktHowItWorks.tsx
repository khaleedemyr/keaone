import { useI18n } from '../i18n'
import { MktReveal, MktStagger, MktStaggerItem } from './MktReveal'
import { MktSectionHead } from './MktSectionHead'

const STEPS = [
  { n: '01', title: 'mktHowStep1Title', lead: 'mktHowStep1Lead' },
  { n: '02', title: 'mktHowStep2Title', lead: 'mktHowStep2Lead' },
  { n: '03', title: 'mktHowStep3Title', lead: 'mktHowStep3Lead' },
] as const

export function MktHowItWorks() {
  const { t } = useI18n()

  return (
    <section id="how" className="mkt-section mkt-band-alt" aria-labelledby="mkt-how-heading">
      <MktReveal>
        <MktSectionHead
          eyebrow={t('mktHowEyebrow')}
          id="mkt-how-heading"
          title={t('mktHowTitle')}
          lead={t('mktHowLead')}
        />
      </MktReveal>
      <MktStagger className="mkt-steps">
        {STEPS.map((step, index) => (
          <MktStaggerItem key={step.n}>
            <article className="mkt-step-card">
              <div className="mkt-step-num">{step.n}</div>
              {index < STEPS.length - 1 ? <div className="mkt-step-line" aria-hidden /> : null}
              <h3>{t(step.title)}</h3>
              <p>{t(step.lead)}</p>
            </article>
          </MktStaggerItem>
        ))}
      </MktStagger>
    </section>
  )
}
