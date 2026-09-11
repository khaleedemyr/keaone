import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import type { StorefrontRenderModel } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { readFooterColumn } from '../lib/footerLinks'
import { inquiryErrorMessage, inquiryFromForm, submitStorefrontInquiry } from '../lib/submitStorefrontInquiry'
import { LandingNewsDetail, newsItemsFromModel, parseSocialLinks, useLandingNewsNav, type LandingNewsItem } from './LandingNewsDetail'
import { LandingNewsPage } from './LandingNewsPage'
import { coerceNavForTemplate } from './storefrontNav'
import { DILABS_DEMO } from './dilabsDemo'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import { Float, HeroEnter, HoverLift, Parallax, Reveal, Stagger, StaggerItem, Tilt3D } from './storefrontMotion'

/**
 * Dilabs creative digital agency — https://dilabs-react.netlify.app/
 * Tokens: deep navy #0B0C2A, accent orange #FF5A1F, soft #F5F3F0, Outfit + DM Sans
 */

const DL = {
  wide: 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8',
  navy: '#0B0C2A',
  accent: '#FF5A1F',
  soft: '#F5F3F0',
  muted: '#6B7280',
} as const

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return { primary: DL.accent, accent: DL.navy, background: '#ffffff', text: DL.navy }
  }
  return {
    primary: model.brand_colors.primary || DL.accent,
    accent: model.brand_colors.accent || DL.navy,
    background: model.brand_colors.background || '#ffffff',
    text: model.brand_colors.text || DL.navy,
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
      return {
        name: parts[0] || '',
        role: parts[1] || '',
        quote: parts.slice(2).join('|') || '',
      }
    })
    .filter((t) => t.name && t.quote)
}

