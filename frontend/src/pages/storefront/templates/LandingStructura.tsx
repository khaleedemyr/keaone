import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import type { StorefrontRenderModel } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { parseFooterLinks, readFooterColumn } from '../lib/footerLinks'
import { inquiryErrorMessage, inquiryFromForm, submitStorefrontInquiry } from '../lib/submitStorefrontInquiry'
import { onStorefrontNavClick, coerceNavForTemplate, storefrontFixed } from './storefrontNav'
import { parseSocialLinks } from './LandingNewsDetail'
import { STRUCTURA_DEMO } from './structuraDemo'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import { HeroEnter, HoverLift, Parallax, Reveal, Stagger, StaggerItem, Tilt3D } from './storefrontMotion'

/**
 * Structura square — https://templates.framework-y.com/structura/pages/index-square.html
 *
 * Measured from skin.css + HTWF:
 * - Fixed left vertical menu (menu-inner-side): centered vertically, bar markers, links at left:50px
 * - text-xxl ≈ 72–110px Questrial (font-1); text-xl ≈ 50px Nunito 900
 * - body Questrial 16/28, color #4C4C4C; ink #272727; mute #8a8a8a
 * - background-lines body pattern; square buttons; asymmetric col-md-4 grids
 * - Google map via lat/lng (default 40.741895, -73.989308)
 */

const S = {
  content: 'mx-auto w-full max-w-[1170px] px-[15px] sm:px-[30px]',
  ink: '#272727',
  mute: '#8a8a8a',
  body: '#4C4C4C',
  padY: 'py-[50px] sm:py-[80px]',
} as const

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return { primary: S.ink, accent: S.mute, background: '#ffffff', text: S.ink }
  }
  return {
    primary: model.brand_colors.primary || S.ink,
    accent: model.brand_colors.accent || S.mute,
    background: model.brand_colors.background || '#ffffff',
    text: model.brand_colors.text || S.ink,
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
      return { name: (name || '').trim(), role: rest.join('|').trim() }
    })
    .filter((p) => p.name)
}

function parsePriceRows(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim())
      return {
        no: parts[0] || '',
        service: parts[1] || '',
        description: parts[2] || '',
        price: parts[3] || '',
      }
    })
    .filter((r) => r.service)
}

function lines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function gallery(content: Record<string, unknown>, key: string): string[] {
  const value = content[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v) : []
}

function parseCoord(raw: string, fallback: number) {
  const n = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function mapEmbedUrl(lat: number, lng: number, zoom: number) {
  const z = Math.min(18, Math.max(1, Math.round(zoom)))
  const delta = 0.02 / Math.max(1, z / 10)
  const minLng = lng - delta
  const minLat = lat - delta
  const maxLng = lng + delta
  const maxLat = lat + delta
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`
}

function LinesPattern({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 opacity-40 ${className}`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(90deg, transparent 0, transparent 47px, rgba(39,39,39,0.05) 47px, rgba(39,39,39,0.05) 48px)',
      }}
    />
  )
}

