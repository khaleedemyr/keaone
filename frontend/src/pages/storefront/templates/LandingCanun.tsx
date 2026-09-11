import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import type { StorefrontRenderModel } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { readFooterColumn } from '../lib/footerLinks'
import { inquiryErrorMessage, inquiryFromForm, submitStorefrontInquiry } from '../lib/submitStorefrontInquiry'
import { LandingNewsDetail, newsItemsFromModel, parseSocialLinks, useLandingNewsNav, type LandingNewsItem } from './LandingNewsDetail'
import { LandingNewsPage } from './LandingNewsPage'
import { coerceNavForTemplate } from './storefrontNav'
import { CANUN_DEMO } from './canunDemo'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import { HeroEnter, HoverLift, Magnetic, Parallax, Reveal, Stagger, StaggerItem, Tilt3D } from './storefrontMotion'

/**
 * Canun — Lawyer & Attorney
 * Ref: https://canun-react.wpocean.com/
 * Tokens: navy #1B2336, gold #C9A227, Playfair + Inter, full-bleed hero, feature strip, practice, cases, attorneys, quote
 */

const C = {
  wide: 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8',
  navy: '#1B2336',
  gold: '#C9A227',
  muted: '#6B7280',
  soft: '#F5F3EE',
} as const

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return { primary: C.gold, accent: C.navy, background: '#ffffff', text: C.navy }
  }
  return {
    primary: model.brand_colors.primary || C.gold,
    accent: model.brand_colors.accent || C.navy,
    background: model.brand_colors.background || '#ffffff',
    text: model.brand_colors.text || C.navy,
  }
}

function theme(model: StorefrontRenderModel) {
  return model.theme_content ?? {}
}

