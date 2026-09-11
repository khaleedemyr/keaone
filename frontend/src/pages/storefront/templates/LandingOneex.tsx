import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import type { StorefrontRenderModel } from './renderTypes'
import { LandingNewsDetail, newsItemsFromModel, parseSocialLinks, useLandingNewsNav, type LandingNewsItem } from './LandingNewsDetail'
import { LandingNewsPage } from './LandingNewsPage'
import { coerceNavForTemplate } from './storefrontNav'
import { inquiryErrorMessage, inquiryFromForm, submitStorefrontInquiry } from '../lib/submitStorefrontInquiry'
import { ONEEX_DEMO } from './oneexDemo'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import { HeroEnter, HoverLift, Reveal, ScalePop, Stagger, StaggerItem } from './storefrontMotion'

/**
 * Oneex landing — matched to marketing hero at https://11-76.com/themes/oneex/
 * Full-bleed rectangular banner (NOT circular), centered condensed title, horizontal nav.
 */

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

function parseNav(raw: string) {
  return parsePairs(raw).map((p) => ({
    label: p.name,
    href: p.detail.startsWith('#') || p.detail.startsWith('http') ? p.detail : `#${p.detail.replace(/^#/, '')}`,
  }))
}

function skinOf(content: Record<string, unknown>) {
  return slotText(content, 'skin', 'dark').toLowerCase() === 'light' ? 'light' : 'dark'
}

function colors(model: StorefrontRenderModel, skin: 'light' | 'dark') {
  const dark = skin === 'dark'
  return {
    primary: model.brand_colors?.primary || (dark ? '#e0e0e0' : '#111111'),
    accent: model.brand_colors?.accent || '#5f5f5f',
    background: model.brand_colors?.background || (dark ? '#111111' : '#ffffff'),
    text: model.brand_colors?.text || (dark ? '#e0e0e0' : '#111111'),
    muted: dark ? 'rgba(224,224,224,0.72)' : 'rgba(17,17,17,0.65)',
    line: dark ? 'rgba(119,119,119,0.28)' : 'rgba(17,17,17,0.12)',
    panel: dark ? '#111111' : '#ffffff',
    menuBg: dark ? '#ffffff' : '#111111',
    menuFg: dark ? '#5f5f5f' : '#e0e0e0',
    dash: dark ? '#5f5f5f' : '#111111',
    skin,
  }
}

