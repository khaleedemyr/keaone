import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import type { StorefrontRenderModel } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { parseFooterLinks, readFooterColumn } from '../lib/footerLinks'
import { inquiryErrorMessage, inquiryFromForm, submitStorefrontInquiry } from '../lib/submitStorefrontInquiry'
import { LandingNewsDetail, newsItemsFromModel, parseSocialLinks, useLandingNewsNav, type LandingNewsItem } from './LandingNewsDetail'
import { LandingNewsPage } from './LandingNewsPage'
import { coerceNavForTemplate, storefrontFixed } from './storefrontNav'
import { ELLIPSE_DEMO, ELLIPSE_SERVICE_ICONS } from './ellipseDemo'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import { HeroEnter, HoverLift, Reveal, Stagger, StaggerItem, Tilt3D } from './storefrontMotion'

/**
 * Structura ellipse — https://templates.framework-y.com/structura/pages/index-ellipse.html
 *
 * Measured tokens:
 * - side-menu-container padding-left: 250px; fixed side-menu-fixed panel
 * - img-bar border-radius: 70px (ellipse / pill photos)
 * - rotate-block: rotate(-90deg) small uppercase aside text
 * - background-lines-2 soft gray #F8F8F8
 * - fonts: Nunito headings + Questrial body; ink #272727
 * - side-social: vertical social labels on the right edge
 */

const E = {
  side: 250,
  content: 'mx-auto w-full max-w-[1170px] px-[15px] sm:px-[30px]',
  padY: 'py-[50px] sm:py-[80px]',
  ink: '#272727',
  mute: '#8a8a8a',
  body: '#4C4C4C',
  soft: '#F8F8F8',
} as const

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return { primary: E.ink, accent: E.mute, background: '#ffffff', text: E.ink }
  }
  return {
    primary: model.brand_colors.primary || E.ink,
    accent: model.brand_colors.accent || E.mute,
    background: model.brand_colors.background || '#ffffff',
    text: model.brand_colors.text || E.ink,
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

function gallery(content: Record<string, unknown>, key: string): string[] {
  const value = content[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v) : []
}

function parseCoord(raw: string, fallback: number) {
  const n = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function mapUrl(lat: number, lng: number, zoom: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=${Math.round(zoom)}&hl=en`
}

function mapEmbed(lat: number, lng: number, zoom: number) {
  const z = Math.min(18, Math.max(1, Math.round(zoom)))
  const delta = 0.02 / Math.max(1, z / 10)
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`
}

function LinesBg({ soft = false }: { soft?: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundColor: soft ? E.soft : 'transparent',
        backgroundImage: soft
          ? 'repeating-linear-gradient(0deg, transparent 0, transparent 11px, rgba(0,0,0,0.035) 11px, rgba(0,0,0,0.035) 12px)'
          : 'repeating-linear-gradient(90deg, transparent 0, transparent 47px, rgba(39,39,39,0.045) 47px, rgba(39,39,39,0.045) 48px)',
        opacity: soft ? 1 : 0.45,
      }}
    />
  )
}

/** Pill / ellipse image — img-bar { border-radius: 70px } */
function PillImg({
  src,
  className = '',
  height = 280,
}: {
  src: string
  className?: string
  height?: number
}) {
  return (
    <div
      className={`overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.12)] ${className}`}
      style={{ borderRadius: 70, height }}
    >
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  )
}

function TextBtn({ href, children, color = E.ink }: { href: string; children: ReactNode; color?: string }) {
  return (
    <a
      href={href}
      className="inline-block text-[14px] font-semibold tracking-[0.5px] underline-offset-4 hover:underline"
      style={{ color, fontFamily: 'Nunito, sans-serif' }}
    >
      {children}
    </a>
  )
}

