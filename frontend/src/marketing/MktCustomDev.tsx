import { motion, useReducedMotion } from 'framer-motion'
import { useI18n, type MsgKey } from '../i18n'
import { MktReveal, MktStagger, MktStaggerItem } from './MktReveal'
import { MktSectionHead } from './MktSectionHead'

type Principle = {
  id: string
  name: MsgKey
  lead: MsgKey
  icon: string
  tone: string
}

type Service = {
  icon: string
  title: MsgKey
  lead: MsgKey
  tone: string
}

type Step = {
  n: string
  title: MsgKey
  lead: MsgKey
}

const PRINCIPLES: Principle[] = [
  {
    id: 'reciprocity',
    name: 'mktCustomPrincipleReciprocity',
    lead: 'mktCustomPrincipleReciprocityLead',
    icon: '◎',
    tone: 'is-mint',
  },
  {
    id: 'commitment',
    name: 'mktCustomPrincipleCommitment',
    lead: 'mktCustomPrincipleCommitmentLead',
    icon: '◆',
    tone: 'is-violet',
  },
  {
    id: 'social',
    name: 'mktCustomPrincipleSocial',
    lead: 'mktCustomPrincipleSocialLead',
    icon: '◈',
    tone: 'is-sky',
  },
  {
    id: 'authority',
    name: 'mktCustomPrincipleAuthority',
    lead: 'mktCustomPrincipleAuthorityLead',
    icon: '⬡',
    tone: 'is-gold',
  },
  {
    id: 'liking',
    name: 'mktCustomPrincipleLiking',
    lead: 'mktCustomPrincipleLikingLead',
    icon: '♥',
    tone: 'is-rose',
  },
  {
    id: 'scarcity',
    name: 'mktCustomPrincipleScarcity',
    lead: 'mktCustomPrincipleScarcityLead',
    icon: '◉',
    tone: 'is-amber',
  },
]

const SERVICES: Service[] = [
  { icon: '⬢', title: 'mktCustomSvcWeb', lead: 'mktCustomSvcWebLead', tone: 'is-web' },
  { icon: '▣', title: 'mktCustomSvcMobile', lead: 'mktCustomSvcMobileLead', tone: 'is-mobile' },
  { icon: '⬡', title: 'mktCustomSvcErp', lead: 'mktCustomSvcErpLead', tone: 'is-erp' },
  { icon: '⇄', title: 'mktCustomSvcIntegrate', lead: 'mktCustomSvcIntegrateLead', tone: 'is-api' },
]

const STEPS: Step[] = [
  { n: '01', title: 'mktCustomStepDiscover', lead: 'mktCustomStepDiscoverLead' },
  { n: '02', title: 'mktCustomStepDesign', lead: 'mktCustomStepDesignLead' },
  { n: '03', title: 'mktCustomStepBuild', lead: 'mktCustomStepBuildLead' },
  { n: '04', title: 'mktCustomStepGrow', lead: 'mktCustomStepGrowLead' },
]

const STATS = [
  { value: 'mktCustomStatProjects', label: 'mktCustomStatProjectsLabel' },
  { value: 'mktCustomStatIndustries', label: 'mktCustomStatIndustriesLabel' },
  { value: 'mktCustomStatDelivery', label: 'mktCustomStatDeliveryLabel' },
] as const

const STACK = ['Laravel', 'React', 'PostgreSQL', 'AWS', 'Mobile', 'API'] as const

