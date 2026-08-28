import { useI18n } from '../i18n'
import { MktReveal, MktStagger, MktStaggerItem } from './MktReveal'
import { MktSectionHead } from './MktSectionHead'

const TESTIMONIALS = [
  { quote: 'mktTest1Quote', name: 'mktTest1Name', role: 'mktTest1Role' },
  { quote: 'mktTest2Quote', name: 'mktTest2Name', role: 'mktTest2Role' },
  { quote: 'mktTest3Quote', name: 'mktTest3Name', role: 'mktTest3Role' },
] as const

export function MktTestimonials() {
  const { t } = useI18n()

  return (
    <section className="mkt-section" aria-labelledby="mkt-test-heading">
      <MktReveal>
        <MktSectionHead
          eyebrow={t('mktTestimonialEyebrow')}
          id="mkt-test-heading"
          title={t('mktTestimonialTitle')}
          lead={t('mktTestimonialLead')}
        />
      </MktReveal>
      <MktStagger className="mkt-test-grid">
        {TESTIMONIALS.map((item, i) => (
          <MktStaggerItem key={item.name}>
            <blockquote className={`mkt-test-card is-${i + 1}`}>
              <p className="mkt-test-quote">"{t(item.quote)}"</p>
              <footer>
                <strong>{t(item.name)}</strong>
                <span>{t(item.role)}</span>
              </footer>
            </blockquote>
          </MktStaggerItem>
        ))}
      </MktStagger>
    </section>
  )
}