/** Oneex lines effect: subtle vertical grid over content sections (not hero) */
function LinesEffect({ color, enabled }: { color: string; enabled: boolean }) {
  const reduce = useReducedMotion()
  if (!enabled) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <div className="flex h-full w-full">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="relative h-full w-1/4 border-r" style={{ borderColor: color }}>
            {i === 0 && !reduce ? (
              <span
                className="oneex-rain absolute right-[-1.5px] top-0 w-[3px]"
                style={{
                  height: '28%',
                  background: `linear-gradient(to bottom, transparent, ${color})`,
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes oneex-rain { 0% { transform: translateY(-120%); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(320%); opacity: 0; } }
        .oneex-rain { animation: oneex-rain 6s ease-out infinite; }
      `}</style>
    </div>
  )
}

function SectionHead({
  kicker,
  title,
  text,
}: {
  kicker: string
  title: string
  text: string
}) {
  return (
    <div className="mb-8">
      <h2
        className="relative mb-3 inline-block text-[13px] font-bold uppercase tracking-wide sm:text-[15px]"
        style={{ fontFamily: 'Oswald, sans-serif', color: text }}
      >
        <span>{kicker}</span>
        <span className="absolute -bottom-1 left-0 h-px w-full" style={{ background: text }} />
      </h2>
      <div
        className="text-[35px] font-bold uppercase leading-none tracking-tight sm:text-[50px] lg:text-[60px]"
        style={{ fontFamily: 'Oswald, sans-serif', color: text, letterSpacing: '-0.04em' }}
      >
        {title}
      </div>
    </div>
  )
}

function Shell({ model, skin, children }: { model: StorefrontRenderModel; skin: 'light' | 'dark'; children: ReactNode }) {
  const c = colors(model, skin)
  useEffect(() => {
    const id = 'oneex-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Raleway:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap'
    document.head.appendChild(link)
  }, [])
  return (
    <div
      className="relative min-h-screen antialiased"
      style={{ background: c.background, color: c.text, fontFamily: 'Raleway, system-ui, sans-serif' }}
    >
      {model.preview ? (
        <div className="relative z-[80] bg-amber-100 px-3 py-1.5 text-center text-[12px] text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function LandingOneex({ model }: { model: StorefrontRenderModel }) {
  const content = theme(model)
  const skin = skinOf(content)
  const c = colors(model, skin)
  const brand = model.title?.trim() || 'Oneex'
  const linesOn = slotText(content, 'lines_effect', 'on').toLowerCase() !== 'off'
  const [menuOpen, setMenuOpen] = useState(false)
  const [workFocus, setWorkFocus] = useState<number | null>(null)
  const [testimonialIdx, setTestimonialIdx] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState('')

  const navDefault =
    'Home | #home\nAbout | #about\nSkills | #skills\nServices | #services\nWorks | #works\nNews | #news\nContact | #contact'
  const nav = coerceNavForTemplate(
    parseNav(slotText(content, 'nav_links', navDefault)),
    parseNav(navDefault),
    ['home', 'about', 'skills', 'services', 'works', 'news', 'contact'],
  )
  const socials = parseSocialLinks(
    slotText(
      content,
      'social_links',
      'Twitter | https://twitter.com\nFacebook | https://facebook.com\nYoutube | https://youtube.com\nInstagram | https://instagram.com',
    ),
  )

  const heroImage = withDemoImage(model, typeof content.hero_image === 'string' ? content.hero_image : undefined, ONEEX_DEMO.hero)
  const heroVideoUrl = slotText(content, 'hero_video_url', '')
  const heroKicker = slotText(content, 'hero_kicker', "Ex Nihilo's")
  const heroHeadline = slotText(content, 'hero_headline', 'Oneex')
  const heroBody = slotText(content, 'hero_body', 'Live demos')
  const heroCta = slotText(content, 'hero_cta', 'Live demos')

  const aboutKicker = slotText(content, 'about_kicker', 'Johnny Oneex')
  const aboutTitle = slotText(content, 'about_title', 'The Artist')
  const aboutBody = slotText(
    content,
    'about_body',
    "Hi, my name is Johnny Oneex and I'm a Los Angeles-based photographer. I craft visual stories for brands and people who care about atmosphere — clarity, mood, and craft first.",
  )
  const aboutCta = slotText(content, 'about_cta', 'See my works')
  const aboutImage = withDemoImage(model, typeof content.about_image === 'string' ? content.about_image : undefined, ONEEX_DEMO.about)

  const skillsKicker = slotText(content, 'skills_kicker', 'List of')
  const skillsTitle = slotText(content, 'skills_title', 'Languages')
  const skills = parsePairs(
    slotText(content, 'skills_items', 'English | 95\nPhotography | 92\nRetouching | 88\nArt direction | 84'),
  )
    .map((s) => ({ name: s.name, value: Number.parseInt(s.detail, 10) || 0 }))
    .slice(0, 6)

  const servicesKicker = slotText(content, 'services_kicker', 'Shooting')
  const servicesTitle = slotText(content, 'services_title', 'What I offer')
  const services = parsePairs(
    slotText(
      content,
      'services_items',
      'Portraits | Editorial and personal sessions with natural light focus.\nCampaigns | Still packages for launches and lookbooks.\nArt direction | Moodboards, set design, shoot supervision.\nRetouch | Consistent color and polish for print and web.',
    ),
  ).slice(0, 4)

  const factsKicker = slotText(content, 'facts_kicker', 'Numbers')
  const factsTitle = slotText(content, 'facts_title', 'Facts & figures')
  const facts = parsePairs(slotText(content, 'facts_items', '120+|Projects\n40+|Clients\n8|Years\n12|Awards')).slice(0, 4)

  const testimonialsKicker = slotText(content, 'testimonials_kicker', 'Clients')
  const testimonialsTitle = slotText(content, 'testimonials_title', 'Kind words')
  const testimonials = parseTestimonials(
    slotText(
      content,
      'testimonials',
      'Maya Chen | Creative director | Oneex captured our campaign mood perfectly — fast, precise, unforgettable frames.\nJonah Reed | Founder | A true partner on set. Direction and delivery exceeded every brief.',
    ),
  )

  const worksKicker = slotText(content, 'works_kicker', "What I've done thus far")
  const worksTitle = slotText(content, 'works_title', 'The Works')
  const workItems = parsePairs(
    slotText(
      content,
      'works_items',
      'Noir Editorial | Fashion\nCoastal Light | Lifestyle\nAtlas Brand | Campaign\nStudio Portraits | People\nMotion Reel | Film\nCity Pulse | Street',
    ),
  ).slice(0, 6)
  const workPhotos = withDemoFallback(model, gallery(content, 'works_gallery'), ONEEX_DEMO.works)

  const newsKicker = slotText(content, 'news_kicker', 'Stay In The Know')
  const newsTitle = slotText(content, 'news_title', 'The News')
  const newsCta = slotText(content, 'news_cta', 'See all news')
  const allNews = useMemo(() => {
    const fromModel = newsItemsFromModel(model.news)
    const demoNews: LandingNewsItem[] = [
      {
        id: 'demo-1',
        title: 'On location: coastal light',
        excerpt: 'Notes from a dawn session and how soft haze shaped the frames.',
        image: ONEEX_DEMO.news[0],
        tags: 'Process',
        body: '',
      },
      {
        id: 'demo-2',
        title: 'Building a circular card',
        excerpt: 'Why a virtual business card still needs strong hierarchy.',
        image: ONEEX_DEMO.news[1],
        tags: 'Design',
        body: '',
      },
      {
        id: 'demo-3',
        title: 'Grading for mood',
        excerpt: 'A short look at contrast and skin tones for campaign stills.',
        image: ONEEX_DEMO.news[2],
        tags: 'Color',
        body: '',
      },
    ]
    return withDemoFallback(
      model,
      fromModel.map((n, i) => ({
        ...n,
        image: withDemoImage(model, n.image, ONEEX_DEMO.news[i % ONEEX_DEMO.news.length]),
      })),
      demoNews,
    )
  }, [model])
  const news = allNews.slice(0, 3)
  const newsNav = useLandingNewsNav(allNews)

  const contactKicker = slotText(content, 'contact_kicker', 'Get in touch')
  const contactTitle = slotText(content, 'contact_title', "Let's Talk")
  const contactBody = slotText(
    content,
    'contact_body',
    'Have an idea or a project in mind? By all means, please feel free to send a message.',
  )
  const contactCta = slotText(content, 'contact_form_cta', 'Send message')
  const footerCopy = slotText(content, 'footer_copy', 'Oneex © All Rights Reserved.')

  useEffect(() => {
    if (testimonials.length < 2) return
    const t = window.setInterval(() => setTestimonialIdx((i) => (i + 1) % testimonials.length), 5200)
    return () => window.clearInterval(t)
  }, [testimonials.length])

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

  function go(href: string) {
    setMenuOpen(false)
    newsNav.goSection(href)
  }

  if (newsNav.view === 'detail' && newsNav.selected) {
    return (
      <Shell model={model} skin={skin}>
        <LandingNewsDetail
          item={newsNav.selected}
          onBack={newsNav.backFromDetail}
          primary={c.text}
          muted={c.muted}
          preview={model.preview}
          fontHeading="Oswald, sans-serif"
          brand={brand}
        />
      </Shell>
    )
  }

  if (newsNav.view === 'list') {
    return (
      <Shell model={model} skin={skin}>
        <LandingNewsPage
          items={allNews}
          onSelect={(item) => newsNav.openDetail(item, true)}
          onBack={newsNav.backFromList}
          primary={c.text}
          muted={c.muted}
          preview={model.preview}
          fontHeading="Oswald, sans-serif"
          brand={brand}
          kicker={newsKicker}
          title={newsTitle}
        />
      </Shell>
    )
  }

  return (
    <Shell model={model} skin={skin}>
      {/* Header — marketing style: logo + horizontal nav */}
      <header className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 sm:px-10 sm:py-7">
        <a
          href="#home"
          className="text-[20px] font-bold uppercase tracking-tight text-white sm:text-[24px]"
          style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '-0.04em' }}
          onClick={(e) => {
            e.preventDefault()
            go('#home')
          }}
        >
          {brand.slice(0, 2).toUpperCase()}
        </a>

        <nav className="hidden items-center gap-5 md:flex lg:gap-7">
          {nav.map((n) => (
            <button
              key={n.href}
              type="button"
              className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/90 transition hover:text-white lg:text-[11px]"
              onClick={() => go(n.href)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          aria-label="Menu"
          className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
        >
          Menu
        </button>
      </header>

      {/* Mobile nav */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.nav
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute right-6 top-6 text-[11px] uppercase tracking-[0.2em] text-white"
              onClick={() => setMenuOpen(false)}
            >
              Close
            </button>
            <ul className="space-y-4 text-center">
              {nav.map((n) => (
                <li key={n.href}>
                  <button
                    type="button"
                    className="text-[28px] font-bold uppercase tracking-tight text-white sm:text-[40px]"
                    style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '-0.04em' }}
                    onClick={() => go(n.href)}
                  >
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </motion.nav>
        ) : null}
      </AnimatePresence>

      {/* HOME — full-bleed rectangular banner (like marketing page) */}
      <section id="home" className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/55" />

        <HeroEnter className="relative z-10 px-6 text-center text-white">
          <div className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/90 sm:text-[12px]">
            {heroKicker}
          </div>
          <h1
            className="mt-3 text-[64px] font-bold uppercase leading-[0.9] sm:text-[96px] lg:text-[128px]"
            style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '-0.04em' }}
          >
            {heroHeadline.replace(/\n/g, ' ')}
          </h1>
          <div className="mt-8 flex items-center justify-center gap-4">
            <span className="h-px w-10 bg-white/80 sm:w-14" />
            <a
              href="#works"
              className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white sm:text-[12px]"
              onClick={(e) => {
                e.preventDefault()
                go('#works')
              }}
            >
              {heroCta || heroBody}
            </a>
            <span className="h-px w-10 bg-white/80 sm:w-14" />
          </div>
          {heroVideoUrl ? (
            <a
              href={heroVideoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              Watch video
            </a>
          ) : null}
        </HeroEnter>

        <div className="absolute bottom-8 left-1/2 z-10 h-8 w-px -translate-x-1/2 bg-white/70" aria-hidden />
      </section>

      <div className="relative">
        <LinesEffect color={c.line} enabled={linesOn} />

      {/* ABOUT */}
      <section id="about" className="relative z-10 px-6 py-20 sm:px-12 lg:px-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHead kicker={aboutKicker} title={aboutTitle} text={c.text} />
            <p className="max-w-xl text-[14px] leading-relaxed sm:text-[15px]" style={{ color: c.muted }}>
              {aboutBody}
            </p>
            {aboutCta ? (
              <button
                type="button"
                className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                style={{ color: c.text }}
                onClick={() => go('#works')}
              >
                {aboutCta}
              </button>
            ) : null}
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative aspect-[4/5] w-full overflow-hidden">
              <img src={aboutImage} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/20" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* SKILLS */}
      <section id="skills" className="relative z-10 px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <SectionHead kicker={skillsKicker} title={skillsTitle} text={c.text} />
          </Reveal>
          <div className="space-y-6">
            {skills.map((s) => (
              <Reveal key={s.name}>
                <div className="mb-1.5 flex justify-between text-[12px] font-semibold uppercase tracking-wide">
                  <span>{s.name}</span>
                  <span>{Math.max(0, Math.min(100, s.value))}%</span>
                </div>
                <div className="h-[2px] w-full" style={{ background: c.line }}>
                  <motion.div
                    className="h-[2px]"
                    style={{ background: c.text }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${Math.max(0, Math.min(100, s.value))}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="relative z-10 px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHead kicker={servicesKicker} title={servicesTitle} text={c.text} />
          </Reveal>
          <Stagger className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <StaggerItem key={s.name}>
                <div className="text-[12px] font-bold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  0{i + 1} · {s.name.split(' ')[0]}
                </div>
                <div
                  className="mt-2 text-[28px] font-bold uppercase leading-none"
                  style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '-0.04em' }}
                >
                  {s.name}
                </div>
                <p className="mt-3 text-[13px] leading-relaxed" style={{ color: c.muted }}>
                  {s.detail}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* FACTS */}
      <section id="facts" className="relative z-10 px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <SectionHead kicker={factsKicker} title={factsTitle} text={c.text} />
          </Reveal>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-10 md:grid-cols-4">
          {facts.map((f) => (
            <ScalePop key={f.name} className="text-center">
              <div
                className="text-[42px] font-bold uppercase leading-none sm:text-[56px]"
                style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '-0.04em' }}
              >
                {f.name}
              </div>
              <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: c.muted }}>
                {f.detail}
              </div>
            </ScalePop>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="relative z-10 px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionHead kicker={testimonialsKicker} title={testimonialsTitle} text={c.text} />
          </Reveal>
        </div>
        <div className="mx-auto max-w-3xl border-t pt-12 text-center" style={{ borderColor: c.line }}>
          <AnimatePresence mode="wait">
            {testimonials[testimonialIdx] ? (
              <motion.blockquote
                key={testimonialIdx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <p className="text-[16px] leading-relaxed sm:text-[18px]" style={{ color: c.muted }}>
                  “{testimonials[testimonialIdx]!.quote}”
                </p>
                <footer className="mt-6">
                  <div className="text-[14px] font-bold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    {testimonials[testimonialIdx]!.name}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: c.muted }}>
                    {testimonials[testimonialIdx]!.role}
                  </div>
                </footer>
              </motion.blockquote>
            ) : null}
          </AnimatePresence>
        </div>
      </section>

      {/* WORKS — rectangular grid */}
      <section id="works" className="relative z-10 px-6 py-20 sm:px-12 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHead kicker={worksKicker} title={worksTitle} text={c.text} />
          </Reveal>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workItems.map((w, i) => (
              <StaggerItem key={w.name}>
                <button type="button" className="group w-full text-left" onClick={() => setWorkFocus(i)}>
                  <div className="relative aspect-[4/5] w-full overflow-hidden">
                    <img
                      src={workPhotos[i % workPhotos.length]}
                      alt=""
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/35" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                      <span className="border border-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                        View
                      </span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-[16px] font-bold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      {w.name}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: c.muted }}>
                      {w.detail}
                    </div>
                  </div>
                </button>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* NEWS */}
      {news.length > 0 ? (
      <section id="news" className="relative z-10 px-6 py-20 sm:px-12 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead kicker={newsKicker} title={newsTitle} text={c.text} />
            <button
              type="button"
              onClick={newsNav.openList}
              className="text-[13px] font-bold uppercase tracking-wider transition hover:opacity-80"
              style={{ color: c.muted }}
            >
              {newsCta} →
            </button>
          </Reveal>
          <Stagger className="grid gap-8 md:grid-cols-3">
            {news.map((item) => (
              <StaggerItem key={item.id}>
                <HoverLift>
                  <button type="button" className="w-full text-left" onClick={() => newsNav.openDetail(item)}>
                    {item.image ? (
                      <img src={item.image} alt="" className="aspect-[16/10] w-full object-cover" />
                    ) : null}
                    {item.tags ? (
                      <div className="mt-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: c.muted }}>
                        {item.tags}
                      </div>
                    ) : null}
                    <div className="mt-1 text-[20px] font-bold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      {item.title}
                    </div>
                    <p className="mt-2 line-clamp-3 text-[13px]" style={{ color: c.muted }}>
                      {item.excerpt}
                    </p>
                  </button>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
      ) : null}

      {/* CONTACT */}
      <section id="contact" className="relative z-10 px-6 py-20 sm:px-12 lg:px-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHead kicker={contactKicker} title={contactTitle} text={c.text} />
            <p className="mb-6 max-w-md text-[14px] leading-relaxed" style={{ color: c.muted }}>
              {contactBody}
            </p>
            <div className="space-y-2 text-[13px]" style={{ color: c.muted }}>
              {model.contact_email ? <div>{model.contact_email}</div> : null}
              {model.contact_phone ? <div>{model.contact_phone}</div> : null}
              {model.contact_address ? <div className="whitespace-pre-line">{model.contact_address}</div> : null}
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold uppercase tracking-[0.14em] hover:opacity-70"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            {sent ? (
              <div className="text-[14px]" style={{ color: c.text }}>
                Thanks — your message was sent.
              </div>
            ) : (
              <form onSubmit={onContact} className="space-y-3">
                <input name="sf_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <input
                  required
                  name="name"
                  placeholder="Name"
                  className="w-full border-0 border-b bg-transparent px-0 py-3 text-[13px] outline-none"
                  style={{ borderColor: c.line, color: c.text }}
                />
                <input
                  required
                  name="email"
                  type="email"
                  placeholder="Email"
                  className="w-full border-0 border-b bg-transparent px-0 py-3 text-[13px] outline-none"
                  style={{ borderColor: c.line, color: c.text }}
                />
                <textarea
                  required
                  name="message"
                  rows={4}
                  placeholder="Message"
                  className="w-full border-0 border-b bg-transparent px-0 py-3 text-[13px] outline-none"
                  style={{ borderColor: c.line, color: c.text }}
                />
                {formError ? <div className="text-[12px] text-red-500">{formError}</div> : null}
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-4 border-2 border-dashed px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] disabled:opacity-60"
                  style={{ borderColor: c.dash, color: c.text }}
                >
                  {sending ? 'Sending…' : contactCta}
                </button>
              </form>
            )}
          </Reveal>
        </div>
        <div className="mx-auto mt-16 max-w-6xl text-[10px] font-bold uppercase tracking-wider opacity-50">{footerCopy}</div>
      </section>
      </div>

      {/* Work lightbox */}
      <AnimatePresence>
        {workFocus != null && workItems[workFocus] ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWorkFocus(null)}
          >
            <motion.div
              className="relative max-h-[88vh] w-full max-w-4xl"
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={workPhotos[workFocus % workPhotos.length]}
                alt=""
                className="max-h-[80vh] w-full object-contain"
              />
              <div className="mt-3 text-center text-white">
                <div className="text-[20px] font-bold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  {workItems[workFocus]!.name}
                </div>
                <div className="text-[12px] uppercase tracking-wider opacity-70">{workItems[workFocus]!.detail}</div>
              </div>
              <button
                type="button"
                className="absolute right-0 top-0 px-3 py-1 text-[11px] uppercase tracking-wider text-white"
                onClick={() => setWorkFocus(null)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Shell>
  )
}
