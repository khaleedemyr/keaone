import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMarketingBlog, type MarketingBlogPost } from '../api/marketingBlog'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth'
import { useI18n, type MsgKey } from '../i18n'
import { HeroScene } from './HeroScene'
import { MarketingShell } from './MarketingShell'
import { MktReveal, MktStagger, MktStaggerItem } from './MktReveal'
import { MktSectionHead } from './MktSectionHead'
import { usePageSeo } from './pageSeo'
import { ProductShot } from './ProductShot'
import { TiltFrame } from './TiltFrame'

function formatDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

const CAPS: { key: MsgKey; lead: MsgKey; mark: string; icon: string }[] = [
  { key: 'mktCapPos', lead: 'mktCapPosLead', mark: '', icon: '◉' },
  { key: 'mktCapInv', lead: 'mktCapInvLead', mark: 'is-inv', icon: '▣' },
  { key: 'mktCapOutlets', lead: 'mktCapOutletsLead', mark: 'is-out', icon: '◎' },
  { key: 'mktCapRoles', lead: 'mktCapRolesLead', mark: 'is-roles', icon: '⬡' },
  { key: 'mktCapInsight', lead: 'mktCapInsightLead', mark: 'is-insight', icon: '◈' },
] 

export default function Landing() {
  const { t, lang, locale } = useI18n()
  const { me } = useAuth()
  const [posts, setPosts] = useState<MarketingBlogPost[]>([])

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
      <section className="mkt-hero" aria-labelledby="mkt-hero-heading">
        <div className="mkt-hero-bg" aria-hidden />
        <div className="mkt-hero-inner">
          <div className="mkt-hero-copy">
            <Logo variant="wordmark" className="mkt-hero-brand" glow />
            <p className="mkt-hero-badge">{t('mktHeroBadge')}</p>
            <h1 id="mkt-hero-heading" className="mkt-gradient-text">
              {t('mktHeroTitle')}
            </h1>
            <p className="mkt-hero-lead">{t('mktHeroLead')}</p>
            <div className="mkt-hero-cta">
              {me ? (
                <Link to="/app" className="mkt-btn mkt-btn-primary mkt-btn-glow">
                  {t('mktNavOpenApp')}
                </Link>
              ) : (
                <>
                  <Link to="/login?demo=1" className="mkt-btn mkt-btn-primary mkt-btn-glow">
                    {t('mktHeroDemo')}
                  </Link>
                  <Link to="/login" className="mkt-btn mkt-btn-ghost">
                    {t('mktHeroLogin')}
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="mkt-hero-visual">
            <HeroScene desktopAlt={t('mktShotDesktopAlt')} />
          </div>
        </div>
      </section>

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
          <MktStagger className="mkt-product-stage">
            <MktStaggerItem>
              <TiltFrame maxTilt={8}>
                <ProductShot src="/marketing/desktop.png" alt={t('mktShotDesktopAlt')} />
              </TiltFrame>
            </MktStaggerItem>
            <MktStaggerItem>
              <TiltFrame maxTilt={8}>
                <ProductShot src="/marketing/pos.png" alt={t('mktShotPosAlt')} />
              </TiltFrame>
            </MktStaggerItem>
          </MktStagger>
        </div>
      </section>

      <section className="mkt-section" aria-labelledby="mkt-cap-heading">
        <MktReveal>
          <MktSectionHead
            eyebrow={t('mktEyebrowFeatures')}
            id="mkt-cap-heading"
            title={t('mktCapTitle')}
            lead={t('mktCapLead')}
          />
        </MktReveal>
        <MktStagger className="mkt-cap-grid">
          {CAPS.map((cap) => (
            <MktStaggerItem key={cap.key}>
              <article className="mkt-cap-card">
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

      <section className="mkt-section mkt-band-alt" style={{ paddingTop: 0 }} aria-labelledby="mkt-ind-heading">
        <MktReveal>
          <MktSectionHead
            eyebrow={t('mktEyebrowIndustries')}
            id="mkt-ind-heading"
            title={t('mktIndTitle')}
            lead={t('mktIndLead')}
          />
        </MktReveal>
        <MktStagger className="mkt-ind-row">
          <MktStaggerItem>
            <div className="mkt-ind-item is-retail mkt-tilt-hover">
              <span>{t('mktIndRetail')}</span>
            </div>
          </MktStaggerItem>
          <MktStaggerItem>
            <div className="mkt-ind-item is-restaurant mkt-tilt-hover">
              <span>{t('mktIndRestaurant')}</span>
            </div>
          </MktStaggerItem>
          <MktStaggerItem>
            <div className="mkt-ind-item is-cafe mkt-tilt-hover">
              <span>{t('mktIndCafe')}</span>
            </div>
          </MktStaggerItem>
        </MktStagger>
      </section>

      <section id="pricing" className="mkt-section" aria-labelledby="mkt-price-heading">
        <MktReveal>
          <MktSectionHead
            eyebrow={t('mktNavPricing')}
            id="mkt-price-heading"
            title={t('mktPriceTitle')}
            lead={t('mktPriceLead')}
          />
        </MktReveal>
        <MktStagger className="mkt-price-grid">
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
              <Link to="/register" className="mkt-btn mkt-btn-primary mkt-btn-glow">
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
          <div className="mkt-contact-grid">
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
                    <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at, locale)}</time>
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

      <section className="mkt-cta mkt-cta-glow" aria-labelledby="mkt-cta-heading">
        <MktReveal>
          <h2 id="mkt-cta-heading" className="mkt-gradient-text-soft">
            {t('mktCtaTitle')}
          </h2>
          <p>{t('mktCtaLead')}</p>
          <div className="mkt-cta-actions">
            {me ? (
              <Link to="/app" className="mkt-btn mkt-btn-primary mkt-btn-glow">
                {t('mktNavOpenApp')}
              </Link>
            ) : (
              <>
                <Link to="/login?demo=1" className="mkt-btn mkt-btn-primary mkt-btn-glow">
                  {t('mktCtaDemo')}
                </Link>
                <Link to="/register" className="mkt-btn mkt-btn-ghost">
                  {t('mktCtaRegister')}
                </Link>
              </>
            )}
          </div>
        </MktReveal>
      </section>
    </MarketingShell>
  )
}