function Shell({ model, children }: { model: StorefrontRenderModel; children: ReactNode }) {
  const c = colors(model)
  useEffect(() => {
    const id = 'dilabs-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@500;600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        background: c.background,
        color: c.text,
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}
    >
      {model.preview ? (
        <div className="sticky top-0 z-[60] bg-amber-100 px-3 py-1.5 text-center text-[12px] text-amber-950">
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
  primary,
  light,
}: {
  kicker: string
  title: string
  primary: string
  light?: boolean
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <div
        className="mb-3 text-[13px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: primary }}
      >
        {kicker}
      </div>
      <h2
        className="text-[32px] font-bold leading-tight sm:text-[40px]"
        style={{
          fontFamily: 'Outfit, system-ui, sans-serif',
          color: light ? '#fff' : undefined,
        }}
      >
        {title}
      </h2>
    </div>
  )
}

export function LandingDilabs({ model }: { model: StorefrontRenderModel }) {
  const c = colors(model)
  const content = theme(model)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState('')
  const brand = model.title?.trim() || 'Dilabs'

  const navDefault = 'About | #about\nServices | #services\nProjects | #projects\nTeam | #team\nNews | #news\nContact | #contact'
  const nav = coerceNavForTemplate(
    parsePairs(slotText(content, 'nav_links', navDefault)),
    parsePairs(navDefault),
    ['top', 'about', 'services', 'projects', 'team', 'news', 'contact'],
  )
  const navCta = slotText(content, 'nav_cta', 'Get started')
  const heroKicker = slotText(content, 'hero_kicker', 'Creative digital agency')
  const heroHeadline = slotText(content, 'hero_headline', 'We craft digital products that grow brands')
  const heroBody = slotText(
    content,
    'hero_body',
    'Strategy, design, and engineering for ambitious companies. From launch sites to product platforms — we ship work that converts.',
  )
  const heroCta = slotText(content, 'hero_cta', 'Start a project')
  const heroCta2 = slotText(content, 'hero_cta_secondary', 'View projects')
  const heroImage = withDemoImage(model, typeof content.hero_image === 'string' ? content.hero_image : undefined, DILABS_DEMO.hero)

  const aboutKicker = slotText(content, 'about_kicker', 'Who we are')
  const aboutTitle = slotText(content, 'about_title', 'A studio built for modern brands')
  const aboutBody = slotText(
    content,
    'about_body',
    'We partner with founders and marketing teams to design clear experiences, ship reliable products, and measure what matters.',
  )
  const aboutCta = slotText(content, 'about_cta', 'More about us')
  const aboutImage = withDemoImage(model, typeof content.about_image === 'string' ? content.about_image : undefined, DILABS_DEMO.about)
  const stats = parsePairs(
    slotText(content, 'stats_list', '120+|Projects shipped\n40+|Happy clients\n12|Years experience\n24/7|Support'),
  ).slice(0, 4)

  const servicesKicker = slotText(content, 'services_kicker', 'What we do')
  const servicesTitle = slotText(content, 'services_title', 'Services that move the needle')
  const services = parsePairs(
    slotText(
      content,
      'services_items',
      'Brand & identity | Position, voice, and visual systems.\nWeb design | Conversion-focused marketing sites.\nProduct UI/UX | Research-backed interfaces.\nWeb development | Performant React builds.\nDigital marketing | SEO and campaigns.\nGrowth consulting | Roadmaps and audits.',
    ),
  ).slice(0, 6)

  const projectsKicker = slotText(content, 'projects_kicker', 'Selected work')
  const projectsTitle = slotText(content, 'projects_title', 'Projects we are proud of')
  const projectsCta = slotText(content, 'projects_cta', 'All projects')
  const projectItems = parsePairs(
    slotText(
      content,
      'projects_items',
      'Northwind Commerce | E-commerce\nPulse Analytics | SaaS dashboard\nLumen Studio | Branding\nAtlas Travel | Mobile app\nForge Capital | Corporate site\nBeacon Health | Product design',
    ),
  ).slice(0, 6)
  const projectPhotos = withDemoFallback(model, gallery(content, 'projects_gallery'), DILABS_DEMO.projects)

  const processKicker = slotText(content, 'process_kicker', 'How we work')
  const processTitle = slotText(content, 'process_title', 'A clear process from brief to launch')
  const processSteps = parsePairs(
    slotText(
      content,
      'process_steps',
      'Discover | Workshops and audits.\nDesign | Concepts and systems.\nBuild | Engineering that ships.\nGrow | Iterate with data.',
    ),
  ).slice(0, 4)

  const teamKicker = slotText(content, 'team_kicker', 'Our people')
  const teamTitle = slotText(content, 'team_title', 'Meet the specialists')
  const team = parsePairs(
    slotText(
      content,
      'team_members',
      'Ava Mitchell | Creative director\nJonah Park | Lead engineer\nSofia Reyes | Product designer\nMarcus Chen | Growth strategist',
    ),
  ).slice(0, 4)
  const teamPhotos = withDemoFallback(model, gallery(content, 'team_gallery'), DILABS_DEMO.team)

  const testimonialsKicker = slotText(content, 'testimonials_kicker', 'Clients say')
  const testimonialsTitle = slotText(content, 'testimonials_title', 'Trusted by ambitious teams')
  const testimonials = parseTestimonials(
    slotText(
      content,
      'testimonials',
      'Elena Brooks | CMO, Northwind | They shipped our relaunch in weeks.\nDavid Okonkwo | Founder, Pulse | Senior talent, no fluff.\nPriya Nair | VP Product, Atlas | Design and code quality were excellent.',
    ),
  ).slice(0, 3)

  const newsKicker = slotText(content, 'news_kicker', 'Insights')
  const newsTitle = slotText(content, 'news_title', 'Latest from the studio')
  const newsCta = slotText(content, 'news_cta', 'View all posts')
  const newsFromApi = newsItemsFromModel(model.news)
  const demoNews: LandingNewsItem[] = [
    {
      id: 'demo-1',
      title: 'How we redesign agency sites for conversion',
      excerpt: 'A practical checklist from discovery to launch metrics.',
      body: 'A practical checklist from discovery to launch metrics.',
      image: DILABS_DEMO.news[0],
      tags: 'Agency, Insights',
    },
    {
      id: 'demo-2',
      title: 'Building product dashboards teams actually use',
      excerpt: 'Patterns that reduce noise and surface decisions.',
      body: 'Patterns that reduce noise and surface decisions.',
      image: DILABS_DEMO.news[1],
      tags: 'Product, UX',
    },
    {
      id: 'demo-3',
      title: 'Motion that sells — without slowing the site',
      excerpt: 'Lightweight animation guidelines for marketing pages.',
      body: 'Lightweight animation guidelines for marketing pages.',
      image: DILABS_DEMO.news[2],
      tags: 'Design, Motion',
    },
  ]
  const allNews: LandingNewsItem[] = withDemoFallback(
    model,
    newsFromApi.map((n, i) => ({
      ...n,
      image: withDemoImage(model, n.image, DILABS_DEMO.news[i % DILABS_DEMO.news.length]),
      tags: n.tags || 'Agency, Insights',
    })),
    demoNews,
  )
  const news = allNews.slice(0, 3)
  const newsNav = useLandingNewsNav(allNews)

  const ctaTitle = slotText(content, 'cta_title', 'Ready to build something remarkable?')
  const ctaBody = slotText(
    content,
    'cta_body',
    'Tell us about your roadmap. We will reply with next steps within one business day.',
  )
  const ctaButton = slotText(content, 'cta_button', 'Book a call')

  const contactKicker = slotText(content, 'contact_kicker', 'Contact')
  const contactTitle = slotText(content, 'contact_title', 'Let’s talk about your next launch')
  const contactFormCta = slotText(content, 'contact_form_cta', 'Send message')

  const footerTagline = slotText(
    content,
    'footer_tagline',
    'Creative digital agency for brands that want clarity, craft, and growth.',
  )
  const footerCol = readFooterColumn(content, 1, {
    title: 'Explore',
    links: 'About | #about\nServices | #services\nProjects | #projects\nNews | #news\nContact | #contact',
  })
  const socials = parseSocialLinks(
    slotText(content, 'social_links', 'LinkedIn | #\nInstagram | #\nX | #\nDribbble | #'),
  )
  const footerCopy = slotText(content, 'footer_copy', `© ${brand}. All rights reserved.`)

  async function onContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setFormError('')
    try {
      await submitStorefrontInquiry({
        kind: 'contact',
        ...inquiryFromForm(e.currentTarget),
        preview: model.preview,
        host: model.host,
      })
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
          primary={c.text}
          muted={DL.muted}
          preview={model.preview}
          fontHeading="Outfit, system-ui, sans-serif"
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
          primary={c.text}
          muted={DL.muted}
          preview={model.preview}
          fontHeading="Outfit, system-ui, sans-serif"
          brand={brand}
          kicker={newsKicker}
          title={newsTitle}
        />
      </Shell>
    )
  }

  return (
    <Shell model={model}>
      <header
        className={`sticky z-50 border-b border-black/5 bg-white/90 backdrop-blur-md ${model.preview ? 'top-8' : 'top-0'}`}
      >
        <div className={`${DL.wide} flex h-16 items-center justify-between gap-4 sm:h-[72px]`}>
          <a
            href="#top"
            className="text-[22px] font-extrabold tracking-tight"
            style={{ fontFamily: 'Outfit, system-ui, sans-serif', color: c.text }}
            onClick={(e) => {
              e.preventDefault()
              newsNav.goSection('#top')
            }}
          >
            {brand}
            <span style={{ color: c.primary }}>.</span>
          </a>
          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map((item) => (
              <a
                key={item.name}
                href={item.detail || '#'}
                className="text-[14px] font-medium text-slate-600 hover:opacity-70"
                onClick={(e) => {
                  e.preventDefault()
                  newsNav.goSection(item.detail || '#')
                }}
              >
                {item.name}
              </a>
            ))}
            <a
              href="#contact"
              className="rounded-full px-5 py-2.5 text-[13px] font-semibold text-white"
              style={{ background: c.primary }}
              onClick={(e) => {
                e.preventDefault()
                newsNav.goSection('#contact')
              }}
            >
              {navCta}
            </a>
          </nav>
          <button
            type="button"
            className="rounded-lg border border-black/10 px-3 py-2 text-[13px] font-semibold lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
        {menuOpen ? (
          <div className="border-t border-black/5 bg-white px-4 py-3 lg:hidden">
            {nav.map((item) => (
              <a
                key={item.name}
                href={item.detail || '#'}
                className="block py-2 text-[15px] font-medium"
                onClick={(e) => {
                  e.preventDefault()
                  newsNav.goSection(item.detail || '#')
                  setMenuOpen(false)
                }}
              >
                {item.name}
              </a>
            ))}
          </div>
        ) : null}
      </header>

      {/* Hero — full-bleed */}
      <section id="top" className="relative overflow-hidden" style={{ background: c.accent }}>
        <Float
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-30"
          style={{ background: c.primary }}
          amplitude={22}
          duration={6}
          children={null}
        />
        <Float
          className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full opacity-20"
          style={{ background: c.primary }}
          amplitude={26}
          duration={7.5}
          children={null}
        />
        <div className={`${DL.wide} grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24`}>
          <HeroEnter className="relative z-10 text-white">
            <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.2em]" style={{ color: c.primary }}>
              {heroKicker}
            </div>
            <h1
              className="text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-[52px] lg:text-[58px]"
              style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
            >
              {heroHeadline}
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-white/75">{heroBody}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="inline-flex rounded-full px-6 py-3 text-[14px] font-semibold text-white"
                style={{ background: c.primary }}
              >
                {heroCta}
              </a>
              <a
                href="#projects"
                className="inline-flex rounded-full border border-white/25 px-6 py-3 text-[14px] font-semibold text-white hover:bg-white/10"
              >
                {heroCta2}
              </a>
            </div>
          </HeroEnter>
          <HeroEnter delay={0.15} className="relative z-10">
            <Tilt3D className="relative overflow-hidden rounded-[28px] shadow-2xl shadow-black/40">
              <Parallax offset={80}>
                <img src={heroImage} alt="" className="aspect-[4/3] w-full object-cover" />
              </Parallax>
            </Tilt3D>
          </HeroEnter>
        </div>
      </section>

      {/* About + stats */}
      <section id="about" className={`${DL.wide} grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:py-24`}>
        <Reveal x={-24}>
          <Tilt3D className="relative overflow-hidden rounded-[24px]">
            <img src={aboutImage} alt="" className="aspect-[5/4] w-full object-cover" />
          </Tilt3D>
        </Reveal>
        <Reveal delay={0.1} x={24}>
          <SectionHead kicker={aboutKicker} title={aboutTitle} primary={c.primary} />
          <p className="text-[16px] leading-relaxed" style={{ color: DL.muted }}>
            {aboutBody}
          </p>
          <a href="#contact" className="mt-6 inline-flex text-[14px] font-semibold" style={{ color: c.primary }}>
            {aboutCta} →
          </a>
          <div className="mt-10 grid grid-cols-2 gap-6">
            {stats.map((s) => (
              <div key={s.name}>
                <div className="text-[28px] font-extrabold" style={{ fontFamily: 'Outfit, system-ui, sans-serif', color: c.text }}>
                  {s.name}
                </div>
                <div className="mt-1 text-[13px]" style={{ color: DL.muted }}>
                  {s.detail}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Services */}
      <section id="services" className="py-16 lg:py-24" style={{ background: DL.soft }}>
        <div className={DL.wide}>
          <Reveal>
            <SectionHead kicker={servicesKicker} title={servicesTitle} primary={c.primary} />
          </Reveal>
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((svc, i) => (
              <StaggerItem key={svc.name} as="article">
                <Tilt3D className="relative h-full rounded-2xl bg-white p-6 shadow-sm">
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-[14px] font-bold text-white"
                    style={{ background: c.primary }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="text-[18px] font-bold" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
                    {svc.name}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: DL.muted }}>
                    {svc.detail}
                  </p>
                </Tilt3D>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" className={`${DL.wide} py-16 lg:py-24`}>
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <SectionHead kicker={projectsKicker} title={projectsTitle} primary={c.primary} />
          <a href="#contact" className="text-[14px] font-semibold" style={{ color: c.primary }}>
            {projectsCta} →
          </a>
        </Reveal>
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07}>
          {projectItems.map((p, i) => (
            <StaggerItem key={p.name} as="article">
              <HoverLift className="group overflow-hidden rounded-2xl bg-slate-100">
                <div className="overflow-hidden">
                  <img
                    src={projectPhotos[i % projectPhotos.length]}
                    alt=""
                    className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: c.primary }}>
                    {p.detail}
                  </div>
                  <h3 className="mt-1 text-[17px] font-bold" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
                    {p.name}
                  </h3>
                </div>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Process */}
      <section className="py-16 lg:py-24" style={{ background: c.accent }}>
        <div className={DL.wide}>
          <Reveal>
            <SectionHead kicker={processKicker} title={processTitle} primary={c.primary} light />
          </Reveal>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step, i) => (
              <StaggerItem key={step.name}>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white backdrop-blur-sm transition hover:bg-white/10">
                  <div className="text-[13px] font-bold" style={{ color: c.primary }}>
                    0{i + 1}
                  </div>
                  <h3 className="mt-3 text-[18px] font-bold" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
                    {step.name}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/70">{step.detail}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Team */}
      <section id="team" className={`${DL.wide} py-16 lg:py-24`}>
        <Reveal>
          <SectionHead kicker={teamKicker} title={teamTitle} primary={c.primary} />
        </Reveal>
        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((m, i) => (
            <StaggerItem key={m.name} as="article">
              <Tilt3D className="relative" maxTilt={16}>
                <div className="overflow-hidden rounded-2xl bg-slate-100">
                  <img src={teamPhotos[i % teamPhotos.length]} alt="" className="aspect-[3/4] w-full object-cover" />
                </div>
                <h3 className="mt-3 text-[17px] font-bold" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
                  {m.name}
                </h3>
                <p className="text-[13px]" style={{ color: DL.muted }}>
                  {m.detail}
                </p>
              </Tilt3D>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Testimonials */}
      <section className="py-16 lg:py-24" style={{ background: DL.soft }}>
        <div className={DL.wide}>
          <Reveal>
            <SectionHead kicker={testimonialsKicker} title={testimonialsTitle} primary={c.primary} />
          </Reveal>
          <Stagger className="grid gap-5 lg:grid-cols-3">
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <HoverLift>
                  <blockquote className="rounded-2xl bg-white p-6">
                    <p className="text-[15px] leading-relaxed" style={{ color: DL.muted }}>
                      “{t.quote}”
                    </p>
                    <footer className="mt-5">
                      <div className="font-bold" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
                        {t.name}
                      </div>
                      <div className="text-[13px]" style={{ color: DL.muted }}>
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
      <section id="news" className={`${DL.wide} py-16 lg:py-24`}>
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <SectionHead kicker={newsKicker} title={newsTitle} primary={c.primary} />
          <button
            type="button"
            onClick={newsNav.openList}
            className="text-[14px] font-semibold transition hover:opacity-80"
            style={{ color: c.primary }}
          >
            {newsCta}
          </button>
        </Reveal>
        <Stagger className="grid gap-6 md:grid-cols-3">
          {news.map((item) => (
            <StaggerItem key={item.id}>
              <HoverLift>
                <button
                  type="button"
                  className="group w-full text-left"
                  onClick={() => newsNav.openDetail(item)}
                >
                  <div className="overflow-hidden rounded-2xl bg-slate-100">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  {item.tags ? (
                    <div className="mt-3 text-[12px] font-semibold uppercase tracking-wide" style={{ color: c.primary }}>
                      {item.tags}
                    </div>
                  ) : null}
                  <h3
                    className="mt-1 text-[18px] font-bold leading-snug group-hover:opacity-80"
                    style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[14px]" style={{ color: DL.muted }}>
                    {item.excerpt}
                  </p>
                </button>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
      ) : null}

      {/* CTA banner */}
      <section className="py-16" style={{ background: c.primary }}>
        <Reveal className={`${DL.wide} flex flex-col items-start justify-between gap-6 text-white lg:flex-row lg:items-center`}>
          <div className="max-w-xl">
            <h2 className="text-[30px] font-extrabold sm:text-[36px]" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
              {ctaTitle}
            </h2>
            <p className="mt-3 text-[15px] text-white/85">{ctaBody}</p>
          </div>
          <a
            href="#contact"
            className="inline-flex shrink-0 rounded-full bg-white px-6 py-3 text-[14px] font-semibold"
            style={{ color: c.primary }}
          >
            {ctaButton}
          </a>
        </Reveal>
      </section>

      {/* Contact */}
      <section id="contact" className={`${DL.wide} grid gap-10 py-16 lg:grid-cols-2 lg:py-24`}>
        <Reveal>
          <SectionHead kicker={contactKicker} title={contactTitle} primary={c.primary} />
          <div className="space-y-3 text-[15px]" style={{ color: DL.muted }}>
            {model.contact_email ? <div>{model.contact_email}</div> : null}
            {model.contact_phone ? <div>{model.contact_phone}</div> : null}
            {model.contact_address ? <div className="whitespace-pre-line">{model.contact_address}</div> : null}
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          {sent ? (
            <div className="rounded-2xl p-6 text-[15px]" style={{ background: DL.soft }}>
              Thanks — your message was sent.
            </div>
          ) : (
            <form onSubmit={onContact} className="space-y-3 rounded-2xl p-6" style={{ background: DL.soft }}>
              <input name="sf_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <input className="w-full rounded-xl border-0 bg-white px-4 py-3 text-[14px]" name="name" placeholder="Name" required />
              <input className="w-full rounded-xl border-0 bg-white px-4 py-3 text-[14px]" name="email" type="email" placeholder="Email" required />
              <textarea className="w-full rounded-xl border-0 bg-white px-4 py-3 text-[14px]" name="message" rows={4} placeholder="Message" required />
              {formError ? <div className="text-[13px] text-red-600">{formError}</div> : null}
              <button
                type="submit"
                disabled={sending}
                className="rounded-full px-6 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
                style={{ background: c.primary }}
              >
                {sending ? 'Sending…' : contactFormCta}
              </button>
            </form>
          )}
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 py-12" style={{ background: c.accent, color: '#fff' }}>
        <div className={`${DL.wide} grid gap-10 lg:grid-cols-3`}>
          <div>
            <div className="text-[22px] font-extrabold" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
              {brand}
              <span style={{ color: c.primary }}>.</span>
            </div>
            <p className="mt-3 max-w-sm text-[14px] text-white/70">{footerTagline}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="text-[13px] text-white/80 hover:text-white">
                  {s.label}
                </a>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-white/50">{footerCol.title}</div>
            <FooterLinkList links={footerCol.links} className="space-y-2 text-[14px] text-white/80" />
          </div>
          <div className="text-[14px] text-white/60 lg:text-right">
            <div>{model.contact_email}</div>
            <div className="mt-1">{model.contact_phone}</div>
            <div className="mt-6 text-[13px]">{footerCopy}</div>
          </div>
        </div>
      </footer>
    </Shell>
  )
}