function slotText(content: Record<string, unknown>, key: string, fallback: string) {
  const value = content[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function gallery(content: Record<string, unknown>, key: string) {
  const value = content[key]
  return Array.isArray(value) ? value.filter((u): u is string => typeof u === 'string' && u.trim() !== '') : []
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

function Shell({ model, children }: { model: StorefrontRenderModel; children: ReactNode }) {
  const c = colors(model)
  useEffect(() => {
    const id = 'canun-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap'
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
  light,
  center,
}: {
  kicker?: string
  title: string
  body?: string
  primary: string
  light?: boolean
  center?: boolean
}) {
  return (
    <div className={`mb-10 max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
      {kicker ? (
        <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
          {kicker}
        </div>
      ) : null}
      <h2
        className="text-[30px] font-semibold leading-tight sm:text-[40px]"
        style={{ fontFamily: '"Playfair Display", Georgia, serif', color: light ? '#fff' : undefined }}
      >
        {title}
      </h2>
      {body ? (
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: light ? 'rgba(255,255,255,0.75)' : C.muted }}>
          {body}
        </p>
      ) : null}
    </div>
  )
}

export function LandingCanun({ model }: { model: StorefrontRenderModel }) {
  const c = colors(model)
  const content = theme(model)
  const brand = model.title?.trim() || 'Canun'
  const [menuOpen, setMenuOpen] = useState(false)
  const [practiceIdx, setPracticeIdx] = useState(0)
  const [sendingQuote, setSendingQuote] = useState(false)
  const [sendingContact, setSendingContact] = useState(false)
  const [quoteDone, setQuoteDone] = useState(false)
  const [contactDone, setContactDone] = useState(false)
  const [formError, setFormError] = useState('')

  const topbar = slotText(content, 'topbar_text', 'Need help? Call us 24/7')
  const navDefault =
    'Home | #home\nPractice | #practice\nCases | #cases\nAttorneys | #attorneys\nNews | #news\nContact | #contact'
  const nav = coerceNavForTemplate(
    parsePairs(slotText(content, 'nav_links', navDefault)),
    parsePairs(navDefault),
    ['home', 'practice', 'cases', 'attorneys', 'news', 'contact', 'quote'],
  )
  const navCta = slotText(content, 'nav_cta', 'Free Consultation')
  const socials = parseSocialLinks(
    slotText(
      content,
      'social_links',
      'Facebook | https://facebook.com\nTwitter | https://twitter.com\nLinkedIn | https://linkedin.com\nInstagram | https://instagram.com',
    ),
  )

  const heroImage = withDemoImage(model, typeof content.hero_image === 'string' ? content.hero_image : undefined, CANUN_DEMO.hero)
  const heroKicker = slotText(content, 'hero_kicker', 'We Fight For Justice')
  const heroHeadline = slotText(content, 'hero_headline', 'We Are Ready To Fight For Your Rights')
  const heroBody = slotText(
    content,
    'hero_body',
    'Trusted attorneys delivering clear counsel, strong advocacy, and results for families and businesses.',
  )
  const heroCta = slotText(content, 'hero_cta', 'Contact Us Now')
  const heroCta2 = slotText(content, 'hero_cta_secondary', 'Our Practice')

  const features = parsePairs(
    slotText(
      content,
      'features_items',
      'Winning Guarantee | We pursue every case with preparation and resolve.\nSecure Management | Confidential handling of documents and communications.\nFull Time Support | Dedicated counsel available when you need answers.\nFree Consulting | Start with a complimentary case review.',
    ),
  ).slice(0, 4)

  const practiceKicker = slotText(content, 'practice_kicker', 'What We Do')
  const practiceTitle = slotText(content, 'practice_title', 'The Area Where We Practice Our Law')
  const practiceBody = slotText(
    content,
    'practice_body',
    'Focused practice areas with senior attorneys who know the courtroom and the counsel table.',
  )
  const practices = parsePairs(
    slotText(
      content,
      'practice_items',
      'Personal Injury | Representation for accident and injury claims.\nFamily Law | Divorce, custody, and family matters.\nCriminal Law | Defense strategy built around facts and rights.\nEducation Law | Guidance for students, parents, and institutions.\nReal Estate Law | Transactions, disputes, and property counsel.\nBusiness Law | Contracts, compliance, and commercial disputes.',
    ),
  ).slice(0, 6)
  const practicePhotos = withDemoFallback(model, gallery(content, 'practice_gallery'), CANUN_DEMO.practice)

  const casesKicker = slotText(content, 'cases_kicker', 'Case Studies')
  const casesTitle = slotText(content, 'cases_title', 'Recent Case Studies & Our Best Work')
  const caseItems = parsePairs(
    slotText(
      content,
      'cases_items',
      'Highway Injury Settlement | Personal Injury\nCustody Resolution | Family Law\nFraud Defense Verdict | Criminal Law\nCampus Rights Case | Education Law\nProperty Boundary Win | Real Estate\nContract Dispute Close | Business Law',
    ),
  ).slice(0, 6)
  const casePhotos = withDemoFallback(model, gallery(content, 'cases_gallery'), CANUN_DEMO.cases)

  const attorneysKicker = slotText(content, 'attorneys_kicker', 'Our Team')
  const attorneysTitle = slotText(content, 'attorneys_title', 'Meet Our Most Talented & Qualified Attorneys')
  const attorneys = parsePairs(
    slotText(
      content,
      'attorneys_items',
      'Henry Barton | Managing Partner\nAlicia Grant | Senior Counsel\nMarcus Reed | Trial Attorney\nSofia Hale | Family Law Lead',
    ),
  ).slice(0, 4)
  const attorneyPhotos = withDemoFallback(model, gallery(content, 'attorneys_gallery'), CANUN_DEMO.attorneys)

  const quoteTitle = slotText(content, 'quote_title', 'Need Consultancy, Request A Free Quote')
  const quoteBody = slotText(content, 'quote_body', 'Tell us about your matter. We will review and respond with next steps.')
  const quoteCta = slotText(content, 'quote_cta', 'Get Appointment')

  const testimonialsKicker = slotText(content, 'testimonials_kicker', 'Clients')
  const testimonialsTitle = slotText(content, 'testimonials_title', 'What Our Clients Say')
  const testimonials = parseTestimonials(
    slotText(
      content,
      'testimonials',
      'Elena Brooks | Client | Clear advice, steady communication, and a result that protected our family.\nDavid Okonkwo | Business owner | Professional, prepared, and focused on outcomes — exactly what we needed.',
    ),
  )

  const newsKicker = slotText(content, 'news_kicker', 'Latest News')
  const newsTitle = slotText(content, 'news_title', 'Insights From Our Firm')
  const newsCta = slotText(content, 'news_cta', 'See all news')
  const allNews = useMemo(() => {
    const fromModel = newsItemsFromModel(model.news)
    const demoNews: LandingNewsItem[] = [
      {
        id: 'demo-1',
        title: 'How to prepare for your first consultation',
        excerpt: 'Documents, timelines, and questions that help us move quickly.',
        image: CANUN_DEMO.news[0],
        tags: 'Guide',
        body: '',
      },
      {
        id: 'demo-2',
        title: 'Understanding personal injury timelines',
        excerpt: 'What to expect from intake through negotiation or trial.',
        image: CANUN_DEMO.news[1],
        tags: 'Practice',
        body: '',
      },
      {
        id: 'demo-3',
        title: 'Family law updates this quarter',
        excerpt: 'Key changes that may affect custody and support matters.',
        image: CANUN_DEMO.news[2],
        tags: 'News',
        body: '',
      },
    ]
    return withDemoFallback(
      model,
      fromModel.map((n, i) => ({
        ...n,
        image: withDemoImage(model, n.image, CANUN_DEMO.news[i % CANUN_DEMO.news.length]),
      })),
      demoNews,
    )
  }, [model])
  const news = allNews.slice(0, 3)
  const newsNav = useLandingNewsNav(allNews)

  const contactKicker = slotText(content, 'contact_kicker', 'Contact')
  const contactTitle = slotText(content, 'contact_title', 'Visit Our Office')
  const contactCta = slotText(content, 'contact_form_cta', 'Send message')
  const footerTagline = slotText(
    content,
    'footer_tagline',
    'Lawyer and attorney counsel for people who need clarity, strength, and results.',
  )
  const footerCol = readFooterColumn(content, 1, {
    title: 'Quick Links',
    links: 'Practice | #practice\nCases | #cases\nAttorneys | #attorneys\nNews | #news\nContact | #contact',
  })
  const footerCopy = slotText(content, 'footer_copy', '© Canun Lawyer. All rights reserved.')

  async function onQuote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sendingQuote) return
    setSendingQuote(true)
    setFormError('')
    try {
      const fields = inquiryFromForm(e.currentTarget)
      await submitStorefrontInquiry({
        kind: 'quote',
        ...fields,
        preview: model.preview,
        host: model.host,
      })
      setQuoteDone(true)
      e.currentTarget.reset()
    } catch (err) {
      setFormError(inquiryErrorMessage(err))
    } finally {
      setSendingQuote(false)
    }
  }

  async function onContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sendingContact) return
    setSendingContact(true)
    setFormError('')
    try {
      const fields = inquiryFromForm(e.currentTarget)
      await submitStorefrontInquiry({
        kind: 'contact',
        ...fields,
        preview: model.preview,
        host: model.host,
      })
      setContactDone(true)
      e.currentTarget.reset()
    } catch (err) {
      setFormError(inquiryErrorMessage(err))
    } finally {
      setSendingContact(false)
    }
  }

  if (newsNav.view === 'detail' && newsNav.selected) {
    return (
      <Shell model={model}>
        <LandingNewsDetail
          item={newsNav.selected}
          onBack={newsNav.backFromDetail}
          primary={c.primary}
          muted={C.muted}
          preview={model.preview}
          fontHeading='"Playfair Display", Georgia, serif'
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
          muted={C.muted}
          preview={model.preview}
          fontHeading='"Playfair Display", Georgia, serif'
          brand={brand}
          kicker={newsKicker}
          title={newsTitle}
        />
      </Shell>
    )
  }

  const activePractice = practices[practiceIdx] || practices[0]

  return (
    <Shell model={model}>
      {/* Topbar */}
      <div className="hidden border-b border-black/10 bg-[#151b2a] text-white sm:block">
        <div className={`${C.wide} flex items-center justify-between py-2 text-[12px]`}>
          <div className="opacity-80">
            {topbar}
            {model.contact_phone ? <span className="ml-2 font-semibold" style={{ color: c.primary }}>{model.contact_phone}</span> : null}
          </div>
          <div className="flex gap-3">
            {socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="opacity-75 hover:opacity-100">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className={`${C.wide} flex h-[72px] items-center justify-between`}>
          <a
            href="#home"
            className="text-[22px] font-semibold tracking-tight"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            onClick={(e) => {
              e.preventDefault()
              newsNav.goSection('#home')
            }}
          >
            {brand}
            <span style={{ color: c.primary }}>.</span>
          </a>
          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map((n) => (
              <a
                key={n.name}
                href={n.detail || '#'}
                className="text-[14px] font-medium text-slate-700 hover:opacity-70"
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
                href="#quote"
                className="hidden rounded-sm px-4 py-2.5 text-[13px] font-semibold text-white sm:inline-flex"
                style={{ background: c.primary, color: C.navy }}
                onClick={(e) => {
                  e.preventDefault()
                  newsNav.goSection('#quote')
                }}
              >
                {navCta}
              </a>
            </Magnetic>
            <button type="button" className="rounded border border-slate-200 px-3 py-2 text-[12px] font-semibold lg:hidden" onClick={() => setMenuOpen((v) => !v)}>
              Menu
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
            {nav.map((n) => (
              <a
                key={n.name}
                href={n.detail || '#'}
                className="block py-2 text-[14px] font-medium"
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
        ) : null}
      </header>

      {/* Hero — full-bleed rectangular */}
      <section id="home" className="relative min-h-[78vh] overflow-hidden text-white sm:min-h-[88vh]">
        <Parallax className="absolute inset-0">
          <img src={heroImage} alt="" className="h-[115%] w-full object-cover" />
        </Parallax>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1420]/92 via-[#0f1420]/70 to-[#0f1420]/35" />
        <div className={`${C.wide} relative z-10 flex min-h-[78vh] items-center py-16 sm:min-h-[88vh]`}>
          <HeroEnter className="max-w-2xl">
            <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.22em]" style={{ color: c.primary }}>
              {heroKicker}
            </div>
            <h1
              className="text-[40px] font-semibold leading-[1.1] sm:text-[56px] lg:text-[64px]"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {heroHeadline}
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/80">{heroBody}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic>
                <a
                  href="#quote"
                  className="inline-flex px-6 py-3 text-[14px] font-semibold"
                  style={{ background: c.primary, color: C.navy }}
                  onClick={(e) => {
                    e.preventDefault()
                    newsNav.goSection('#quote')
                  }}
                >
                  {heroCta}
                </a>
              </Magnetic>
              <a
                href="#practice"
                className="inline-flex border border-white/40 px-6 py-3 text-[14px] font-semibold text-white"
                onClick={(e) => {
                  e.preventDefault()
                  newsNav.goSection('#practice')
                }}
              >
                {heroCta2}
              </a>
            </div>
          </HeroEnter>
        </div>
      </section>

      {/* Feature strip */}
      <section className="relative z-20 -mt-10 pb-6 sm:-mt-14">
        <div className={C.wide}>
          <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <StaggerItem key={f.name}>
                <HoverLift>
                  <article className="h-full border border-black/5 bg-white p-5 shadow-lg shadow-black/10">
                    <div className="mb-3 text-[12px] font-bold" style={{ color: c.primary }}>
                      0{i + 1}
                    </div>
                    <h3 className="text-[17px] font-bold" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                      {f.name}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed" style={{ color: C.muted }}>
                      {f.detail}
                    </p>
                  </article>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Practice areas */}
      <section id="practice" className="py-16 lg:py-24" style={{ background: C.soft }}>
        <div className={C.wide}>
          <Reveal>
            <SectionHead kicker={practiceKicker} title={practiceTitle} body={practiceBody} primary={c.primary} />
          </Reveal>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <div className="space-y-2">
                {practices.map((p, i) => (
                  <button
                    key={p.name}
                    type="button"
                    className="flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition"
                    style={{
                      borderColor: practiceIdx === i ? c.primary : 'transparent',
                      background: practiceIdx === i ? '#fff' : 'transparent',
                    }}
                    onClick={() => setPracticeIdx(i)}
                  >
                    <span className="text-[13px] font-bold" style={{ color: c.primary }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[15px] font-semibold">{p.name}</span>
                  </button>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              {activePractice ? (
                <div className="overflow-hidden bg-white shadow-sm">
                  <img
                    src={practicePhotos[practiceIdx % practicePhotos.length]}
                    alt=""
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <div className="p-6">
                    <h3 className="text-[24px] font-semibold" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                      {activePractice.name}
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed" style={{ color: C.muted }}>
                      {activePractice.detail}
                    </p>
                    <a href="#quote" className="mt-5 inline-flex text-[13px] font-semibold" style={{ color: c.primary }}>
                      Request consultation →
                    </a>
                  </div>
                </div>
              ) : null}
            </Reveal>
          </div>
        </div>
      </section>

      {/* Cases */}
      <section id="cases" className="py-16 lg:py-24">
        <div className={C.wide}>
          <Reveal>
            <SectionHead kicker={casesKicker} title={casesTitle} primary={c.primary} />
          </Reveal>
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {caseItems.map((item, i) => (
              <StaggerItem key={item.name}>
                <HoverLift>
                  <article className="group overflow-hidden border border-black/5 bg-white shadow-sm">
                    <div className="relative overflow-hidden">
                      <img
                        src={casePhotos[i % casePhotos.length]}
                        alt=""
                        className="aspect-[16/11] w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute left-3 top-3 bg-white/95 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.primary }}>
                        {item.detail}
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-[18px] font-semibold" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                        {item.name}
                      </h3>
                    </div>
                  </article>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Attorneys */}
      <section id="attorneys" className="py-16 lg:py-24" style={{ background: C.soft }}>
        <div className={C.wide}>
          <Reveal>
            <SectionHead kicker={attorneysKicker} title={attorneysTitle} primary={c.primary} center />
          </Reveal>
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {attorneys.map((a, i) => (
              <StaggerItem key={a.name}>
                <Tilt3D className="relative overflow-hidden bg-white shadow-sm">
                  <img src={attorneyPhotos[i % attorneyPhotos.length]} alt="" className="aspect-[3/4] w-full object-cover" />
                  <div className="p-4 text-center">
                    <div className="text-[17px] font-semibold" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                      {a.name}
                    </div>
                    <div className="mt-1 text-[12px] font-semibold uppercase tracking-wide" style={{ color: c.primary }}>
                      {a.detail}
                    </div>
                  </div>
                </Tilt3D>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Free quote */}
      <section id="quote" className="py-16 text-white lg:py-20" style={{ background: c.accent }}>
        <div className={`${C.wide} grid items-center gap-10 lg:grid-cols-2`}>
          <Reveal>
            <h2 className="text-[32px] font-semibold leading-tight sm:text-[40px]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
              {quoteTitle}
            </h2>
            <p className="mt-4 text-[15px] text-white/75">{quoteBody}</p>
            <div className="mt-6 space-y-1 text-[14px] text-white/70">
              {model.contact_phone ? <div>{model.contact_phone}</div> : null}
              {model.contact_email ? <div>{model.contact_email}</div> : null}
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            {quoteDone ? (
              <div className="bg-white p-6 text-[15px] text-slate-800">Thanks — we received your request and will follow up soon.</div>
            ) : (
              <form onSubmit={onQuote} className="space-y-3 bg-white p-6 text-[14px] text-slate-800">
                <input name="sf_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <input required name="name" placeholder="Full name" className="w-full border border-slate-200 px-4 py-3 outline-none" />
                <input required name="email" type="email" placeholder="Email" className="w-full border border-slate-200 px-4 py-3 outline-none" />
                <select name="subject" className="w-full border border-slate-200 px-4 py-3 outline-none" defaultValue="">
                  <option value="" disabled>
                    Subject
                  </option>
                  {practices.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <textarea required name="message" rows={4} placeholder="Case details" className="w-full border border-slate-200 px-4 py-3 outline-none" />
                {formError ? <div className="text-[13px] text-red-600">{formError}</div> : null}
                <button type="submit" disabled={sendingQuote} className="w-full px-4 py-3 text-[14px] font-semibold disabled:opacity-60" style={{ background: c.primary, color: C.navy }}>
                  {sendingQuote ? 'Sending…' : quoteCta}
                </button>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 lg:py-24">
        <div className={C.wide}>
          <Reveal>
            <SectionHead kicker={testimonialsKicker} title={testimonialsTitle} primary={c.primary} center />
          </Reveal>
          <Stagger className="grid gap-5 md:grid-cols-2">
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <HoverLift>
                  <blockquote className="h-full border border-black/5 bg-white p-6 shadow-sm">
                    <p className="text-[15px] leading-relaxed" style={{ color: C.muted }}>
                      “{t.quote}”
                    </p>
                    <footer className="mt-5">
                      <div className="font-bold" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                        {t.name}
                      </div>
                      <div className="text-[12px] uppercase tracking-wide" style={{ color: c.primary }}>
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

      {/* News */}
      {news.length > 0 ? (
      <section id="news" className="py-16 lg:py-24" style={{ background: C.soft }}>
        <div className={C.wide}>
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
                  <button type="button" className="w-full overflow-hidden bg-white text-left shadow-sm" onClick={() => newsNav.openDetail(item)}>
                    {item.image ? <img src={item.image} alt="" className="aspect-[16/10] w-full object-cover" /> : null}
                    <div className="p-5">
                      {item.tags ? (
                        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.primary }}>
                          {item.tags}
                        </div>
                      ) : null}
                      <div className="mt-1 text-[18px] font-semibold" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                        {item.title}
                      </div>
                      <p className="mt-2 line-clamp-2 text-[14px]" style={{ color: C.muted }}>
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

      {/* Contact */}
      <section id="contact" className={`${C.wide} grid gap-10 py-16 lg:grid-cols-2 lg:py-24`}>
        <Reveal>
          <SectionHead kicker={contactKicker} title={contactTitle} primary={c.primary} />
          <div className="space-y-2 text-[15px]" style={{ color: C.muted }}>
            {model.contact_email ? <div>{model.contact_email}</div> : null}
            {model.contact_phone ? <div>{model.contact_phone}</div> : null}
            {model.contact_address ? <div className="whitespace-pre-line">{model.contact_address}</div> : null}
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          {contactDone ? (
            <div className="border border-black/5 bg-white p-6 text-[15px] text-slate-700">Thanks — your message was sent.</div>
          ) : (
            <form onSubmit={onContact} className="space-y-3 border border-black/5 bg-white p-6 shadow-sm">
              <input name="sf_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <input required name="name" placeholder="Name" className="w-full border border-slate-200 px-4 py-3 text-[14px] outline-none" />
              <input required name="email" type="email" placeholder="Email" className="w-full border border-slate-200 px-4 py-3 text-[14px] outline-none" />
              <textarea required name="message" rows={4} placeholder="Message" className="w-full border border-slate-200 px-4 py-3 text-[14px] outline-none" />
              {formError ? <div className="text-[13px] text-red-600">{formError}</div> : null}
              <button type="submit" disabled={sendingContact} className="px-6 py-3 text-[14px] font-semibold disabled:opacity-60" style={{ background: c.primary, color: C.navy }}>
                {sendingContact ? 'Sending…' : contactCta}
              </button>
            </form>
          )}
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="py-14 text-white" style={{ background: C.navy }}>
        <div className={`${C.wide} grid gap-10 lg:grid-cols-3`}>
          <div>
            <div className="text-[22px] font-semibold" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
              {brand}
              <span style={{ color: c.primary }}>.</span>
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
