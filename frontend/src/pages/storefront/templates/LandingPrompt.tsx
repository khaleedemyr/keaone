import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import type { StorefrontRenderModel } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { readFooterColumn } from '../lib/footerLinks'
import { inquiryErrorMessage, inquiryFromForm, submitStorefrontInquiry } from '../lib/submitStorefrontInquiry'
import { LandingNewsDetail, newsItemsFromModel, parseSocialLinks, useLandingNewsNav, type LandingNewsItem } from './LandingNewsDetail'
import { LandingNewsPage } from './LandingNewsPage'
import { coerceNavForTemplate } from './storefrontNav'
import { PROMPT_DEMO } from './promptDemo'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import { HeroEnter, HoverLift, Magnetic, Reveal, ScalePop, Stagger, StaggerItem, Tilt3D } from './storefrontMotion'

/**
 * Prompt SaaS — Coderthemes
 * Refs:
 * - Hub: https://themes.coderthemes.com/prompt-bootstrap/symfony.html
 * - SaaS: https://themes.coderthemes.com/prompt-bootstrap/home-saas.html
 * Tokens: primary #335EEA, soft blue chips, white cards, Inter/system, sticky nav, gradient hero
 */

const P = {
  wide: 'mx-auto w-full max-w-[1140px] px-4 sm:px-6 lg:px-8',
  primary: '#335EEA',
  soft: '#EEF2FF',
  muted: '#64748B',
  ink: '#0F172A',
  line: '#E2E8F0',
  bg: '#F8FAFC',
} as const

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return { primary: P.primary, accent: '#0EA5E9', background: '#ffffff', text: P.ink }
  }
  return {
    primary: model.brand_colors.primary || P.primary,
    accent: model.brand_colors.accent || '#0EA5E9',
    background: model.brand_colors.background || '#ffffff',
    text: model.brand_colors.text || P.ink,
  }
}

function theme(model: StorefrontRenderModel) {
  return model.theme_content ?? {}
}

function slotText(content: Record<string, unknown>, key: string, fallback: string) {
  const value = content[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function parsePairs(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split('|')
      return { name: (name || '').trim(), detail: rest.join('|').trim() }
    })
    .filter((p) => p.name)
}

function parseTestimonials(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((s) => s.trim())
      return { name: parts[0] || '', role: parts[1] || '', quote: parts.slice(2).join('|') || '' }
    })
    .filter((t) => t.name && t.quote)
}

type PricingPlan = { name: string; price: string; features: string[]; featured: boolean }

function parsePricing(raw: string): PricingPlan[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((s) => s.trim())
      return {
        name: parts[0] || '',
        price: parts[1] || '',
        features: (parts[2] || '')
          .split(';')
          .map((f) => f.trim())
          .filter(Boolean),
        featured: (parts[3] || '').toLowerCase() === 'yes',
      }
    })
    .filter((p) => p.name)
}