export function MktCustomDev() {
  const { t } = useI18n()
  const reduce = useReducedMotion()

  return (
    <section id="custom-dev" className="mkt-custom mkt-band-alt" aria-labelledby="mkt-custom-heading">
      <div className="mkt-section">
        <MktReveal>
          <MktSectionHead
            eyebrow={t('mktCustomEyebrow')}
            id="mkt-custom-heading"
            title={<span className="mkt-gradient-text-soft">{t('mktCustomTitle')}</span>}
            lead={t('mktCustomLead')}
          />
        </MktReveal>

        <MktReveal delay={0.05}>
          <div className="mkt-custom-hero mkt-tilt-hover">
            <div className="mkt-custom-hero-glow" aria-hidden />
            <div className="mkt-custom-hero-grid" aria-hidden />
            <div className="mkt-custom-hero-copy">
              <span className="mkt-custom-hero-badge">{t('mktCustomHeroBadge')}</span>
              <h3>{t('mktCustomHeroTitle')}</h3>
              <p>{t('mktCustomHeroLead')}</p>
              <div className="mkt-custom-stack">
                <span className="mkt-custom-stack-label">{t('mktCustomStackLabel')}</span>
                <div className="mkt-custom-stack-row">
                  {STACK.map((item) => (
                    <span key={item} className="mkt-custom-stack-pill">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <motion.div
              className="mkt-custom-hero-visual"
              initial={reduce ? false : { opacity: 0, scale: 0.92, rotateY: -8 }}
              whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mkt-custom-mock">
                <div className="mkt-custom-mock-bar">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="mkt-custom-mock-body">
                  <div className="mkt-custom-mock-sidebar" />
                  <div className="mkt-custom-mock-main">
                    <div className="mkt-custom-mock-chart" />
                    <div className="mkt-custom-mock-cards">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
                <div className="mkt-custom-mock-float is-a">{t('mktCustomMockLabel1')}</div>
                <div className="mkt-custom-mock-float is-b">{t('mktCustomMockLabel2')}</div>
              </div>
            </motion.div>
          </div>
        </MktReveal>

        <MktReveal delay={0.08}>
          <p className="mkt-custom-principles-intro">{t('mktCustomPrinciplesIntro')}</p>
        </MktReveal>

        <MktStagger className="mkt-custom-principles">
          {PRINCIPLES.map((item) => (
            <MktStaggerItem key={item.id}>
              <article className={`mkt-custom-principle ${item.tone} mkt-tilt-hover`}>
                <span className="mkt-custom-principle-icon" aria-hidden>
                  {item.icon}
                </span>
                <h4>{t(item.name)}</h4>
                <p>{t(item.lead)}</p>
              </article>
            </MktStaggerItem>
          ))}
        </MktStagger>

        <MktReveal delay={0.06}>
          <div className="mkt-custom-subhead">
            <MktSectionHead
              eyebrow={t('mktCustomServicesEyebrow')}
              title={t('mktCustomServicesTitle')}
              lead={t('mktCustomServicesLead')}
            />
          </div>
        </MktReveal>

        <MktStagger className="mkt-custom-services">
          {SERVICES.map((svc) => (
            <MktStaggerItem key={svc.title}>
              <article className={`mkt-custom-service ${svc.tone} mkt-tilt-hover`}>
                <span className="mkt-custom-service-icon" aria-hidden>
                  {svc.icon}
                </span>
                <h3>{t(svc.title)}</h3>
                <p>{t(svc.lead)}</p>
              </article>
            </MktStaggerItem>
          ))}
        </MktStagger>

        <MktStagger className="mkt-custom-stats">
          {STATS.map((stat) => (
            <MktStaggerItem key={stat.value}>
              <div className="mkt-custom-stat">
                <strong>{t(stat.value)}</strong>
                <span>{t(stat.label)}</span>
              </div>
            </MktStaggerItem>
          ))}
        </MktStagger>

        <MktReveal delay={0.05}>
          <div className="mkt-custom-subhead">
            <MktSectionHead
              eyebrow={t('mktCustomProcessEyebrow')}
              title={t('mktCustomProcessTitle')}
              lead={t('mktCustomProcessLead')}
            />
          </div>
        </MktReveal>

        <MktStagger className="mkt-custom-steps">
          {STEPS.map((step, index) => (
            <MktStaggerItem key={step.n}>
              <article className="mkt-custom-step">
                <div className="mkt-custom-step-num">{step.n}</div>
                {index < STEPS.length - 1 ? <div className="mkt-custom-step-line" aria-hidden /> : null}
                <h3>{t(step.title)}</h3>
                <p>{t(step.lead)}</p>
              </article>
            </MktStaggerItem>
          ))}
        </MktStagger>

        <MktReveal delay={0.1}>
          <div className="mkt-custom-offer">
            <div className="mkt-custom-offer-glow" aria-hidden />
            <div className="mkt-custom-offer-copy">
              <span className="mkt-custom-offer-badge">{t('mktCustomOfferBadge')}</span>
              <h3>{t('mktCustomOfferTitle')}</h3>
              <p>{t('mktCustomOfferLead')}</p>
              <p className="mkt-custom-offer-note">{t('mktCustomUnityNote')}</p>
            </div>
            <div className="mkt-custom-offer-actions">
              <a
                href="mailto:hello@keaone.justusku.co.id?subject=Konsultasi%20Custom%20App%20%2F%20Web"
                className="mkt-btn mkt-btn-primary mkt-btn-glow mkt-btn-animated"
              >
                {t('mktCustomCta')}
              </a>
              <a href="/#contact" className="mkt-btn mkt-btn-ghost mkt-btn-animated">
                {t('mktCustomCtaSecondary')}
              </a>
              <p className="mkt-scarcity-note mkt-custom-scarcity">{t('mktCustomScarcity')}</p>
            </div>
          </div>
        </MktReveal>
      </div>
    </section>
  )
}
