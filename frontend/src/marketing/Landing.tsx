import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { listMarketingBlog, type MarketingBlogPost } from '../api/marketingBlog'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth'
import { useI18n, type MsgKey } from '../i18n'
import { MktAuthority } from './MktAuthority'
import { HeroScene } from './HeroScene'
import { MktHowItWorks } from './MktHowItWorks'
import { MarketingShell } from './MarketingShell'
import { MktReveal, MktStagger, MktStaggerItem, MktHeroStagger, MktHeroItem } from './MktReveal'
import { MktSectionHead } from './MktSectionHead'
import { MktSocialProof } from './MktSocialProof'
import { MktTestimonials } from './MktTestimonials'
import { usePageSeo } from './pageSeo'
import { ProductShot } from './ProductShot'
import { TiltFrame } from './TiltFrame'

function formatDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

type BizPick = 'retail' | 'restaurant' | 'cafe' | 'multi'

const CAPS: { key: MsgKey; lead: MsgKey; mark: string; icon: string }[] = [
  { key: 'mktCapPos', lead: 'mktCapPosLead', mark: '', icon: '◉' },
  { key: 'mktCapInv', lead: 'mktCapInvLead', mark: 'is-inv', icon: '▣' },
  { key: 'mktCapOutlets', lead: 'mktCapOutletsLead', mark: 'is-out', icon: '◎' },
  { key: 'mktCapRoles', lead: 'mktCapRolesLead', mark: 'is-roles', icon: '⬡' },
  { key: 'mktCapInsight', lead: 'mktCapInsightLead', mark: 'is-insight', icon: '◈' },
]

const PICKER: { id: BizPick; label: MsgKey }[] = [
  { id: 'retail', label: 'mktHeroPickerRetail' },
  { id: 'restaurant', label: 'mktHeroPickerRestaurant' },
  { id: 'cafe', label: 'mktHeroPickerCafe' },
  { id: 'multi', label: 'mktHeroPickerMulti' },
]

const INDUSTRIES: {
  id: string
  label: MsgKey
  lead: MsgKey
  pain1: MsgKey
  pain2: MsgKey
  tone: string
}[] = [
  {
    id: 'retail',
    label: 'mktIndRetail',
    lead: 'mktIndRetailLead',
    pain1: 'mktIndRetailPain1',
    pain2: 'mktIndRetailPain2',
    tone: 'is-retail',
  },
  {
    id: 'restaurant',
    label: 'mktIndRestaurant',
    lead: 'mktIndRestaurantLead',
    pain1: 'mktIndRestaurantPain1',
    pain2: 'mktIndRestaurantPain2',
    tone: 'is-restaurant',
  },
  {
    id: 'cafe',
    label: 'mktIndCafe',
    lead: 'mktIndCafeLead',
    pain1: 'mktIndCafePain1',
    pain2: 'mktIndCafePain2',
    tone: 'is-cafe',
  },
]