function SolidBtn({
  href,
  onClick,
  children,
  color = E.ink,
  type = 'button',
  border = false,
  disabled = false,
}: {
  href?: string
  onClick?: () => void
  children: ReactNode
  color?: string
  type?: 'button' | 'submit'
  border?: boolean
  disabled?: boolean
}) {
  const cls =
    'inline-flex items-center justify-center px-[30px] py-[10px] text-[14px] font-semibold tracking-[0.5px] transition hover:opacity-90 disabled:opacity-60'
  const style = border
    ? { border: `1px solid ${color}`, color, background: 'transparent', fontFamily: 'Nunito, sans-serif' as const }
    : { background: color, color: '#fff', fontFamily: 'Nunito, sans-serif' as const }
  if (href) {
    return (
      <a href={href} className={cls} style={style} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
        {children}
      </a>
    )
  }
  return (
    <button type={type} className={cls} style={style} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

function SidePanel({
  brand,
  logoUrl,
  items,
  active,
  copy,
  color,
  socialLinks,
  open,
  onClose,
  onNavigate,
  preview,
}: {
  brand: string
  logoUrl?: string | null
  items: { label: string; href: string }[]
  active: string
  copy: string
  color: string
  socialLinks: { label: string; href: string }[]
  open: boolean
  onClose: () => void
  onNavigate?: (href: string) => void
  preview?: boolean
}) {
  const pin = storefrontFixed(preview)
  return (
    <>
      {/* Desktop side panel — absolute in preview so it stays inside the ERP pane */}
      <aside
        className={`${pin} bottom-0 left-0 top-0 z-40 hidden flex-col border-r border-black/5 bg-white lg:flex`}
        style={{ width: E.side }}
      >
        <div className="px-10 py-10">
          {logoUrl ? (
            <img src={logoUrl} alt={brand} className="h-10 max-w-[140px] object-contain" />
          ) : (
            <div className="text-lg font-black tracking-wide" style={{ fontFamily: 'Nunito, sans-serif', color }}>
              {brand}
            </div>
          )}
        </div>
        <nav className="flex flex-1 flex-col justify-center">
          <ul className="m-0 list-none p-0">
            {items.map((item) => {
              const isActive = active === item.href
              return (
                <li key={item.href} className="relative">
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-px -translate-y-1/2 transition-all"
                    style={{ width: isActive ? 28 : 16, background: color, marginLeft: 12 }}
                  />
                  <a
                    href={item.href}
                    className="block py-2.5 pl-10 pr-6 text-[14px] font-semibold tracking-[1px] transition"
                    style={{
                      color: isActive ? color : E.mute,
                      fontFamily: 'Nunito, sans-serif',
                    }}
                    onClick={(e) => {
                      if (!onNavigate) return
                      e.preventDefault()
                      onNavigate(item.href)
                      onClose()
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="px-8 pb-8">
          <div className="mb-3 flex flex-wrap gap-1">
            {socialLinks.slice(0, 6).map((s) => (
              <a
                key={s.label}
                href={s.href}
                target={s.href.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                title={s.label}
                className="inline-flex h-8 min-w-8 items-center justify-center px-1 text-[11px] font-semibold transition hover:opacity-70"
                style={{ color }}
              >
                {s.label.slice(0, 2)}
              </a>
            ))}
          </div>
          <p className="text-[13px]" style={{ color: E.mute }}>
            {copy}
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className={`${pin} inset-0 z-50 lg:hidden`}>
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="absolute bottom-0 left-0 top-0 flex w-[250px] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-6 py-5">
              <span className="font-black" style={{ fontFamily: 'Nunito, sans-serif', color }}>
                {brand}
              </span>
              <button type="button" onClick={onClose} className="text-xl" aria-label="Close menu">
                ×
              </button>
            </div>
            <nav className="flex-1 px-2">
              {items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    if (onNavigate) {
                      e.preventDefault()
                      onNavigate(item.href)
                    }
                    onClose()
                  }}
                  className="block px-4 py-3 text-[14px] font-semibold"
                  style={{ color, fontFamily: 'Nunito, sans-serif' }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="space-y-2 px-6 pb-4">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target={s.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                  className="block text-[13px] font-semibold"
                  style={{ color }}
                  onClick={onClose}
                >
                  {s.label}
                </a>
              ))}
            </div>
            <p className="px-6 pb-6 text-[12px]" style={{ color: E.mute }}>
              {copy}
            </p>
          </aside>
        </div>
      ) : null}
    </>
  )
}

function Shell({ model, children }: { model: StorefrontRenderModel; children: ReactNode }) {
  const c = colors(model)
  useEffect(() => {
    const id = 'ellipse-fonts'
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
        color: E.body,
        fontFamily: 'Questrial, system-ui, sans-serif',
        fontSize: 16,
        lineHeight: '28px',
      }}
    >
      {model.preview ? (
        <div className="sticky top-0 z-[60] border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function LandingEllipse({ model }: { model: StorefrontRenderModel }) {
  const content = theme(model)
  const primary = colors(model).primary || E.ink
  const brand = model.title || 'Structura'
  const [menuOpen, setMenuOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')
  const [active, setActive] = useState('#about')
  const [showMap, setShowMap] = useState(false)

  const navDefault =
    'About | #about\nAwards | #awards\nGallery | #gallery\nServices | #services\nNews | #news\nContacts | #contacts'
  const navParsed = parseFooterLinks(slotText(content, 'nav_links', navDefault))
    .filter((l): l is { label: string; href: string } => typeof l.href === 'string' && !!l.href)
    .slice(0, 8)
  const navFallback = parseFooterLinks(navDefault)
    .filter((l): l is { label: string; href: string } => typeof l.href === 'string' && !!l.href)
    .slice(0, 8)
  const navItems = coerceNavForTemplate(navParsed, navFallback, [
    'home',
    'about',
    'awards',
    'gallery',
    'services',
    'news',
    'contacts',
  ])
  const navKey = navItems.map((n) => n.href).join('|')

  useEffect(() => {
    const ids = navKey
      .split('|')
      .map((h) => h.replace(/^#/, ''))
      .filter(Boolean)
    const onScroll = () => {
      let current = ids[0] ? `#${ids[0]}` : '#about'
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 160) current = `#${id}`
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [navKey])

  const sidebarCopy = slotText(content, 'sidebar_copy', '© 2018. All rights reserved.')
  const socialLinks = parseSocialLinks(
    slotText(
      content,
      'social_links',
      'Facebook | https://facebook.com\nTwitter | https://twitter.com\nInstagram | https://instagram.com\nYoutube | https://youtube.com',
    ),
  )
  const heroImage = withDemoImage(model, typeof content.hero_image === 'string' ? content.hero_image : undefined, ELLIPSE_DEMO.hero)
  const heroRotate = slotText(
    content,
    'hero_rotate_text',
    'Tokyo based minimal artist\nwith passion for painting\nand conceptual design',
  )
  const heroHeadline = slotText(content, 'hero_headline', 'Hello.\nI call me\nStructura').replace(
    /Structura/g,
    brand,
  )

  const aboutIcons = parsePairs(
    slotText(
      content,
      'about_icons',
      'Videos | Loremo ipsume dolorle\nMusic | Aeipsume dolorge\nSociety | Loreme ipsuma dolore\nPeople | Reipsume dolore auio\nMarketing | Apsum dolore mento\nGraphics | Lorem ipsum dolor',
    ),
  )
  const aboutTitle1 = slotText(content, 'about_title_1', 'I love design and coding')
  const aboutBody1 = slotText(
    content,
    'about_body_1',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore et dolore magna aliqua. Utenim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  )
  const aboutCta1 = slotText(content, 'about_cta_1', 'Read more')
  const aboutTitle2 = slotText(content, 'about_title_2', 'I love design and coding')
  const aboutBody2 = slotText(
    content,
    'about_body_2',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore et dolore magna aliqua. Utenim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  )
  const aboutCta2 = slotText(content, 'about_cta_2', 'Read more')
  const aboutPhotos = withDemoFallback(model, gallery(content, 'about_gallery'), ELLIPSE_DEMO.about)

  const skillsTitle = slotText(content, 'skills_title', 'Skills')
  const skillsBars = parsePairs(
    slotText(content, 'skills_bars', 'Web Design | 60\nFront-End Dev | 85\nBack-End Dev | 50\nUI/UX Design | 95'),
  ).map((p) => ({ name: p.name, pct: Math.min(100, Math.max(0, Number.parseInt(p.role, 10) || 0)) }))
  const awardsTitle = slotText(content, 'awards_title', 'Awards')
  const awards = parsePairs(
    slotText(
      content,
      'awards_list',
      'Css Design Awards | Special Kudos\nAwwwards | Honorable Mention\nMindsparkle Mag | Site of the day\nCode Tech Hole | Hall of Fame\nStrummble | Best of the month\nDeskowo | Honorable Work',
    ),
  )

  const galleryTitle = slotText(content, 'gallery_title', 'Gallery')
  const galleryBody = slotText(
    content,
    'gallery_body',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore et dolore magna aliqua.',
  )
  const galleryCta = slotText(content, 'gallery_cta', 'All photos')
  const galleryImgs = withDemoFallback(model, gallery(content, 'gallery'), ELLIPSE_DEMO.gallery)

  const midCtaImage = withDemoImage(
    model,
    typeof content.mid_cta_image === 'string' ? content.mid_cta_image : undefined,
    ELLIPSE_DEMO.midCta,
  )
  const midCtaHeadline = slotText(content, 'mid_cta_headline', 'Start\nFrom here\nContact us')

  const servicesTitle = slotText(content, 'services_title', 'Services')
  const servicesIntro = slotText(
    content,
    'services_intro',
    'Duis aute irure dolor in reprehenderit artellio partilo velita esse cillum dolore eu fugiata melone artento ascolto nulla pariature.',
  )
  const services = parsePairs(
    slotText(
      content,
      'services_items',
      "Retrò shows | Interdum iusto pulvinar consequuntur augue optio, repellat fuga!\nSuperior networking | Lorem ipsum dolor sit amet consectetur adipiscing elit.\nEmail marketing | Interdum iusto pulvinar consequuntur augue optio, repellat fuga!\nArtifical intelligence | Lorem ipsum dolor sit amet consectetur adipiscing elit.\nWeb design | Lorem ipsum dolor sit amet consectetur adipiscing elit.\nCode developing | Lorem ipsum dolor sit amet consectetur adipiscing elit.",
    ),
  ).slice(0, 6)
  const logos = withDemoFallback(model, gallery(content, 'logos_gallery'), ELLIPSE_DEMO.logos)

  const newsTitle = slotText(content, 'news_title', 'News, events and social feeds')
  const newsBody = slotText(
    content,
    'news_body',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore et dolore magna aliqua.',
  )
  const newsCta = slotText(content, 'news_cta', 'Visit the blog')
  const newsFromApi = newsItemsFromModel(model.news)
  const demoNews: LandingNewsItem[] = ELLIPSE_DEMO.news.slice(0, 3).map((image, i) => {
          const demos = [
            {
              day: '25',
              month: 'July',
              title: 'The tech conference of media and innovation',
              excerpt:
                'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore magna aliqua.',
            },
            {
              day: '28',
              month: 'July',
              title: 'Borouget market taste from inside',
              excerpt:
                'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore magna aliqua.',
            },
            {
              day: '31',
              month: 'July',
              title: 'Artificial intelligence and sociality',
              excerpt:
                'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore magna aliqua.',
            },
          ] as const
          const d = demos[i]!
          return {
            id: `demo-news-${i + 1}`,
            title: d.title,
            excerpt: d.excerpt,
            body: d.excerpt,
            image,
            day: d.day,
            month: d.month,
            tags: 'Tech, Arts',
          }
        })
  const allNews: LandingNewsItem[] = withDemoFallback(
    model,
    newsFromApi.map((n, i) => ({
      ...n,
      image: withDemoImage(model, n.image, ELLIPSE_DEMO.news[i % ELLIPSE_DEMO.news.length]),
      tags: n.tags || 'Tech, Arts',
    })),
    demoNews,
  )
  const newsItems = allNews.slice(0, 3)
  const newsNav = useLandingNewsNav(allNews)

  const contactTitle = slotText(content, 'contact_title', "Contact us, we don't bite")
  const contactBody = slotText(
    content,
    'contact_body',
    'Lorem ipsum dolor sit amet consectetur adipiscing elitsed do eiusmod tempor incididunt utlabore et dolore magna aliqua. Utenim ad minim veniam quis nostrud exercitation ullamco.',
  )
  const contactFormCta = slotText(content, 'contact_form_cta', 'Send messagge')
  const hoursTitle = slotText(content, 'hours_title', 'Times')
  const hours = parsePairs(
    slotText(content, 'hours_list', 'Mon-Fri | 11am - 15pm\nSaturday | 11am - 23pm\nSunday | Closed'),
  )
  const contactInfoTitle = slotText(content, 'contact_info_title', 'Contact')
  const mapLat = parseCoord(slotText(content, 'map_lat', '32.7426'), 32.7426)
  const mapLng = parseCoord(slotText(content, 'map_lng', '-117.0314'), -117.0314)
  const mapZoom = parseCoord(slotText(content, 'map_zoom', '14'), 14)
  const mapCta = slotText(content, 'map_cta', 'View map')

  const address = model.contact_address || '2514 Glebe Rd, Lemon Grove, CA, 91945'
  const phone = model.contact_phone || '+1 (229) 346-1100'
  const email = model.contact_email || 'creative@example.com'

  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Navigasi',
    links: 'About | #about\nServices | #services\nSupport | #news\nContacts | #contacts',
  })
  const footerCopy = slotText(content, 'footer_copy', '© Structura - One page minimal template')

  const mainPad = 'lg:pl-[250px]'

  if (newsNav.view === 'detail' && newsNav.selected) {
    return (
      <Shell model={model}>
        <SidePanel
          brand={brand}
          logoUrl={model.logo_url}
          items={navItems}
          active="#news"
          copy={sidebarCopy}
          color={primary}
          socialLinks={socialLinks}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          preview={model.preview}
          onNavigate={(href) => {
            setMenuOpen(false)
            newsNav.goSection(href)
          }}
        />
        <div className={mainPad}>
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-black/5 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              className="flex items-center gap-2 text-[13px] font-semibold"
              style={{ color: primary, fontFamily: 'Nunito, sans-serif' }}
              onClick={() => setMenuOpen(true)}
            >
              <span aria-hidden>☰</span> Menu
            </button>
            <span className="font-black" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
              {brand}
            </span>
          </div>
          <LandingNewsDetail
            item={newsNav.selected}
            onBack={newsNav.backFromDetail}
            primary={primary}
            muted={E.mute}
            preview={!!model.preview}
            contentClassName={`${E.content}`}
            brand={brand}
          />
        </div>
      </Shell>
    )
  }

  if (newsNav.view === 'list') {
    return (
      <Shell model={model}>
        <SidePanel
          brand={brand}
          logoUrl={model.logo_url}
          items={navItems}
          active="#news"
          copy={sidebarCopy}
          color={primary}
          socialLinks={socialLinks}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          preview={model.preview}
          onNavigate={(href) => {
            setMenuOpen(false)
            newsNav.goSection(href)
          }}
        />
        <div className={mainPad}>
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-black/5 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              className="flex items-center gap-2 text-[13px] font-semibold"
              style={{ color: primary, fontFamily: 'Nunito, sans-serif' }}
              onClick={() => setMenuOpen(true)}
            >
              <span aria-hidden>☰</span> Menu
            </button>
            <span className="font-black" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
              {brand}
            </span>
          </div>
          <LandingNewsPage
            items={allNews}
            onSelect={(item) => newsNav.openDetail(item, true)}
            onBack={newsNav.backFromList}
            primary={primary}
            muted={E.mute}
            preview={!!model.preview}
            contentClassName={`${E.content}`}
            brand={brand}
            kicker="News"
            title={newsTitle}
          />
        </div>
      </Shell>
    )
  }

  return (
    <Shell model={model}>
      <SidePanel
        brand={brand}
        logoUrl={model.logo_url}
        items={navItems}
        active={active}
        copy={sidebarCopy}
        color={primary}
        socialLinks={socialLinks}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        preview={model.preview}
        onNavigate={(href) => {
          setMenuOpen(false)
          newsNav.goSection(href)
        }}
      />

      {/* Mobile top bar */}
      <div className={`sticky top-0 z-30 flex items-center justify-between border-b border-black/5 bg-white/95 px-4 py-3 backdrop-blur lg:hidden ${model.preview ? 'top-9' : ''}`}>
        <button
          type="button"
          className="flex items-center gap-2 text-[13px] font-semibold"
          style={{ color: primary, fontFamily: 'Nunito, sans-serif' }}
          onClick={() => setMenuOpen(true)}
        >
          <span aria-hidden>☰</span> Menu
        </button>
        <span className="font-black" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
          {brand}
        </span>
      </div>

      {/* Right-edge social (side-social) — desktop */}
      <div
        className={`pointer-events-none ${storefrontFixed(model.preview)} right-0 top-1/2 z-30 hidden -translate-y-1/2 lg:block`}
        style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
      >
        <div
          className="pointer-events-auto flex gap-6 pr-3 text-[12px] font-semibold tracking-wide"
          style={{ color: primary, fontFamily: 'Nunito, sans-serif' }}
        >
          {socialLinks.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target={s.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              className="transition hover:opacity-70"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>

      <div className={mainPad}>
        {/* HERO */}
        <section id="home" className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={heroImage} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-white/80" />
            <LinesBg />
          </div>
          <div className={`relative ${E.content} ${E.padY}`}>
            <div className="grid items-center gap-8 md:grid-cols-12">
              <div className="hidden md:col-span-3 md:block" />
              <HeroEnter className="relative hidden h-[180px] md:col-span-3 md:block">
                <p
                  className="absolute left-1/2 top-1/2 w-[220px] origin-center text-[13px] uppercase leading-[22px] tracking-[0.5px]"
                  style={{
                    color: E.mute,
                    fontFamily: 'Questrial, sans-serif',
                    transform: 'translate(-50%, -50%) rotate(-90deg)',
                  }}
                >
                  {heroRotate.split('\n').map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              </HeroEnter>
              <HeroEnter delay={0.15} className="md:col-span-6">
                <p className="mb-6 text-[13px] uppercase tracking-[0.5px] md:hidden" style={{ color: E.mute }}>
                  {heroRotate.replace(/\n/g, ' · ')}
                </p>
                <h1
                  className="whitespace-pre-line text-[48px] leading-[1.05] sm:text-[64px] lg:text-[90px] lg:leading-[95px] xl:text-[110px] xl:leading-[110px]"
                  style={{ fontFamily: 'Questrial, sans-serif', color: primary, fontWeight: 400 }}
                >
                  {heroHeadline}
                </h1>
              </HeroEnter>
            </div>
          </div>
        </section>

        {/* ABOUT — icon strip */}
        <section id="about" className="relative">
          <LinesBg soft />
          <div className={`relative ${E.content} pt-[50px] sm:pt-[80px]`}>
            <Reveal>
              <Stagger className="flex gap-8 overflow-x-auto pb-4 [scrollbar-width:thin]">
                {aboutIcons.map((item, i) => (
                  <StaggerItem key={`${item.name}-${i}`} className="w-[160px] shrink-0 text-center sm:w-[180px]">
                    <div
                      className="mx-auto mb-3 flex h-14 w-14 items-center justify-center text-2xl"
                      style={{ color: primary }}
                    >
                      {ELLIPSE_SERVICE_ICONS[i % ELLIPSE_SERVICE_ICONS.length]}
                    </div>
                    <div className="text-[17px] font-bold" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                      {item.name}
                    </div>
                    <p className="mt-1 text-[13px]" style={{ color: E.mute }}>
                      {item.role}
                    </p>
                  </StaggerItem>
                ))}
              </Stagger>
            </Reveal>
          </div>

          {/* About copy + pill images */}
          <div className={`relative ${E.content} ${E.padY}`}>
            <div className="grid gap-10 lg:grid-cols-12">
              <Reveal className="lg:col-span-6">
                <h2 className="text-[28px] font-black sm:text-[32px]" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                  {aboutTitle1}
                </h2>
                <p className="mt-8" style={{ color: E.mute }}>
                  {aboutBody1}
                </p>
                <div className="mt-6">
                  <TextBtn href="#services" color={primary}>
                    {aboutCta1}
                  </TextBtn>
                </div>
                <h2
                  className="mt-16 text-right text-[28px] font-black sm:text-[32px]"
                  style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
                >
                  {aboutTitle2}
                </h2>
                <p className="mt-8 text-right" style={{ color: E.mute }}>
                  {aboutBody2}
                </p>
                <div className="mt-6 text-right">
                  <TextBtn href="#gallery" color={primary}>
                    {aboutCta2}
                  </TextBtn>
                </div>
              </Reveal>
              {aboutPhotos.length > 0 ? (
              <Reveal delay={0.1} className="grid grid-cols-3 gap-4 lg:col-span-6">
                <div className="pt-16">
                  {aboutPhotos[0] ? <PillImg src={aboutPhotos[0]} height={320} /> : null}
                </div>
                <div>
                  {aboutPhotos[1] ? <PillImg src={aboutPhotos[1]} height={420} /> : null}
                  <div className="mt-6">
                    {aboutPhotos[2] ? <PillImg src={aboutPhotos[2]} height={180} /> : null}
                  </div>
                </div>
                <div className="pt-20">
                  {aboutPhotos[3] ? <PillImg src={aboutPhotos[3]} height={260} /> : null}
                  <div className="mt-6">
                    {aboutPhotos[4] ? <PillImg src={aboutPhotos[4]} height={160} /> : null}
                  </div>
                </div>
              </Reveal>
              ) : null}
            </div>
          </div>
        </section>

        {/* SKILLS + AWARDS */}
        <section id="awards" className="relative">
          <LinesBg soft />
          <div className={`relative ${E.content} ${E.padY}`}>
            <div className="grid gap-10 lg:grid-cols-12">
              <Reveal className="bg-white p-8 sm:p-10 lg:col-span-6">
                <h2 className="text-[28px] font-black sm:text-[32px]" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                  {skillsTitle}
                </h2>
                <div className="mt-10 space-y-6">
                  {skillsBars.map((bar) => (
                    <div key={bar.name}>
                      <div className="mb-2 text-[14px] font-semibold" style={{ color: primary, fontFamily: 'Nunito, sans-serif' }}>
                        {bar.name}
                      </div>
                      <div className="h-2 w-full overflow-hidden bg-black/5">
                        <div
                          className="relative flex h-full items-center justify-end pr-2 text-[10px] font-bold text-white transition-all"
                          style={{ width: `${bar.pct}%`, background: primary }}
                        >
                          <span className="absolute -top-5 right-0 text-[12px]" style={{ color: primary }}>
                            {bar.pct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={0.08} className="lg:col-span-3">
                <h2 className="text-[28px] font-black sm:text-[32px]" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                  {awardsTitle}
                </h2>
                <div className="mt-8 space-y-5">
                  {awards.slice(0, 3).map((a) => (
                    <div key={a.name}>
                      <p style={{ color: E.mute }}>{a.name}</p>
                      <SolidBtn color={primary}>{a.role}</SolidBtn>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={0.16} className="lg:col-span-3 lg:pt-14">
                <div className="space-y-5">
                  {awards.slice(3, 6).map((a) => (
                    <div key={a.name}>
                      <p style={{ color: E.mute }}>{a.name}</p>
                      <SolidBtn color={primary}>{a.role}</SolidBtn>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* GALLERY */}
        <section id="gallery" className="relative bg-white">
          <div className={`relative ${E.content} ${E.padY}`}>
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <Stagger className="flex gap-6 overflow-x-auto pb-2 [scrollbar-width:thin]">
                  {galleryImgs.slice(0, 6).map((src, i) => (
                    <StaggerItem key={`${src}-${i}`} className="w-[160px] shrink-0 sm:w-[180px]">
                      <Tilt3D className="relative" maxTilt={16}>
                        <PillImg src={src} height={220 + (i % 3) * 40} />
                      </Tilt3D>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
              <Reveal delay={0.1} className="lg:col-span-4">
                <h2 className="text-[28px] font-black sm:text-[32px]" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                  {galleryTitle}
                </h2>
                <p className="mt-6" style={{ color: E.mute }}>
                  {galleryBody}
                </p>
                <div className="mt-6">
                  <TextBtn href="#contacts" color={primary}>
                    {galleryCta}
                  </TextBtn>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* MID CTA */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={midCtaImage} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-white/78" />
            <LinesBg />
          </div>
          <div className={`relative ${E.content} ${E.padY}`}>
            <Reveal>
              <h2
                className="whitespace-pre-line text-[48px] leading-[1.05] sm:text-[64px] lg:text-[90px] lg:leading-[95px]"
                style={{ fontFamily: 'Questrial, sans-serif', color: primary }}
              >
                {midCtaHeadline}
              </h2>
            </Reveal>
          </div>
        </section>

        {/* SERVICES */}
        <section id="services" className="relative">
          <LinesBg soft />
          <div className={`relative ${E.content} ${E.padY}`}>
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
              <div className="mx-auto mb-4 h-px w-16" style={{ background: primary }} />
              <h2 className="text-[28px] font-black sm:text-[32px]" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                {servicesTitle}
              </h2>
              <p className="mt-4" style={{ color: E.mute }}>
                {servicesIntro}
              </p>
            </Reveal>
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((svc, i) => (
                <StaggerItem key={svc.name} as="article">
                  <Tilt3D className="relative h-full bg-white p-8 shadow-sm">
                    <div
                      className="mb-5 flex h-14 w-14 items-center justify-center rounded-full text-xl"
                      style={{ border: `1px solid ${primary}`, color: primary }}
                    >
                      {ELLIPSE_SERVICE_ICONS[i % ELLIPSE_SERVICE_ICONS.length]}
                    </div>
                    <h3 className="text-[20px] font-black" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                      {svc.name}
                    </h3>
                    <p className="mt-3 text-[14px] leading-[24px]" style={{ color: E.mute }}>
                      {svc.role}
                    </p>
                  </Tilt3D>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* LOGOS */}
        <section className="relative">
          <LinesBg soft />
          <div className={`relative ${E.content} py-12`}>
            <Stagger className="flex flex-wrap items-center justify-center gap-10 sm:gap-14">
              {logos.slice(0, 6).map((src, i) => (
                <StaggerItem key={`${src}-${i}`} className="h-12 w-28 opacity-55 grayscale sm:h-14 sm:w-32">
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* NEWS */}
        {newsItems.length > 0 ? (
        <section id="news" className="relative bg-white">
          <div className={`relative ${E.content} ${E.padY}`}>
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <Stagger className="grid gap-8 sm:grid-cols-2">
                  {newsItems.map((n) => (
                    <StaggerItem key={n.id} as="article">
                      <HoverLift className="overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          className="group w-full text-left"
                          onClick={() => newsNav.openDetail(n)}
                        >
                          <div className="relative">
                            {n.image ? (
                              <img
                                src={n.image}
                                alt={n.title}
                                className="aspect-[16/10] w-full object-cover transition group-hover:opacity-95"
                              />
                            ) : null}
                            <div
                              className="absolute left-0 top-0 px-3 py-2 text-center text-white"
                              style={{ background: primary }}
                            >
                              <div className="text-[22px] font-black leading-none" style={{ fontFamily: 'Nunito, sans-serif' }}>
                                {n.day}
                              </div>
                              <div className="mt-1 text-[11px] uppercase tracking-wide">{n.month}</div>
                            </div>
                          </div>
                          <div className="p-6">
                            <h3
                              className="text-[18px] font-black leading-snug group-hover:underline"
                              style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
                            >
                              {n.title}
                            </h3>
                            <div className="mt-2 text-[12px]" style={{ color: E.mute }}>
                              {n.tags || 'Tech, Arts'} · Admin
                            </div>
                            <p className="mt-3 text-[14px] leading-[24px]" style={{ color: E.mute }}>
                              {n.excerpt}
                            </p>
                            <div className="mt-4 text-[14px] font-semibold" style={{ color: primary, fontFamily: 'Nunito, sans-serif' }}>
                              Read more →
                            </div>
                          </div>
                        </button>
                      </HoverLift>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
              <Reveal delay={0.1} className="lg:col-span-4">
                <h2 className="text-[28px] font-black sm:text-[32px]" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                  {newsTitle}
                </h2>
                <p className="mt-6" style={{ color: E.mute }}>
                  {newsBody}
                </p>
                <div className="mt-8">
                  <SolidBtn color={primary} onClick={newsNav.openList}>
                    {newsCta}
                  </SolidBtn>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
        ) : null}

        {/* CONTACTS */}
        <section id="contacts" className="relative bg-white">
          <div className={`relative ${E.content} ${E.padY}`}>
            <div className="grid gap-12 lg:grid-cols-12">
              <Reveal className="lg:col-span-6">
                <h2 className="text-[28px] font-black sm:text-[32px]" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                  {contactTitle}
                </h2>
                <p className="mt-6" style={{ color: E.mute }}>
                  {contactBody}
                </p>
                <form
                  className="mt-10 space-y-4"
                  onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                    e.preventDefault()
                    if (sending) return
                    setSending(true)
                    setFormError('')
                    try {
                      await submitStorefrontInquiry({
                        kind: 'contact',
                        ...inquiryFromForm(e.currentTarget),
                        preview: model.preview,
                      })
                      setSent(true)
                      e.currentTarget.reset()
                    } catch (err) {
                      setFormError(inquiryErrorMessage(err))
                    } finally {
                      setSending(false)
                    }
                  }}
                >
                  <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                  <div className="grid gap-4 sm:grid-cols-3">
                    {(['Your name', 'Email', 'Phone number'] as const).map((label) => (
                      <label key={label} className="block text-[14px]">
                        <span className="mb-2 block" style={{ color: E.mute }}>
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
                    <span className="mb-2 block" style={{ color: E.mute }}>
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
              <Reveal delay={0.1} className="lg:col-span-6">
                <h2 className="text-[28px] font-black sm:text-[32px]" style={{ fontFamily: 'Nunito, sans-serif', color: primary }}>
                  {hoursTitle}
                </h2>
                <ul className="mt-6 space-y-3">
                  {hours.map((h) => (
                    <li key={h.name} className="flex gap-4 text-[15px]">
                      <b style={{ color: primary, minWidth: 90 }}>{h.name}</b>
                      <span style={{ color: E.mute }}>{h.role}</span>
                    </li>
                  ))}
                </ul>
                <h2
                  className="mt-12 text-[28px] font-black sm:text-[32px]"
                  style={{ fontFamily: 'Nunito, sans-serif', color: primary }}
                >
                  {contactInfoTitle}
                </h2>
                <ul className="mt-6 space-y-3">
                  <li className="flex gap-4 text-[15px]">
                    <b style={{ color: primary, minWidth: 90 }}>Address</b>
                    <span style={{ color: E.mute }}>{address}</span>
                  </li>
                  <li className="flex gap-4 text-[15px]">
                    <b style={{ color: primary, minWidth: 90 }}>Phone</b>
                    <span style={{ color: E.mute }}>{phone}</span>
                  </li>
                  <li className="flex gap-4 text-[15px]">
                    <b style={{ color: primary, minWidth: 90 }}>Email</b>
                    <span style={{ color: E.mute }}>{email}</span>
                  </li>
                </ul>
                <div className="mt-10 flex flex-wrap gap-3">
                  <SolidBtn border color={primary} href={mapUrl(mapLat, mapLng, mapZoom)}>
                    {mapCta}
                  </SolidBtn>
                  <button
                    type="button"
                    className="text-[13px] font-semibold underline-offset-4 hover:underline"
                    style={{ color: primary, fontFamily: 'Nunito, sans-serif' }}
                    onClick={() => setShowMap((v) => !v)}
                  >
                    {showMap ? 'Hide map' : 'Embed map'}
                  </button>
                </div>
                {showMap ? (
                  <iframe
                    title="Location map"
                    src={mapEmbed(mapLat, mapLng, mapZoom)}
                    className="mt-6 h-[260px] w-full border-0"
                    loading="lazy"
                  />
                ) : null}
              </Reveal>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-black/10 bg-white py-10">
          <div className={E.content}>
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
                  className="inline-flex h-9 min-w-9 items-center justify-center px-2 text-[11px] text-white transition hover:opacity-85"
                  style={{ background: primary }}
                  title={s.label}
                >
                  {s.label.slice(0, 2)}
                </a>
              ))}
            </div>
            </div>
            <div className="mt-8 text-[13px]" style={{ color: E.mute }}>
              {footerCopy.replace('Structura', brand)}
            </div>
          </div>
        </footer>
      </div>
    </Shell>
  )
}