function DotsPattern({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 opacity-50 ${className}`}
      style={{
        backgroundImage: 'radial-gradient(rgba(39,39,39,0.14) 1px, transparent 1px)',
        backgroundSize: '8px 8px',
      }}
    />
  )
}

function BorderBtn({ href, children, color = S.ink }: { href: string; children: ReactNode; color?: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center border px-[30px] py-[10px] text-[14px] font-semibold tracking-[0.5px] transition hover:opacity-75"
      style={{ borderColor: color, color, fontFamily: 'Nunito, sans-serif' }}
    >
      {children}
    </a>
  )
}

function SolidBtn({
  href,
  children,
  color = S.ink,
  type = 'button',
  disabled = false,
}: {
  href?: string
  children: ReactNode
  color?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const cls =
    'inline-flex items-center justify-center px-[30px] py-[10px] text-[14px] font-semibold tracking-[0.5px] text-white transition hover:opacity-90 disabled:opacity-60'
  const style = { background: color, fontFamily: 'Nunito, sans-serif' as const }
  if (href) {
    return (
      <a href={href} className={cls} style={style}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} className={cls} style={style} disabled={disabled}>
      {children}
    </button>
  )
}

/** Fixed left vertical side menu — mirrors menu-inner-side.scroll-css */
function SideMenu({
  items,
  active,
  color,
  preview,
}: {
  items: { label: string; href: string }[]
  active: string
  color: string
  preview?: boolean
}) {
  const [open, setOpen] = useState(false)
  const pin = storefrontFixed(preview)
  return (
    <>
      <button
        type="button"
        className={`${pin} left-4 top-4 z-40 flex items-center gap-2 border border-black/10 bg-white/95 px-3 py-2 text-[12px] font-semibold shadow-sm lg:hidden`}
        style={{ color, fontFamily: 'Nunito, sans-serif' }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span aria-hidden>☰</span> Menu
      </button>

      <nav
        aria-label="Page sections"
        className={`${pin} left-0 top-1/2 z-40 hidden -translate-y-1/2 lg:block ${open ? '!block top-16 translate-y-0' : ''}`}
      >
        <ul className="relative m-0 list-none p-0">
          {items.map((item) => {
            const isActive = active === item.href || (active === '' && item.href === '#home')
            return (
              <li key={item.href} className="relative h-[30px]">
                <a
                  href={item.href}
                  onClick={(e) => {
                    onStorefrontNavClick(e, item.href, () => setOpen(false))
                  }}
                  className="absolute left-[50px] whitespace-nowrap text-[14px] font-semibold tracking-[0.5px] transition"
                  style={{
                    color: isActive ? color : S.mute,
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute bottom-[10px] block h-[2px] transition-all"
                    style={{
                      left: '-50px',
                      width: isActive ? 40 : 18,
                      background: color,
                    }}
                  />
                  {item.label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      {open ? (
        <div className={`${pin} inset-0 z-30 bg-black/20 lg:hidden`} onClick={() => setOpen(false)} />
      ) : null}
      {open ? (
        <div className={`${pin} left-0 top-14 z-40 w-56 border-r border-black/10 bg-white p-5 shadow-lg lg:hidden`}>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={(e) => {
                    onStorefrontNavClick(e, item.href, () => setOpen(false))
                  }}
                  className="block text-[14px] font-semibold"
                  style={{ color, fontFamily: 'Nunito, sans-serif' }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}

function Shell({ model, children }: { model: StorefrontRenderModel; children: ReactNode }) {
  const c = colors(model)
  useEffect(() => {
    const id = 'structura-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Questrial&display=swap'
    document.head.appendChild(link)
  }, [])
  return (
    <div
      className="relative min-h-screen antialiased"
      style={{
        background: c.background,
        color: S.body,
        fontFamily: 'Questrial, system-ui, sans-serif',
        fontSize: 16,
        lineHeight: '28px',
      }}
    >
      <LinesPattern className={`${storefrontFixed(model.preview)} inset-0 z-0`} />
      {model.preview ? (
        <div className="sticky top-0 z-50 border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}

export function LandingStructura({ model }: { model: StorefrontRenderModel }) {
  const content = theme(model)
  const c = colors(model)
  const primary = c.primary || S.ink
  const brand = model.title || 'Structura'
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')
  const [active, setActive] = useState('#home')
  const [filter, setFilter] = useState('All')

  const navDefault =
    'Home | #home\nServices | #services\nSkills | #skills\nTeam | #team\nPortfolio | #portfolio\nContacts | #contacts'
  const navParsed = parseFooterLinks(slotText(content, 'nav_links', navDefault))
    .filter((l): l is { label: string; href: string } => typeof l.href === 'string' && !!l.href)
    .slice(0, 8)
  const navFallback = parseFooterLinks(navDefault)
    .filter((l): l is { label: string; href: string } => typeof l.href === 'string' && !!l.href)
    .slice(0, 8)
  const navItems = coerceNavForTemplate(navParsed, navFallback, [
    'home',
    'services',
    'skills',
    'team',
    'portfolio',
    'contacts',
  ])

  const navKey = navItems.map((n) => n.href).join('|')

  useEffect(() => {
    const ids = navKey.split('|').map((h) => h.replace(/^#/, '')).filter(Boolean)
    const onScroll = () => {
      let current = '#home'
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 180) current = `#${id}`
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [navKey])

  const heroImage = withDemoImage(model, typeof content.hero_image === 'string' ? content.hero_image : undefined, STRUCTURA_DEMO.hero)
  const heroHeadline = slotText(content, 'hero_headline', 'Do things that matter')
  const heroBody = slotText(
    content,
    'hero_body',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore et dolore magna aliqua. Utenim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariature.',
  )
  const heroCta = slotText(content, 'hero_cta', 'Get promotions')
  const heroSubHeadline = slotText(content, 'hero_sub_headline', 'Start think\ndifferent')
  const heroSubBody1 = slotText(
    content,
    'hero_sub_body_1',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore et dolore magna aliqua. Utenim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
  )
  const heroSubBody2 = slotText(
    content,
    'hero_sub_body_2',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore et dolore magna aliqua. Utenim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate.',
  )
  const heroSubCta = slotText(content, 'hero_sub_cta', 'Explore now')

  const stripImgs = withDemoFallback(model, gallery(content, 'strip_gallery'), STRUCTURA_DEMO.strip)

  const servicesImage = withDemoImage(
    model,
    typeof content.services_image === 'string' ? content.services_image : undefined,
    STRUCTURA_DEMO.services,
  )
  const servicesTitle = slotText(content, 'services_title', 'Services ready for you')
  const servicesIntro = slotText(
    content,
    'services_intro',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed exercia atation ullamco laboris eiusmod tempor incididunt utlabore et dolore magna aliqunisi aboris nisi ut aliquipo.',
  )
  const service1Title = slotText(content, 'service_1_title', 'Hard work')
  const service1Body = slotText(content, 'service_1_body', 'Lorem ipsum dolore exercia atation ullamco labori')
  const service2Title = slotText(content, 'service_2_title', 'Passion')
  const service2Body = slotText(
    content,
    'service_2_body',
    'Arnila ipsume exercia atation ullamco labori marcio coloso',
  )
  const servicesCta = slotText(content, 'services_cta', 'See all services')
  const servicesOutro = slotText(
    content,
    'services_outro',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed exercia atation ullamco laboris eiusmod tempor incididunt utlabore et dolore magna labiro artono nisi ut aliquip exeao commodo. Aipsum dolor sit amet consectetur adipiscing elitsed exercia atation ullamco.',
  )
  const priceRows = parsePriceRows(
    slotText(
      content,
      'price_table',
      '1 | Travel tips | Lorem ipsumo | $60\n2 | Freelancing | Lorem consecte | $20\n3 | Ensurance | Ariele artosio | $50\n4 | Investments | Perio maestro | $20\n5 | Networking | Rebecco ipsum | $20',
    ),
  )

  const skillsTitle = slotText(content, 'skills_title', 'Skills')
  const skillsSubtitle = slotText(content, 'skills_subtitle', 'What we do, we are to do well or not at all.')
  const skillCols = [
    {
      title: slotText(content, 'skill_1_title', 'Web'),
      items: lines(
        slotText(
          content,
          'skill_1_body',
          'Wordpress Theme Development\nPHP/MySQL\nSASS/LESS\nBower, Composer, Gulp, Grunt\nLaravel\nAngular',
        ),
      ),
    },
    {
      title: slotText(content, 'skill_2_title', 'Design & Print'),
      items: lines(
        slotText(
          content,
          'skill_2_body',
          'UX/UI Design\nPhotoshop\nIllustrator\nBrand Collateral\nLabel/Packaging\nTraditional arts',
        ),
      ),
    },
    {
      title: slotText(content, 'skill_3_title', 'Misc'),
      items: lines(
        slotText(
          content,
          'skill_3_body',
          'Drawing\nMaking sandwiches\nProblem Solving\nUnsolicited Criticism (Receiving and Giving)\nComplicating my own life\nTalk to the strangers',
        ),
      ),
    },
  ]

  const logosBg = withDemoImage(model, typeof content.logos_image === 'string' ? content.logos_image : undefined, STRUCTURA_DEMO.logosBg)
  const logos = withDemoFallback(model, gallery(content, 'logos_gallery'), STRUCTURA_DEMO.strip.slice(0, 5))

  const teamTitle = slotText(content, 'team_title', 'Amazing team')
  const teamCta = slotText(content, 'team_cta', 'All members')
  const teamJoin = slotText(content, 'team_join_title', 'Join the team')
  const teamMembers = parsePairs(
    slotText(
      content,
      'team_members',
      'Malissa Rodrigue | Sed do eiusmod tempor incididunt ut labore\nJessica Swarosky | Sed do eiusmod tempor incididunt ut labore',
    ),
  ).slice(0, 2)
  const teamPhotos = withDemoFallback(model, gallery(content, 'team_gallery'), STRUCTURA_DEMO.team)

  const portfolioTitle = slotText(content, 'portfolio_title', 'Portfolio')
  const portfolioBody = slotText(
    content,
    'portfolio_body',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore et dolore magna aliqua. Utenim ad minim veniam quis nostrud exercitation ullamco.',
  )
  const portfolioCta = slotText(content, 'portfolio_cta', 'All projects')
  const portfolioItems = parsePairs(
    slotText(
      content,
      'portfolio_items',
      'Retro artisans | Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempo.\nPerformance lights | Interdum iusto pulvinar consequuntur augue optio, repellat fuga! Purus expedita fusco.\nThe lighting start | Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugia.\nSecret decors | Interdum iusto pulvinar consequuntur augue optio, repellat fuga! Purus expedita fusco.\nQueens and hourses | Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugia.\nOld fashion celebration | Interdum iusto pulvinar consequuntur augue optio, repellat fuga! Purus expedita fusco.',
    ),
  ).slice(0, 6)
  const portfolioPhotos = withDemoFallback(model, gallery(content, 'portfolio_gallery'), STRUCTURA_DEMO.portfolio)
  const filters = lines(slotText(content, 'portfolio_filters', 'All\nArts\nUrban\nCreative'))
  const defaultFilter = filters[0] || 'All'
  const activeFilter = filters.includes(filter) ? filter : defaultFilter
  const filteredPortfolio =
    activeFilter === defaultFilter
      ? portfolioItems
      : portfolioItems.filter((_, i) => {
          const cats = filters.slice(1)
          return cats.length === 0 || cats[i % cats.length] === activeFilter
        })

  const mapLat = parseCoord(slotText(content, 'map_lat', '40.741895'), 40.741895)
  const mapLng = parseCoord(slotText(content, 'map_lng', '-73.989308'), -73.989308)
  const mapZoom = parseCoord(slotText(content, 'map_zoom', '14'), 14)

  const contactTitle = slotText(content, 'contact_title', "We're friendly & lovely pets")
  const contactFormCta = slotText(content, 'contact_form_cta', 'Send messagge')
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Navigasi',
    links: 'About | #home\nServices | #services\nSupport | #skills\nContacts | #contacts',
  })
  const footerCopy = slotText(content, 'footer_copy', '© Structura — One page minimal template')
  const socialLinks = parseSocialLinks(
    slotText(
      content,
      'social_links',
      'Facebook | https://facebook.com\nTwitter | https://twitter.com\nInstagram | https://instagram.com',
    ),
  )

  const address = model.contact_address || 'Sturlly, PO 16122, Collins Street West'
  const phone = model.contact_phone || '(123) 0 123 455669'
  const email = model.contact_email || 'example@company.com'

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
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

  return (
    <Shell model={model}>
      <SideMenu items={navItems} active={active} color={primary} preview={model.preview} />

      {/* HOME — parallax bg + asymmetric hero */}
      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Parallax offset={100} className="absolute inset-0">
            <img src={heroImage} alt="" className="h-[115%] w-full object-cover" />
          </Parallax>
          <div className="absolute inset-0 bg-white/86" />
          <LinesPattern />
        </div>
        <div className={`relative ${S.content} ${S.padY} pl-[15px] lg:pl-[140px]`}>
          {/* Row 1: headline | body+cta | empty */}
          <div className="grid gap-10 md:grid-cols-12 md:gap-0">
            <HeroEnter className="md:col-span-4 md:px-[30px]">
              <h1
                className="text-[42px] leading-[1.05] tracking-tight sm:text-[56px] lg:text-[72px] lg:leading-[80px] xl:text-[90px] xl:leading-[95px]"
                style={{ fontFamily: 'Questrial, sans-serif', color: primary, fontWeight: 400 }}
              >
                {heroHeadline}
              </h1>
            </HeroEnter>
            <HeroEnter delay={0.12} className="md:col-span-4 md:px-[30px]">
              <p className="text-[16px] leading-[28px]" style={{ color: S.mute }}>
                {heroBody}
              </p>
              <div className="mt-[50px]">
                <BorderBtn href="#services" color={primary}>
                  {heroCta}
                </BorderBtn>
              </div>
            </HeroEnter>
            <div className="hidden md:col-span-4 md:block" />
          </div>

          {/* Spacer like hr.space */}
          <div className="h-[80px] sm:h-[120px]" />

          {/* Row 2: subheadline spanning 8 cols */}
          <div className="grid gap-8 md:grid-cols-12">
            <HeroEnter delay={0.22} className="md:col-span-8 md:px-[30px]">
              <h2
                className="whitespace-pre-line text-[36px] font-black leading-[1.1] sm:text-[44px] lg:text-[50px] lg:leading-[50px]"
                style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
              >
                {heroSubHeadline}
              </h2>
              <div className="mt-[50px] grid gap-8 sm:grid-cols-2">
                <p className="text-[14px] leading-[26px]" style={{ color: S.mute }}>
                  {heroSubBody1}
                </p>
                <p className="text-[14px] leading-[26px]" style={{ color: S.mute }}>
                  {heroSubBody2}
                </p>
              </div>
              <div className="mt-[50px]">
                <BorderBtn href="#portfolio" color={primary}>
                  {heroSubCta}
                </BorderBtn>
              </div>
            </HeroEnter>
            <div className="hidden md:col-span-4 md:block" />
          </div>
        </div>
      </section>

      {/* GALLERY STRIP — square images with black offset shadow vibe */}
      <section className="relative bg-white py-10 sm:py-14">
        <div className={`${S.content} pl-[15px] lg:pl-[140px]`}>
          <Stagger className="flex gap-[30px] overflow-x-auto pb-4 [scrollbar-width:thin]" stagger={0.06}>
            {stripImgs.slice(0, 6).map((src, i) => (
              <StaggerItem key={`${src}-${i}`} className="shrink-0">
                <HoverLift className="relative aspect-square w-[180px] sm:w-[220px]">
                  <div className="h-full w-full" style={{ boxShadow: `12px 18px 0 ${primary}` }}>
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </div>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={servicesImage} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-white/90" />
          <LinesPattern />
        </div>
        <div className={`relative ${S.content} ${S.padY} pl-[15px] lg:pl-[140px]`}>
          <Reveal>
            <div className="grid gap-8 md:grid-cols-12">
              <div className="hidden md:col-span-4 md:block" />
              <div className="md:col-span-4 md:px-[30px]">
                <h2
                  className="text-[36px] font-black leading-tight sm:text-[44px] lg:text-[50px]"
                  style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
                >
                  {servicesTitle}
                </h2>
              </div>
              <div className="md:col-span-4 md:px-[30px]">
                <p style={{ color: S.mute }}>{servicesIntro}</p>
              </div>
            </div>
          </Reveal>

          <div className="mt-[80px] grid items-end gap-6 md:grid-cols-12">
            <div className="hidden md:col-span-4 md:block" />
            <Tilt3D className="relative bg-white p-10 md:col-span-4" maxTilt={14}>
              <DotsPattern />
              <Stagger className="relative space-y-10" stagger={0.1}>
                {[
                  { title: service1Title, body: service1Body },
                  { title: service2Title, body: service2Body },
                ].map((item) => (
                  <StaggerItem key={item.title}>
                    <div className="flex gap-4">
                      <div
                        className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center text-lg"
                        style={{ color: primary, border: `1px solid ${primary}` }}
                      >
                        ✦
                      </div>
                      <div>
                        <div
                          className="text-[17px] font-bold"
                          style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
                        >
                          {item.title}
                        </div>
                        <p className="mt-1 text-[14px] leading-[24px]" style={{ color: S.mute }}>
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            </Tilt3D>
            <Reveal delay={0.1} className="flex md:col-span-4 md:items-end md:px-[30px] md:pb-2">
              <SolidBtn href="#portfolio" color={primary}>
                {servicesCta}
              </SolidBtn>
            </Reveal>
          </div>

          <Reveal delay={0.08}>
            <div className="mt-[80px] grid gap-8 md:grid-cols-12">
              <div className="hidden md:col-span-4 md:block" />
              <div className="md:col-span-4 md:px-[30px]">
                <p style={{ color: S.mute }}>{servicesOutro}</p>
              </div>
              <div className="md:col-span-4 md:px-[30px]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[280px] text-left text-[14px]">
                    <thead>
                      <tr className="border-b" style={{ borderColor: primary }}>
                        <th className="py-2 pr-3 font-semibold" style={{ color: primary }}>
                          #
                        </th>
                        <th className="py-2 pr-3 font-semibold" style={{ color: primary }}>
                          Service
                        </th>
                        <th className="py-2 pr-3 font-semibold" style={{ color: primary }}>
                          Description
                        </th>
                        <th className="py-2 font-semibold" style={{ color: primary }}>
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody style={{ color: S.mute }}>
                      {priceRows.map((row) => (
                        <tr key={`${row.no}-${row.service}`} className="border-b border-black/5">
                          <th className="py-2.5 pr-3 font-semibold" style={{ color: primary }}>
                            {row.no}
                          </th>
                          <td className="py-2.5 pr-3">{row.service}</td>
                          <td className="py-2.5 pr-3">{row.description}</td>
                          <td className="py-2.5">{row.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SKILLS */}
      <section id="skills" className="relative bg-white">
        <LinesPattern />
        <div className={`relative ${S.content} ${S.padY} pl-[15px] lg:pl-[140px]`}>
          <Reveal>
            <h2
              className="text-center text-[36px] font-black sm:text-[44px] lg:text-[50px]"
              style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
            >
              {skillsTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center" style={{ color: S.mute }}>
              {skillsSubtitle}
            </p>
          </Reveal>
          <Stagger className="mt-[80px] grid gap-12 sm:grid-cols-3" stagger={0.1}>
            {skillCols.map((col) => (
              <StaggerItem key={col.title}>
                <HoverLift className="px-[10px]">
                  <h3
                    className="text-[22px] font-black"
                    style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
                  >
                    {col.title}
                  </h3>
                  <div className="mt-4 h-px w-12" style={{ background: primary }} />
                  <ul className="mt-6 space-y-1" style={{ color: S.mute }}>
                    {col.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CLIENT LOGOS */}
      <section className="relative overflow-hidden py-12 sm:py-16">
        <div className="absolute inset-0">
          <img src={logosBg} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-white/75" />
        </div>
        <div className={`relative ${S.content} pl-[15px] lg:pl-[140px]`}>
          <Stagger className="flex flex-wrap items-center justify-center gap-10 sm:gap-14" stagger={0.06}>
            {logos.slice(0, 6).map((src, i) => (
              <StaggerItem key={`${src}-${i}`}>
                <HoverLift className="h-12 w-28 opacity-60 grayscale sm:h-14 sm:w-32">
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* TEAM — circular photos */}
      <section id="team" className="relative bg-white">
        <LinesPattern />
        <div className={`relative ${S.content} ${S.padY} pl-[15px] lg:pl-[140px]`}>
          <Stagger className="grid gap-12 md:grid-cols-12 md:items-start" stagger={0.12}>
            <StaggerItem className="md:col-span-4 md:px-[30px]">
              <h2
                className="text-[36px] font-black sm:text-[44px] lg:text-[50px]"
                style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
              >
                {teamTitle}
              </h2>
              <div className="mt-10">
                <SolidBtn href="#contacts" color={primary}>
                  {teamCta}
                </SolidBtn>
              </div>
            </StaggerItem>
            <StaggerItem className="md:col-span-4 md:px-[30px]">
              {teamMembers[0] ? (
                <Tilt3D className="relative mx-auto aspect-square max-w-[300px]" maxTilt={16}>
                  <div className="group relative aspect-square overflow-hidden rounded-full">
                    <img
                      src={teamPhotos[0]}
                      alt={teamMembers[0].name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-8 text-center opacity-0 transition group-hover:opacity-100">
                      <div className="text-white">
                        <div className="text-xl font-black" style={{ fontFamily: 'Nunito, sans-serif' }}>
                          {teamMembers[0].name}
                        </div>
                        <p className="mt-2 text-sm text-white/85">{teamMembers[0].role}</p>
                      </div>
                    </div>
                  </div>
                </Tilt3D>
              ) : null}
              <h2
                className="mt-14 text-[42px] leading-[1.05] sm:text-[56px] lg:text-[72px] lg:leading-[80px]"
                style={{ fontFamily: 'Questrial, sans-serif', color: primary }}
              >
                {teamJoin}
              </h2>
            </StaggerItem>
            <StaggerItem className="md:col-span-4 md:px-[30px] md:pt-20">
              {teamMembers[1] ? (
                <Tilt3D className="relative mx-auto aspect-square max-w-[300px]" maxTilt={16}>
                  <div className="group relative aspect-square overflow-hidden rounded-full">
                    <img
                      src={teamPhotos[1]}
                      alt={teamMembers[1].name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-8 text-center opacity-0 transition group-hover:opacity-100">
                      <div className="text-white">
                        <div className="text-xl font-black" style={{ fontFamily: 'Nunito, sans-serif' }}>
                          {teamMembers[1].name}
                        </div>
                        <p className="mt-2 text-sm text-white/85">{teamMembers[1].role}</p>
                      </div>
                    </div>
                  </div>
                </Tilt3D>
              ) : null}
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* PORTFOLIO — masonry left + sidebar copy right */}
      <section id="portfolio" className="relative bg-white">
        <LinesPattern />
        <div className={`relative ${S.content} ${S.padY} pl-[15px] lg:pl-[140px]`}>
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <Reveal>
                <div
                  className="mb-8 flex flex-wrap gap-5 text-[14px] font-semibold"
                  style={{ fontFamily: 'Nunito, sans-serif' }}
                >
                  {filters.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className="transition"
                      style={{ color: activeFilter === f ? primary : S.mute }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </Reveal>
              <Stagger className="grid gap-[30px] sm:grid-cols-2" stagger={0.07}>
                {(filteredPortfolio.length ? filteredPortfolio : portfolioItems).map((item, i) => (
                  <StaggerItem key={`${item.name}-${i}`} as="article">
                    <HoverLift className="bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={portfolioPhotos[i % portfolioPhotos.length]}
                          alt={item.name}
                          className="h-full w-full object-cover transition duration-500 hover:scale-105"
                        />
                      </div>
                      <div className="p-6" style={{ background: primary }}>
                        <h3 className="text-[20px] font-black text-white" style={{ fontFamily: 'Nunito, sans-serif' }}>
                          {item.name}
                        </h3>
                        <p className="mt-2 text-[14px] leading-[24px] text-white/80">{item.role}</p>
                      </div>
                    </HoverLift>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
            <Reveal delay={0.1} className="lg:col-span-4 lg:pt-16 lg:px-[30px]">
              <h2
                className="text-[36px] font-black sm:text-[44px] lg:text-[50px]"
                style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
              >
                {portfolioTitle}
              </h2>
              <p className="mt-8" style={{ color: S.mute }}>
                {portfolioBody}
              </p>
              <div className="mt-10 space-y-4">
                <div>
                  <span
                    className="text-[50px] font-black leading-none"
                    style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
                  >
                    {slotText(content, 'portfolio_stat_1', '520')}
                  </span>
                  <span className="ml-2 text-[16px]" style={{ color: S.mute }}>
                    {slotText(content, 'portfolio_stat_1_label', 'Works')}
                  </span>
                </div>
                <div>
                  <span
                    className="text-[50px] font-black leading-none"
                    style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
                  >
                    {slotText(content, 'portfolio_stat_2', '700')}
                  </span>
                  <span className="ml-2 text-[16px]" style={{ color: S.mute }}>
                    {slotText(content, 'portfolio_stat_2_label', 'Clients')}
                  </span>
                </div>
              </div>
              <div className="mt-10">
                <SolidBtn href="#contacts" color={primary}>
                  {portfolioCta}
                </SolidBtn>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* MAP — lat/lng driven */}
      <section id="map" className="relative w-full">
        <iframe
          title="Location map"
          src={mapEmbedUrl(mapLat, mapLng, mapZoom)}
          className="block h-[280px] w-full border-0 sm:h-[360px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>

      {/* CONTACTS */}
      <section id="contacts" className="relative overflow-hidden">
        <LinesPattern />
        <div className={`relative ${S.content} ${S.padY} pl-[15px] lg:pl-[140px]`}>
          <div className="grid gap-12 lg:grid-cols-12">
            <Reveal className="lg:col-span-4 lg:px-[30px]">
              <h2
                className="text-[36px] font-black sm:text-[44px] lg:text-[50px]"
                style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
              >
                {contactTitle}
              </h2>
              <ul className="mt-10 space-y-4" style={{ color: S.mute }}>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-2 w-2 shrink-0" style={{ background: primary }} />
                  {address}
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-2 w-2 shrink-0" style={{ background: primary }} />
                  {phone}
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-2 w-2 shrink-0" style={{ background: primary }} />
                  {email}
                </li>
              </ul>
            </Reveal>
            <div className="hidden lg:col-span-2 lg:block" />
            <Reveal delay={0.12} className="lg:col-span-6 lg:px-[30px]">
              <form onSubmit={onSubmit} className="space-y-4">
                <input name="sf_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <div className="grid gap-4 sm:grid-cols-3">
                  {(['Your name', 'Email', 'Phone number'] as const).map((label) => (
                    <label key={label} className="block text-[14px]">
                      <span className="mb-2 block" style={{ color: S.mute }}>
                        {label}
                      </span>
                      <input
                        required={label !== 'Phone number'}
                        type={label === 'Email' ? 'email' : 'text'}
                        name={label === 'Your name' ? 'name' : label === 'Email' ? 'email' : 'phone'}
                        className="w-full border border-black/15 bg-transparent px-3 py-2.5 outline-none focus:border-black/40"
                      />
                    </label>
                  ))}
                </div>
                <label className="block text-[14px]">
                  <span className="mb-2 block" style={{ color: S.mute }}>
                    Your message
                  </span>
                  <textarea
                    required
                    name="message"
                    rows={5}
                    className="w-full border border-black/15 bg-transparent px-3 py-2.5 outline-none focus:border-black/40"
                  />
                </label>
                {formError ? <div className="text-[13px] text-red-600">{formError}</div> : null}
                <SolidBtn type="submit" color={primary} disabled={sending}>
                  {sending ? 'Sending…' : contactFormCta}
                </SolidBtn>
                {sent ? (
                  <div className="border border-emerald-300 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-800">
                    Congratulations. Your message has been sent successfully
                  </div>
                ) : null}
              </form>
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-black/10 bg-white py-10">
        <div className={`${S.content} pl-[15px] lg:pl-[140px]`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <FooterLinkList
              links={footerCol1.links}
              inline
              className="flex flex-wrap gap-6 text-[14px] font-semibold"
              itemClassName="hover:opacity-70"
            />
            <div className="flex gap-2">
              {socialLinks.slice(0, 4).map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target={s.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                  className="inline-flex h-9 min-w-9 items-center justify-center px-2 text-[12px] text-white transition hover:opacity-85"
                  style={{ background: primary }}
                  title={s.label}
                >
                  {s.label.slice(0, 1)}
                </a>
              ))}
            </div>
          </div>
          <div className="mt-8 text-[13px]" style={{ color: S.mute }}>
            {footerCopy.replace('Structura', brand)}
          </div>
        </div>
      </footer>
    </Shell>
  )
}