export default function Landing() {
  const { t, lang, locale } = useI18n()
  const { me } = useAuth()
  const reduce = useReducedMotion()
  const [posts, setPosts] = useState<MarketingBlogPost[]>([])
  const [bizPick, setBizPick] = useState<BizPick>('retail')

  const jsonLd = useMemo(
    () => [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'KEA One',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: t('mktSeoDescription'),
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '149000',
          highPrice: '699000',
          priceCurrency: 'IDR',
          offerCount: 3,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'KEA One',
        url: typeof window !== 'undefined' ? window.location.origin : '',
        email: 'hello@keaone.justusku.co.id',
        description: t('mktSeoDescription'),
      },
    ],
    [t],
  )

  usePageSeo({
    title: t('mktSeoTitle'),
    description: t('mktSeoDescription'),
    keywords: t('mktSeoKeywords'),
    path: '/',
    jsonLd,
  })

  useEffect(() => {
    let cancelled = false
    void listMarketingBlog(lang, 3)
      .then((rows) => {
        if (!cancelled) setPosts(rows)
      })
      .catch(() => {
        if (!cancelled) setPosts([])
      })
    return () => {
      cancelled = true
    }
  }, [lang])

  return (
    <MarketingShell>
      <section className="mkt-hero mkt-hero-v2" aria-labelledby="mkt-hero-heading">
        <div className="mkt-hero-bg" aria-hidden />
        <div className="mkt-hero-glow" aria-hidden />
        <div className="mkt-hero-inner">
          <MktHeroStagger className="mkt-hero-copy">
            <MktHeroItem>
              <Logo variant="wordmark" className="mkt-hero-brand" glow />
            </MktHeroItem>
            <MktHeroItem>
              <p className="mkt-hero-badge mkt-animate-badge">{t('mktHeroBadge')}</p>
            </MktHeroItem>
            <MktHeroItem>
              <h1 id="mkt-hero-heading" className="mkt-gradient-text mkt-animate-shimmer">
                {t('mktHeroTitle')}
              </h1>
            </MktHeroItem>
            <MktHeroItem>
              <p className="mkt-hero-lead">{t('mktHeroLead')}</p>
            </MktHeroItem>

            <MktHeroItem>
              <div className="mkt-hero-picker">
                <span className="mkt-hero-picker-label">{t('mktHeroPickerLabel')}</span>
                <div className="mkt-hero-picker-row" role="group" aria-label={t('mktHeroPickerLabel')}>
                  {PICKER.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`mkt-hero-pick${bizPick === item.id ? ' is-active' : ''}`}
                      onClick={() => setBizPick(item.id)}
                    >
                      {bizPick === item.id ? (
                        <motion.span
                          layoutId="mkt-pick-active"
                          className="mkt-hero-pick-bg"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        />
                      ) : null}
                      <span className="mkt-hero-pick-label">{t(item.label)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </MktHeroItem>

            <MktHeroItem>
              <div className="mkt-hero-cta">
                {me ? (
                  <Link to="/app" className="mkt-btn mkt-btn-primary mkt-btn-glow mkt-btn-animated">
                    {t('mktNavOpenApp')}
                  </Link>
                ) : (
                  <>
                    <Link to="/login?demo=1" className="mkt-btn mkt-btn-primary mkt-btn-glow mkt-btn-animated">
                      {t('mktHeroDemo')}
                    </Link>
                    <Link to="/register" className="mkt-btn mkt-btn-ghost mkt-btn-animated">
                      {t('mktNavRegister')}
                    </Link>
                  </>
                )}
              </div>
            </MktHeroItem>
          </MktHeroStagger>
          <motion.div
            className="mkt-hero-visual"
            initial={reduce ? false : { opacity: 0, x: 48, scale: 0.94, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroScene desktopAlt={t('mktShotDesktopAlt')} bizPick={bizPick} />
          </motion.div>
        </div>
      </section>

      <MktSocialProof />

      <section id="product" className="mkt-product mkt-band" aria-labelledby="mkt-product-heading">
        <div className="mkt-section">
          <MktReveal>
            <MktSectionHead
              eyebrow={t('mktNavProduct')}
              id="mkt-product-heading"
              title={<span className="mkt-gradient-text-soft">{t('mktProductTitle')}</span>}
              lead={t('mktProductLead')}
            />
          </MktReveal>
          <MktStagger className="mkt-bento">
            <MktStaggerItem>
              <div className="mkt-bento-cell is-wide mkt-bento-shot">
                <TiltFrame maxTilt={8}>
                  <ProductShot src="/marketing/desktop.png" alt={t('mktShotDesktopAlt')} />
                </TiltFrame>
                <span className="mkt-bento-tag">{t('mktProductBentoErp')}</span>
              </div>
            </MktStaggerItem>
            <MktStaggerItem>
              <div className="mkt-bento-cell mkt-bento-shot">
                <TiltFrame maxTilt={8}>
                  <ProductShot src="/marketing/pos.png" alt={t('mktShotPosAlt')} />
                </TiltFrame>
                <span className="mkt-bento-tag">{t('mktProductBentoPos')}</span>
              </div>
            </MktStaggerItem>
            <MktStaggerItem>
              <div className="mkt-bento-cell mkt-bento-feat is-mint">
                <span className="mkt-bento-icon" aria-hidden>
                  ⬡
                </span>
                <h3>{t('mktProductBentoPurchase')}</h3>
                <p>{t('mktAuth2Lead')}</p>
              </div>
            </MktStaggerItem>
            <MktStaggerItem>
              <div className="mkt-bento-cell mkt-bento-feat is-gold">
                <span className="mkt-bento-icon" aria-hidden>
                  ◈
                </span>
                <h3>{t('mktProductBentoInsight')}</h3>
                <p>{t('mktCapInsightLead')}</p>
              </div>
            </MktStaggerItem>
          </MktStagger>
        </div>
      </section>

      <MktHowItWorks />

      <section id="features" className="mkt-section" aria-labelledby="mkt-cap-heading">
        <MktReveal>
          <MktSectionHead
            eyebrow={t('mktEyebrowFeatures')}
            id="mkt-cap-heading"
            title={t('mktCapTitle')}
            lead={t('mktCapLead')}
          />
        </MktReveal>
        <MktStagger className="mkt-cap-grid mkt-cap-grid-v2">
          {CAPS.map((cap) => (
            <MktStaggerItem key={cap.key}>
              <article className="mkt-cap-card mkt-cap-card-v2">
                <span className={`mkt-cap-mark ${cap.mark}`.trim()} aria-hidden>
                  {cap.icon}
                </span>
                <div>
                  <h3>{t(cap.key)}</h3>
                  <p>{t(cap.lead)}</p>
                </div>
              </article>
            </MktStaggerItem>
          ))}
        </MktStagger>
      </section>

      <section
        id="industries"
        className="mkt-section mkt-band-alt"
        aria-labelledby="mkt-ind-heading"
      >
        <MktReveal>
          <MktSectionHead
            eyebrow={t('mktEyebrowIndustries')}
            id="mkt-ind-heading"
            title={t('mktIndTitle')}
            lead={t('mktIndLead')}
          />
        </MktReveal>
        <MktStagger className="mkt-ind-grid">
          {INDUSTRIES.map((ind) => (
            <MktStaggerItem key={ind.id}>
              <article className={`mkt-ind-card ${ind.tone} mkt-tilt-hover`}>
                <h3>{t(ind.label)}</h3>
                <p className="mkt-ind-lead">{t(ind.lead)}</p>
                <ul>
                  <li>{t(ind.pain1)}</li>
                  <li>{t(ind.pain2)}</li>
                </ul>
              </article>
            </MktStaggerItem>
          ))}
        </MktStagger>
      </section>

      <MktAuthority />
      <MktTestimonials />

      <section id="pricing" className="mkt-section" aria-labelledby="mkt-price-heading">
        <MktReveal>
          <MktSectionHead
            eyebrow={t('mktNavPricing')}
            id="mkt-price-heading"
            title={t('mktPriceTitle')}
            lead={t('mktPriceLead')}
          />
        </MktReveal>
        <MktStagger className="mkt-price-grid mkt-price-grid-v2">
          <MktStaggerItem>
            <article className="mkt-price-plan mkt-tilt-hover">
              <h3>{t('mktPriceStarter')}</h3>
              <p>{t('mktPriceStarterLead')}</p>
              <div className="mkt-price-amount">
                <strong>{t('mktPriceStarterAmt')}</strong>
                <span>{t('mktPricePerMonth')}</span>
              </div>
              <ul>
                <li>{t('mktPriceStarterF1')}</li>
                <li>{t('mktPriceStarterF2')}</li>
                <li>{t('mktPriceStarterF3')}</li>
              </ul>
              <Link to="/register" className="mkt-btn mkt-btn-ghost">
                {t('mktPriceCta')}
              </Link>
            </article>
          </MktStaggerItem>
          <MktStaggerItem>
            <article className="mkt-price-plan is-featured mkt-tilt-hover">
              <span className="mkt-price-badge">{t('mktPricePopular')}</span>
              <h3>{t('mktPriceGrowth')}</h3>
              <p>{t('mktPriceGrowthLead')}</p>
              <div className="mkt-price-amount">
                <strong>{t('mktPriceGrowthAmt')}</strong>
                <span>{t('mktPricePerMonth')}</span>
              </div>
              <ul>
                <li>{t('mktPriceGrowthF1')}</li>
                <li>{t('mktPriceGrowthF2')}</li>
                <li>{t('mktPriceGrowthF3')}</li>
              </ul>
              <Link to="/register" className="mkt-btn mkt-btn-primary mkt-btn-glow mkt-btn-animated">
                {t('mktPriceCta')}
              </Link>
            </article>
          </MktStaggerItem>
          <MktStaggerItem>
            <article className="mkt-price-plan mkt-tilt-hover">
              <h3>{t('mktPricePro')}</h3>
              <p>{t('mktPriceProLead')}</p>
              <div className="mkt-price-amount">
                <strong>{t('mktPriceProAmt')}</strong>
                <span>{t('mktPricePerMonth')}</span>
              </div>
              <ul>
                <li>{t('mktPriceProF1')}</li>
                <li>{t('mktPriceProF2')}</li>
                <li>{t('mktPriceProF3')}</li>
              </ul>
              <a href="/#contact" className="mkt-btn mkt-btn-ghost">
                {t('mktPriceTalk')}
              </a>
            </article>
          </MktStaggerItem>
        </MktStagger>
        <MktReveal delay={0.1}>
          <p className="mkt-contact-note mkt-price-note">{t('mktPriceTrial')}</p>
          <p className="mkt-scarcity-note">{t('mktScarcityNote')}</p>
        </MktReveal>
      </section>

      <section id="contact" className="mkt-section mkt-band" aria-labelledby="mkt-contact-heading">
        <MktReveal>
          <MktSectionHead
            eyebrow={t('mktNavContact')}
            id="mkt-contact-heading"
            title={t('mktContactTitle')}
            lead={t('mktContactLead')}
          />
        </MktReveal>
        <MktReveal delay={0.08}>
          <div className="mkt-contact-grid mkt-contact-grid-v2">
            <div className="mkt-contact-channels">
              <a className="mkt-contact-channel mkt-tilt-hover" href="mailto:hello@keaone.justusku.co.id">
                <strong>{t('mktContactEmail')}</strong>
                <span>hello@keaone.justusku.co.id</span>
              </a>
              <a
                className="mkt-contact-channel mkt-tilt-hover"
                href="mailto:hello@keaone.justusku.co.id?subject=WhatsApp%20KEA%20One"
              >
                <strong>{t('mktContactWhatsapp')}</strong>
                <span>{t('mktContactWhatsappHint')}</span>
              </a>
              <p className="mkt-contact-note">{t('mktContactHours')}</p>
            </div>
            <div className="mkt-contact-aside">
              <p className="mkt-contact-note">{t('mktContactAside')}</p>
              <div className="mkt-cta-actions mkt-contact-actions">
                <a href="mailto:hello@keaone.justusku.co.id" className="mkt-btn mkt-btn-primary mkt-btn-glow">
                  {t('mktContactCta')}
                </a>
                <Link to="/login?demo=1" className="mkt-btn mkt-btn-ghost">
                  {t('mktHeroDemo')}
                </Link>
              </div>
            </div>
          </div>
        </MktReveal>
      </section>

      <section className="mkt-section" aria-labelledby="mkt-blog-heading">
        <MktReveal>
          <MktSectionHead
            eyebrow={t('mktNavBlog')}
            id="mkt-blog-heading"
            title={t('mktBlogTitle')}
            lead={t('mktBlogLead')}
          />
        </MktReveal>
        {posts.length === 0 ? (
          <p className="mkt-muted">{t('mktBlogEmpty')}</p>
        ) : (
          <MktStagger className="mkt-blog-cards mkt-blog-cards--landing">
            {posts.map((post) => (
              <MktStaggerItem key={post.id}>
                <Link to={`/blog/${post.slug}`} className="mkt-blog-card mkt-tilt-hover">
                  {post.cover ? (
                    <img className="mkt-blog-card-cover" src={post.cover} alt="" />
                  ) : (
                    <div className="mkt-blog-card-cover is-placeholder" aria-hidden />
                  )}
                  <div className="mkt-blog-card-body">
                    <time dateTime={post.published_at ?? undefined}>
                      {formatDate(post.published_at, locale)}
                    </time>
                    <h3>{post.title}</h3>
                    {post.excerpt ? <p>{post.excerpt}</p> : null}
                    <span className="mkt-blog-card-more">{t('blogReadMore')} →</span>
                  </div>
                </Link>
              </MktStaggerItem>
            ))}
          </MktStagger>
        )}
        <MktReveal delay={0.05}>
          <Link to="/blog" className="mkt-link">
            {t('mktBlogAll')} →
          </Link>
        </MktReveal>
      </section>

      <section className="mkt-cta mkt-cta-glow mkt-cta-v2" aria-labelledby="mkt-cta-heading">
        <MktReveal>
          <div className="mkt-cta-inner">
            <h2 id="mkt-cta-heading" className="mkt-gradient-text-soft">
              {t('mktCtaTitle')}
            </h2>
            <p>{t('mktCtaLead')}</p>
            <div className="mkt-cta-actions">
              {me ? (
                <Link to="/app" className="mkt-btn mkt-btn-primary mkt-btn-glow mkt-btn-animated">
                  {t('mktNavOpenApp')}
                </Link>
              ) : (
                <>
                  <Link to="/login?demo=1" className="mkt-btn mkt-btn-primary mkt-btn-glow mkt-btn-animated">
                    {t('mktCtaDemo')}
                  </Link>
                  <Link to="/register" className="mkt-btn mkt-btn-ghost mkt-btn-animated">
                    {t('mktCtaRegister')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </MktReveal>
      </section>
    </MarketingShell>
  )
}