function Shell({ model, children }: { model: StorefrontRenderModel; children: ReactNode }) {
  const c = colors(model)
  useEffect(() => {
    const id = 'prompt-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])
  return (
    <div
      className="min-h-screen antialiased"
      style={{ background: c.background, color: c.text, fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {model.preview ? (
        <div className="sticky top-0 z-[70] bg-amber-100 px-3 py-1.5 text-center text-[12px] text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function SectionHead({
  kicker,
  title,
  body,
  primary,
  center,
}: {
  kicker?: string
  title: string
  body?: string
  primary: string
  center?: boolean
}) {
  return (
    <div className={`mb-10 max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      {kicker ? (
        <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color: primary }}>
          {kicker}
        </div>
      ) : null}
      <h2 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">{title}</h2>
      {body ? (
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: P.muted }}>
          {body}
        </p>
      ) : null}
    </div>
  )
}

const FEATURE_ICONS = [
  <svg key="a" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
    <path d="M4 20a8 8 0 0116 0" />
  </svg>,
  <svg key="b" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>,
  <svg key="c" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 3 3 5-6" />
  </svg>,
]

export function LandingPrompt({ model }: { model: StorefrontRenderModel }) {
  const c = colors(model)
  const content = theme(model)
  const brand = model.title?.trim() || 'Prompt'
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState('')

  const navDefault =
    'Home | #home\nFeatures | #features\nPricing | #pricing\nFAQ | #faq\nNews | #news\nContact | #contact'
  const nav = coerceNavForTemplate(
    parsePairs(slotText(content, 'nav_links', navDefault)),
    parsePairs(navDefault),
    ['home', 'features', 'pricing', 'faq', 'news', 'contact'],
  )
  const navCta = slotText(content, 'nav_cta', 'Download')
  const socials = parseSocialLinks(
    slotText(
      content,
      'social_links',
      'Twitter | https://twitter.com\nFacebook | https://facebook.com\nInstagram | https://instagram.com\nLinkedIn | https://linkedin.com',
    ),
  )

  const heroKicker = slotText(content, 'hero_kicker', 'SaaS Platform')
  const heroHeadline = slotText(content, 'hero_headline', 'The best way to showcase your saas')
  const heroBody = slotText(
    content,
    'hero_body',
    'Make your saas application stand out with high-quality landing page designed and developed by professionals.',
  )
  const heroCta = slotText(content, 'hero_cta', 'View Demos')
  const heroCta2 = slotText(content, 'hero_cta_secondary', 'Buy Now')
  const heroImage = withDemoImage(model, typeof content.hero_image === 'string' ? content.hero_image : undefined, PROMPT_DEMO.hero)

  const featuresKicker = slotText(content, 'features_kicker', 'Features')
  const featuresTitle = slotText(content, 'features_title', 'Better Management. Better Performance')
  const featuresBody = slotText(content, 'features_body', 'Start working with Prompt to manage your workforce better.')
  const features = parsePairs(
    slotText(
      content,
      'features_items',
      'Improve Employee Experience | Before we dive into why companies must invest in employee experience, it is important to understand what this concept entails.\nHiring & Onboarding | Post your job, interview candidates and make offers, all on Prompt. Start hiring today.\nPeople Data & Analytics | Finding committed employees is one of public and private organizations top priorities.',
    ),
  ).slice(0, 3)

  const splitKicker = slotText(content, 'split_kicker', 'Automation')
  const splitTitle = slotText(content, 'split_title', "Smart Payroll. Paying your people couldn't be easier")
  const splitBody = slotText(
    content,
    'split_body',
    'You can modify your pages with drag-dropping, import demos with just one click, and adjust theme settings from an easy-to-use options panel.',
  )
  const splitBadge = slotText(content, 'split_badge', 'Tax Calculator')
  const splitCta = slotText(content, 'split_cta', 'Learn more')
  const splitImage = withDemoImage(model, typeof content.split_image === 'string' ? content.split_image : undefined, PROMPT_DEMO.split)

  const trustTitle = slotText(content, 'trust_title', 'The smart people management you need')
  const trustBody = slotText(content, 'trust_body', '21,000+ organizations trust Prompt to drive performance & engagement')
  const trustStats = parsePairs(
    slotText(content, 'trust_stats', '21K+|Organizations\n4.9/5|Avg rating\n120+|Countries\n24/7|Support'),
  ).slice(0, 4)

  const testimonialsKicker = slotText(content, 'testimonials_kicker', 'Testimonials')
  const testimonialsTitle = slotText(content, 'testimonials_title', 'What people say')
  const testimonialsBody = slotText(content, 'testimonials_body', 'Few valuables words from our customers')
  const testimonials = parseTestimonials(
    slotText(
      content,
      'testimonials',
      'Cersei Lannister | Senior Project Manager | This app is a truly blessing for all professionals! A day to day project management was never easy for me. But with prompt, I can manage more than 100 projects easily.\nJohn Stark | Engineering Director | It is one of the very convenient to use project manager ever! I have tried many apps, but this one is far better than others. Simply loved it!',
    ),
  )

  const pricingKicker = slotText(content, 'pricing_kicker', 'Pricing')
  const pricingTitle = slotText(content, 'pricing_title', 'Pricing Plans')
  const pricingBody = slotText(content, 'pricing_body', 'Pricing that works for everyone')
  const plans = parsePricing(
    slotText(
      content,
      'pricing_plans',
      'Starter | $49 / month | Up to 600 minutes usage time;Use for personal only;Add up to 10 attendees;Technical support via email |\nProfessional | $99 / month | Up to 6000 minutes usage time;Use for personal or commercial;Add up to 100 attendees;Up to 5 teams;Technical support via email | yes\nEnterprise | $599 / month | Unlimited usage time;Use for personal or commercial;Add Unlimited attendees;24x7 Technical support via phone;Technical support via email |',
    ),
  ).slice(0, 3)

  const faqKicker = slotText(content, 'faq_kicker', 'FAQ')
  const faqTitle = slotText(content, 'faq_title', 'Frequently Asked Questions')
  const faqBody = slotText(content, 'faq_body', 'Here are some of the basic types of questions for our customers')
  const faqs = parsePairs(
    slotText(
      content,
      'faq_items',
      'Can I use this template for my client? | Yup, the marketplace license allows you to use this theme in any end products.\nCan this theme work with WordPress? | No. This is a HTML template. It will not work directly with WordPress.\nHow do I get help with the template? | Use our dedicated support email to send your issues or feedback.\nWill you regularly give updates? | Yes, We will update regularly. All future updates would be available without any cost.',
    ),
  )

  const newsKicker = slotText(content, 'news_kicker', 'Blog')
  const newsTitle = slotText(content, 'news_title', 'Latest from Prompt')
  const newsCta = slotText(content, 'news_cta', 'See all news')
  const allNews = useMemo(() => {
    const fromModel = newsItemsFromModel(model.news)
    const demoNews: LandingNewsItem[] = [
      {
        id: 'demo-1',
        title: 'How modern SaaS teams ship faster',
        excerpt: 'A practical look at onboarding, analytics, and product velocity.',
        image: PROMPT_DEMO.news[0],
        tags: 'Product',
        body: '',
      },
      {
        id: 'demo-2',
        title: 'Design systems that scale',
        excerpt: 'Why consistent tokens and components matter for growth teams.',
        image: PROMPT_DEMO.news[1],
        tags: 'Design',
        body: '',
      },
      {
        id: 'demo-3',
        title: 'Pricing pages that convert',
        excerpt: 'Layout patterns from high-performing SaaS landing pages.',
        image: PROMPT_DEMO.news[2],
        tags: 'Growth',
        body: '',
      },
    ]
    return withDemoFallback(
      model,
      fromModel.map((n, i) => ({
        ...n,
        image: withDemoImage(model, n.image, PROMPT_DEMO.news[i % PROMPT_DEMO.news.length]),
      })),
      demoNews,
    )
  }, [model])
  const news = allNews.slice(0, 3)
  const newsNav = useLandingNewsNav(allNews)

  const ctaTitle = slotText(content, 'cta_title', 'Start creating delightful user experience')
  const ctaBody = slotText(content, 'cta_body', 'Start working with Prompt to create awesome landing pages & websites')
  const ctaButton = slotText(content, 'cta_button', 'Purchase Now')

  const contactKicker = slotText(content, 'contact_kicker', 'Contact')
  const contactTitle = slotText(content, 'contact_title', 'Get in touch')
  const contactCta = slotText(content, 'contact_form_cta', 'Send message')
  const footerTagline = slotText(
    content,
    'footer_tagline',
    'A modern design, fresh look and feel for your next SaaS landing.',
  )
  const footerCol = readFooterColumn(content, 1, {
    title: 'Company',
    links: 'About | #features\nSupport | #faq\nPricing | #pricing\nContact | #contact',
  })
  const footerCopy = slotText(content, 'footer_copy', '© Prompt. All rights reserved.')

  async function onContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setFormError('')
    try {
      await submitStorefrontInquiry({ kind: 'contact', ...inquiryFromForm(e.currentTarget), preview: model.preview })
      setSent(true)
      e.currentTarget.reset()
    } catch (err) {
      setFormError(inquiryErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  if (newsNav.view === 'detail' && newsNav.selected) {
    return (
      <Shell model={model}>
        <LandingNewsDetail
          item={newsNav.selected}
          onBack={newsNav.backFromDetail}
          primary={c.primary}
          muted={P.muted}
          preview={model.preview}
          fontHeading="Inter, system-ui, sans-serif"
          brand={brand}
        />
      </Shell>
    )
  }

  if (newsNav.view === 'list') {
    return (
      <Shell model={model}>
        <LandingNewsPage
          items={allNews}
          onSelect={(item) => newsNav.openDetail(item, true)}
          onBack={newsNav.backFromList}
          primary={c.primary}
          muted={P.muted}
          preview={model.preview}
          fontHeading="Inter, system-ui, sans-serif"
          brand={brand}
          kicker={newsKicker}
          title={newsTitle}
        />
      </Shell>
    )
  }

  return (
    <Shell model={model}>
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className={`${P.wide} flex h-16 items-center justify-between`}>
          <a
            href="#home"
            className="text-[18px] font-extrabold tracking-tight"
            style={{ color: c.primary }}
            onClick={(e) => {
              e.preventDefault()
              newsNav.goSection('#home')
            }}
          >
            {brand}
          </a>
          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map((n) => (
              <a
                key={n.name}
                href={n.detail || '#'}
                className="text-[14px] font-medium text-slate-600 hover:text-slate-900"
                onClick={(e) => {
                  e.preventDefault()
                  newsNav.goSection(n.detail || '#')
                  setMenuOpen(false)
                }}
              >
                {n.name}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Magnetic>
              <a
                href="#pricing"
                className="hidden rounded-md px-4 py-2 text-[13px] font-semibold text-white shadow-sm sm:inline-flex"
                style={{ background: c.primary }}
                onClick={(e) => {
                  e.preventDefault()
                  newsNav.goSection('#pricing')
                }}
              >
                {navCta}
              </a>
            </Magnetic>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-2 text-[12px] font-semibold lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
            >
              Menu
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-2">
              {nav.map((n) => (
                <a
                  key={n.name}
                  href={n.detail || '#'}
                  className="rounded-md px-2 py-2 text-[14px] font-medium text-slate-700"
                  onClick={(e) => {
                    e.preventDefault()
                    newsNav.goSection(n.detail || '#')
                    setMenuOpen(false)
                  }}
                >
                  {n.name}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      {/* Hero — Prompt gradient */}
      <section
        id="home"
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${c.primary}14 0%, #F8FAFC 42%, ${c.accent}12 100%)`,
        }}
      >
        <div className={`${P.wide} grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24`}>
          <HeroEnter>
            <div
              className="mb-4 inline-flex rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{ background: `${c.primary}18`, color: c.primary }}
            >
              {heroKicker}
            </div>
            <h1 className="text-[36px] font-extrabold leading-[1.15] tracking-tight sm:text-[48px] lg:text-[52px]">
              {heroHeadline}
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed" style={{ color: P.muted }}>
              {heroBody}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic>
                <a
                  href="#features"
                  className="inline-flex rounded-md px-5 py-3 text-[14px] font-semibold text-white shadow-sm"
                  style={{ background: c.primary }}
                  onClick={(e) => {
                    e.preventDefault()
                    newsNav.goSection('#features')
                  }}
                >
                  {heroCta}
                </a>
              </Magnetic>
              <a
                href="#pricing"
                className="inline-flex rounded-md border border-slate-200 bg-white px-5 py-3 text-[14px] font-semibold text-slate-800 shadow-sm"
                onClick={(e) => {
                  e.preventDefault()
                  newsNav.goSection('#pricing')
                }}
              >
                {heroCta2}
              </a>
            </div>
          </HeroEnter>
          <HeroEnter delay={0.12}>
            <Tilt3D className="relative overflow-hidden rounded-2xl shadow-xl shadow-slate-900/10">
              <img src={heroImage} alt="" className="aspect-[4/3] w-full object-cover" />
            </Tilt3D>
          </HeroEnter>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 lg:py-24" style={{ background: P.bg }}>
        <div className={P.wide}>
          <Reveal>
            <SectionHead kicker={featuresKicker} title={featuresTitle} body={featuresBody} primary={c.primary} center />
          </Reveal>
          <Stagger className="grid gap-5 md:grid-cols-3">
            {features.map((f, i) => (
              <StaggerItem key={f.name}>
                <HoverLift className="h-full">
                  <article className="h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div
                      className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: `${c.primary}15`, color: c.primary }}
                    >
                      {FEATURE_ICONS[i % FEATURE_ICONS.length]}
                    </div>
                    <h3 className="text-[18px] font-bold tracking-tight">{f.name}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed" style={{ color: P.muted }}>
                      {f.detail}
                    </p>
                  </article>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Split feature */}
      <section className="py-16 lg:py-24">
        <div className={`${P.wide} grid items-center gap-10 lg:grid-cols-2`}>
          <Reveal>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{ background: `${c.primary}15`, color: c.primary }}
            >
              {splitKicker}
            </div>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">{splitTitle}</h2>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: P.muted }}>
              {splitBody}
            </p>
            <a href="#pricing" className="mt-6 inline-flex text-[14px] font-semibold" style={{ color: c.primary }}>
              {splitCta} →
            </a>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative">
              <img src={splitImage} alt="" className="aspect-[5/4] w-full rounded-2xl object-cover shadow-lg" />
              <ScalePop className="absolute -bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-56">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
                  <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: c.primary }}>
                    {splitBadge}
                  </div>
                  <div className="mt-1 text-[15px] font-bold">Realtime estimates</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-2/3 rounded-full" style={{ background: c.primary }} />
                  </div>
                </div>
              </ScalePop>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust */}
      <section className="border-y border-slate-200 py-14" style={{ background: P.soft }}>
        <div className={`${P.wide} text-center`}>
          <Reveal>
            <h2 className="text-[26px] font-bold tracking-tight sm:text-[32px]">{trustTitle}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px]" style={{ color: P.muted }}>
              {trustBody}
            </p>
          </Reveal>
          <Stagger className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            {trustStats.map((s) => (
              <StaggerItem key={s.name}>
                <div className="text-[32px] font-extrabold tracking-tight" style={{ color: c.primary }}>
                  {s.name}
                </div>
                <div className="mt-1 text-[13px] font-medium uppercase tracking-wide" style={{ color: P.muted }}>
                  {s.detail}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 lg:py-24">
        <div className={P.wide}>
          <Reveal>
            <SectionHead
              kicker={testimonialsKicker}
              title={testimonialsTitle}
              body={testimonialsBody}
              primary={c.primary}
              center
            />
          </Reveal>
          <Stagger className="grid gap-5 md:grid-cols-2">
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <HoverLift className="h-full">
                  <blockquote className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[15px] leading-relaxed" style={{ color: P.muted }}>
                      “{t.quote}”
                    </p>
                    <footer className="mt-5">
                      <div className="font-bold">{t.name}</div>
                      <div className="text-[13px]" style={{ color: P.muted }}>
                        {t.role}
                      </div>
                    </footer>
                  </blockquote>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 lg:py-24" style={{ background: P.bg }}>
        <div className={P.wide}>
          <Reveal>
            <SectionHead kicker={pricingKicker} title={pricingTitle} body={pricingBody} primary={c.primary} center />
          </Reveal>
          <Stagger className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <StaggerItem key={plan.name}>
                <HoverLift className="h-full">
                  <article
                    className={`relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                      plan.featured ? 'border-transparent ring-2' : 'border-slate-200'
                    }`}
                    style={plan.featured ? { boxShadow: `0 0 0 2px ${c.primary}` } : undefined}
                  >
                    {plan.featured ? (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                        style={{ background: c.primary }}
                      >
                        Popular
                      </div>
                    ) : null}
                    <div className="text-[15px] font-semibold text-slate-600">{plan.name}</div>
                    <div className="mt-2 text-[32px] font-extrabold tracking-tight">{plan.price}</div>
                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.features.map((f) => (
                        <li key={f} className="flex gap-2 text-[14px]" style={{ color: P.muted }}>
                          <span style={{ color: c.primary }}>✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href="#contact"
                      className="mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-[14px] font-semibold"
                      style={
                        plan.featured
                          ? { background: c.primary, color: '#fff' }
                          : { background: P.soft, color: c.primary }
                      }
                    >
                      Choose {plan.name}
                    </a>
                  </article>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 lg:py-24">
        <div className={`${P.wide} max-w-3xl`}>
          <Reveal>
            <SectionHead kicker={faqKicker} title={faqTitle} body={faqBody} primary={c.primary} center />
          </Reveal>
          <div className="space-y-3">
            {faqs.map((f, i) => {
              const open = openFaq === i
              return (
                <Reveal key={f.name} delay={i * 0.04}>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold"
                      onClick={() => setOpenFaq(open ? -1 : i)}
                    >
                      <span>{f.name}</span>
                      <span style={{ color: c.primary }}>{open ? '−' : '+'}</span>
                    </button>
                    {open ? (
                      <div className="border-t border-slate-100 px-5 py-4 text-[14px] leading-relaxed" style={{ color: P.muted }}>
                        {f.detail}
                      </div>
                    ) : null}
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* News */}
      {news.length > 0 ? (
      <section id="news" className="py-16 lg:py-24" style={{ background: P.bg }}>
        <div className={P.wide}>
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead kicker={newsKicker} title={newsTitle} primary={c.primary} />
            <button
              type="button"
              onClick={newsNav.openList}
              className="text-[14px] font-semibold transition hover:opacity-80"
              style={{ color: c.primary }}
            >
              {newsCta} →
            </button>
          </Reveal>
          <Stagger className="grid gap-5 md:grid-cols-3">
            {news.map((item) => (
              <StaggerItem key={item.id}>
                <HoverLift>
                  <button type="button" className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm" onClick={() => newsNav.openDetail(item)}>
                    {item.image ? <img src={item.image} alt="" className="aspect-[16/10] w-full object-cover" /> : null}
                    <div className="p-5">
                      {item.tags ? (
                        <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: c.primary }}>
                          {item.tags}
                        </div>
                      ) : null}
                      <div className="mt-1 text-[17px] font-bold tracking-tight">{item.title}</div>
                      <p className="mt-2 line-clamp-2 text-[14px]" style={{ color: P.muted }}>
                        {item.excerpt}
                      </p>
                    </div>
                  </button>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
      ) : null}

      {/* CTA band */}
      <section className="py-16" style={{ background: c.primary }}>
        <Reveal className={`${P.wide} flex flex-col items-start justify-between gap-6 text-white lg:flex-row lg:items-center`}>
          <div className="max-w-2xl">
            <h2 className="text-[28px] font-bold tracking-tight sm:text-[34px]">{ctaTitle}</h2>
            <p className="mt-3 text-[15px] text-white/85">{ctaBody}</p>
          </div>
          <Magnetic>
            <a href="#contact" className="inline-flex rounded-md bg-white px-5 py-3 text-[14px] font-semibold" style={{ color: c.primary }}>
              {ctaButton}
            </a>
          </Magnetic>
        </Reveal>
      </section>

      {/* Contact */}
      <section id="contact" className={`${P.wide} grid gap-10 py-16 lg:grid-cols-2 lg:py-24`}>
        <Reveal>
          <SectionHead kicker={contactKicker} title={contactTitle} primary={c.primary} />
          <div className="space-y-2 text-[14px]" style={{ color: P.muted }}>
            {model.contact_email ? <div>{model.contact_email}</div> : null}
            {model.contact_phone ? <div>{model.contact_phone}</div> : null}
            {model.contact_address ? <div className="whitespace-pre-line">{model.contact_address}</div> : null}
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          {sent ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-[15px] text-slate-700 shadow-sm">Thanks — your message was sent.</div>
          ) : (
            <form onSubmit={onContact} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <input required name="name" placeholder="Name" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-[14px] outline-none focus:border-slate-400" />
              <input required name="email" type="email" placeholder="Email" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-[14px] outline-none focus:border-slate-400" />
              <textarea required name="message" rows={4} placeholder="Message" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-[14px] outline-none focus:border-slate-400" />
              {formError ? <div className="text-[13px] text-red-600">{formError}</div> : null}
              <button type="submit" disabled={sending} className="rounded-md px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-60" style={{ background: c.primary }}>
                {sending ? 'Sending…' : contactCta}
              </button>
            </form>
          )}
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-950 py-14 text-white">
        <div className={`${P.wide} grid gap-10 lg:grid-cols-3`}>
          <div>
            <div className="text-[20px] font-extrabold" style={{ color: '#fff' }}>
              {brand}
            </div>
            <p className="mt-3 max-w-sm text-[14px] text-white/65">{footerTagline}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="text-[13px] text-white/75 hover:text-white">
                  {s.label}
                </a>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-white/45">{footerCol.title}</div>
            <FooterLinkList links={footerCol.links} className="space-y-2 text-[14px] text-white/75" />
          </div>
          <div className="text-[14px] text-white/55 lg:text-right">
            <div>{model.contact_email}</div>
            <div className="mt-1">{model.contact_phone}</div>
            <div className="mt-6 text-[13px]">{footerCopy}</div>
          </div>
        </div>
      </footer>
    </Shell>
  )
}
