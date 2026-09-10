import { useEffect, type ReactNode } from 'react'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import type { StorefrontRenderModel } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { readFooterColumn, readFooterLegal } from '../lib/footerLinks'
import { LandingNewsDetail, newsItemsFromModel, useLandingNewsNav, type LandingNewsItem } from './LandingNewsDetail'
import { LandingNewsPage } from './LandingNewsPage'
import { coerceNavForTemplate } from './storefrontNav'
import { MEDIDOVE_DEMO, MEDIDOVE_DEFAULT_DEPTS } from './medidoveDemo'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import { HeroEnter, HoverLift, Reveal, Stagger, StaggerItem, Tilt3D } from './storefrontMotion'

/**
 * MediDove clinic landing — https://medidove-nextjs.vercel.app/
 * Tokens (theme-pure MediDove):
 * - primary #e12454, dark #223645, soft green #8fb569, soft bg #f4f9ff
 * - font: Poppins
 * - sections: topbar, hero, about+founder, departments, team, 24/7, stats, pricing, consult, news, emergency, footer
 */

const MD = {
  wide: 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8',
  primary: '#e12454',
  dark: '#223645',
  green: '#8fb569',
  soft: '#f4f9ff',
  muted: '#64748b',
} as const

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return { primary: MD.primary, accent: MD.green, background: '#ffffff', text: MD.dark }
  }
  return {
    primary: model.brand_colors.primary || MD.primary,
    accent: model.brand_colors.accent || MD.green,
    background: model.brand_colors.background || '#ffffff',
    text: model.brand_colors.text || MD.dark,
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

function parseNav(raw: string) {
  return parsePairs(raw).map((p) => ({
    label: p.name,
    href: p.role.startsWith('#') || p.role.startsWith('http') ? p.role : `#${p.role.replace(/^#/, '')}`,
  }))
}

function Shell({ model, children }: { model: StorefrontRenderModel; children: ReactNode }) {
  const c = colors(model)
  useEffect(() => {
    const id = 'medidove-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        background: c.background,
        color: c.text,
        fontFamily: 'Poppins, system-ui, sans-serif',
      }}
    >
      {model.preview ? (
        <div className="sticky top-0 z-50 border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function PinkBtn({
  href,
  children,
  color = MD.primary,
  onNavigate,
}: {
  href: string
  children: ReactNode
  color?: string
  onNavigate?: (href: string) => void
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-sm px-6 py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
      style={{ background: color }}
      onClick={(e) => {
        if (!href.startsWith('#') || !onNavigate) return
        e.preventDefault()
        onNavigate(href)
      }}
    >
      <span className="text-lg leading-none">+</span>
      {children}
    </a>
  )
}

export function LandingMedidove({ model }: { model: StorefrontRenderModel }) {
  const content = theme(model)
  const brand = model.title || 'MediDove'
  const primary = colors(model).primary || MD.primary

  const topPhone = slotText(content, 'topbar_phone', model.contact_phone || '+1 800 833 9780')
  const topEmail = slotText(content, 'topbar_email', model.contact_email || 'info@example.com')
  const navDefault =
    'Home | #hero\nDepartment | #departments\nDoctors | #team\nNews | #news\nAbout | #about\nContact | #kontak'
  const nav = coerceNavForTemplate(
    parseNav(slotText(content, 'nav_links', navDefault)),
    parseNav(navDefault),
    ['hero', 'departments', 'team', 'news', 'about', 'kontak', 'appointment'],
  )

  const heroImage = withDemoImage(model, typeof content.hero_image === 'string' ? content.hero_image : undefined, MEDIDOVE_DEMO.hero)
  const heroKicker = slotText(content, 'hero_kicker', 'We are here for your care.')
  const heroHeadline = slotText(content, 'hero_headline', 'Best Care & Better Doctor.')
  const heroBody = slotText(
    content,
    'hero_body',
    'Professional healthcare services tailored to every patient — trusted doctors, modern facilities, and compassionate care.',
  )
  const heroCta = slotText(content, 'hero_cta', 'Make Appointment')
  const topbarCta = slotText(content, 'topbar_cta', heroCta)

  const aboutImage = withDemoImage(model, typeof content.about_image === 'string' ? content.about_image : undefined, MEDIDOVE_DEMO.about)
  const aboutKicker = slotText(content, 'about_kicker', 'About Us')
  const aboutTitle = slotText(content, 'about_title', 'Short Story About MediDove Clinic.')
  const aboutBody = slotText(
    content,
    'about_body',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  )
  const aboutBody2 = slotText(
    content,
    'about_body_2',
    'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  )
  const founderImage = withDemoImage(
    model,
    typeof content.founder_image === 'string' ? content.founder_image : undefined,
    MEDIDOVE_DEMO.founder,
  )
  const founderName = slotText(content, 'founder_name', 'Rosalina D. Williamson')
  const founderRole = slotText(content, 'founder_role', 'founder')

  const deptKicker = slotText(content, 'dept_kicker', 'Departments')
  const deptTitle = slotText(content, 'dept_title', 'Managed Your Healthcare Services')
  const deptBodyDefault = slotText(
    content,
    'dept_body_default',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.',
  )
  const deptCta = slotText(content, 'dept_cta', 'Read More')
  const departments = (() => {
    const fromSlot = Array.isArray(content.categories) ? content.categories : []
    if (fromSlot.length > 0) {
      return fromSlot.slice(0, 6).map((row, i) => ({
        key: `d-${i}`,
        label:
          typeof row === 'object' && row && 'label' in row && typeof row.label === 'string' && row.label.trim()
            ? row.label
            : MEDIDOVE_DEFAULT_DEPTS[i] || `Service ${i + 1}`,
        image:
          typeof row === 'object' && row && 'image' in row && typeof row.image === 'string'
            ? withDemoImage(model, row.image, MEDIDOVE_DEMO.departments[i % MEDIDOVE_DEMO.departments.length]!)
            : withDemoImage(model, undefined, MEDIDOVE_DEMO.departments[i % MEDIDOVE_DEMO.departments.length]!),
      }))
    }
    return withDemoFallback(model, [], MEDIDOVE_DEFAULT_DEPTS.map((label, i) => ({
      key: `demo-${i}`,
      label,
      image: MEDIDOVE_DEMO.departments[i]!,
    })))
  })()

  const teamKicker = slotText(content, 'team_kicker', 'Our Team')
  const teamTitle = slotText(content, 'team_title', 'A Professional & Care Provider')
  const teamCta = slotText(content, 'team_cta', 'Make Appointment')
  const teamMembers = parsePairs(
    slotText(
      content,
      'team_members',
      "Rosalina D. Williamson | Founder\nDiconda PIran Will | Dentist\nHulk M. Kenbon | Neurologist\nHaliam Z. Dicolaz | Consultant\nNicolas D. Case | Dentist\nPhumdon H. Norman | Neurologist",
    ),
  ).slice(0, 6)
  const teamGallery = withDemoFallback(
    model,
    Array.isArray(content.team_gallery)
      ? content.team_gallery.filter((u): u is string => typeof u === 'string' && !!u)
      : [],
    MEDIDOVE_DEMO.team,
  )

  const challengeImage = withDemoImage(
    model,
    typeof content.challenge_image === 'string' ? content.challenge_image : undefined,
    MEDIDOVE_DEMO.challenge,
  )
  const challengeKicker = slotText(content, 'challenge_kicker', 'We are available 24/7')
  const challengeTitle = slotText(content, 'challenge_title', 'We Always Ready For A Challenge.')
  const challengeCta = slotText(content, 'challenge_cta', 'Make Appointment')

  const stats = [1, 2].map((n) => ({
    value: slotText(content, `stat_${n}_value`, n === 1 ? '1M+' : '100+'),
    label: slotText(content, `stat_${n}_label`, n === 1 ? 'Satisfied Patients' : 'World Awards'),
    body: slotText(
      content,
      `stat_${n}_body`,
      n === 1
        ? 'Consectetur Lorem ipsum dolor sit amet, adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
        : 'Adipisicing Lorem ipsum dolor sit amet, consectetur elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    ),
  }))

  const pricingKicker = slotText(content, 'pricing_kicker', 'Our Plans')
  const pricingTitle = slotText(content, 'pricing_title', 'Pricing & Plans')
  const plans = [1, 2, 3].map((n) => ({
    title: slotText(content, `plan_${n}_title`, ['Professional', 'Advanced', 'Advantage'][n - 1]!),
    body: slotText(
      content,
      `plan_${n}_body`,
      'Ut enim ad minim veniam, quis istomw nostrud exercitation ullamco laboris nisi ut aliquip ex eacommodo.',
    ),
    price: slotText(
      content,
      `plan_${n}_price`,
      ['Rp 4.890.000', 'Rp 5.990.000', 'Rp 9.990.000'][n - 1]!,
    ),
    featured: n === 2,
  }))

  const consultImage = withDemoImage(
    model,
    typeof content.consult_image === 'string' ? content.consult_image : undefined,
    MEDIDOVE_DEMO.consult,
  )
  const consultKicker = slotText(content, 'consult_kicker', 'Stay healthy & strong to enjoy life')
  const consultTitle = slotText(
    content,
    'consult_title',
    'Trust Us To Be There To Help All & Make Things Well Again.',
  )
  const consultCta = slotText(content, 'consult_cta', 'Get a consultant')

  const newsKicker = slotText(content, 'news_kicker', 'News')
  const newsTitle = slotText(content, 'news_title', 'Get Every Single Updates Here.')
  const newsCta = slotText(content, 'news_cta', 'Our blog')
  const newsFromApi = newsItemsFromModel(model.news)
  const demoNews: LandingNewsItem[] = [
    {
      id: 'demo-news-1',
      title: 'Incididunt lorem ipsum dolor sit amet, cons adidis dicolo wiran.',
      excerpt:
        'Consectetur adipisicing elit, lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      body: 'Consectetur adipisicing elit, lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      image: MEDIDOVE_DEMO.news[0],
      tags: 'Medical, Medicine',
    },
    {
      id: 'demo-news-2',
      title: 'Ectetur lorem ipsum dolor sit amet, cons adidis dicolo wiran.',
      excerpt:
        'Incididunt consectetur adipisicing elit, lorem ipsum dolor sit amet, sed do eiusmod tempor ut labore et dolore magna aliqua.',
      body: 'Incididunt consectetur adipisicing elit, lorem ipsum dolor sit amet, sed do eiusmod tempor ut labore et dolore magna aliqua.',
      image: MEDIDOVE_DEMO.news[1],
      tags: 'Medical, Medicine',
    },
  ]
  const allNews: LandingNewsItem[] = withDemoFallback(
    model,
    newsFromApi.map((n, i) => ({
      ...n,
      image: withDemoImage(model, n.image, MEDIDOVE_DEMO.news[i % MEDIDOVE_DEMO.news.length]),
      tags: n.tags || 'Medical, Medicine',
    })),
    demoNews,
  )
  const news = allNews.slice(0, 2)
  const newsNav = useLandingNewsNav(allNews)

  const emergencyLabel = slotText(content, 'emergency_label', 'Emergency number')
  const emergencyPhone = slotText(content, 'emergency_phone', topPhone || '202-555-0104')

  const footerTagline = slotText(
    content,
    'footer_tagline',
    'Incididunt lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor ut labore et dolore magna aliqua.',
  )
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Departments',
    links:
      "Surgery and Radiology | #departments\nFamily Medicine | #departments\nWomen's Health | #departments\nOptician | #departments\nPediatrics | #departments\nDermatology | #departments",
  })
  const footerCol2 = readFooterColumn(content, 2, {
    title: 'Quick Links',
    links:
      'Departments | #departments\nOur Doctors | #team\nNews | #news\nContact Us | #kontak\nBook an Appointment | #appointment',
  })
  const footerLegal = readFooterLegal(content, 'Privacy Policy | #\nTerms of Use | #')
  const footerCopy = slotText(content, 'footer_copy', `© ${new Date().getFullYear()} ${brand}. All Rights Reserved.`)

  if (newsNav.view === 'detail' && newsNav.selected) {
    return (
      <Shell model={model}>
        <LandingNewsDetail
          item={newsNav.selected}
          onBack={newsNav.backFromDetail}
          primary={primary}
          muted="#64748b"
          preview={!!model.preview}
          contentClassName={MD.wide}
          fontHeading="Poppins, system-ui, sans-serif"
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
          primary={primary}
          muted="#64748b"
          preview={!!model.preview}
          contentClassName={MD.wide}
          fontHeading="Poppins, system-ui, sans-serif"
          brand={brand}
          kicker={newsKicker}
          title={newsTitle}
        />
      </Shell>
    )
  }

  return (
    <Shell model={model}>
      {/* Topbar */}
      <div className="border-b border-[#e8eef5] bg-white text-[13px] text-[#64748b]">
        <div className={`${MD.wide} flex flex-wrap items-center justify-between gap-2 py-2.5`}>
          <div className="flex flex-wrap items-center gap-4">
            <a href={`tel:${topPhone.replace(/\s/g, '')}`} className="hover:text-[#e12454]">
              {topPhone}
            </a>
            <a href={`mailto:${topEmail}`} className="hover:text-[#e12454]">
              {topEmail}
            </a>
          </div>
          <a
            href="#appointment"
            className="font-semibold text-[#e12454] hover:underline"
            onClick={(e) => {
              e.preventDefault()
              newsNav.goSection('#appointment')
            }}
          >
            {topbarCta}
          </a>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#e8eef5] bg-white/95 backdrop-blur">
        <div className={`${MD.wide} flex h-[78px] items-center justify-between gap-4`}>
          <a
            href="#hero"
            className="text-[22px] font-extrabold tracking-tight"
            style={{ color: MD.dark }}
            onClick={(e) => {
              e.preventDefault()
              newsNav.goSection('#hero')
            }}
          >
            {model.logo_url ? (
              <img src={model.logo_url} alt="" className="h-10 w-auto max-w-[160px] object-contain" />
            ) : (
              <>
                {brand}
                <span style={{ color: MD.primary }}>.</span>
              </>
            )}
          </a>
          <nav className="hidden items-center gap-6 text-[14px] font-medium text-[#223645] lg:flex">
            {nav.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="transition hover:text-[#e12454]"
                onClick={(e) => {
                  e.preventDefault()
                  newsNav.goSection(item.href)
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <PinkBtn href="#appointment" color={primary} onNavigate={newsNav.goSection}>
            {heroCta}
          </PinkBtn>
        </div>
      </header>

      {/* Hero */}
      <section id="hero" className="relative min-h-[78vh] overflow-hidden bg-[#223645] text-white sm:min-h-[86vh]">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#223645]/95 via-[#223645]/70 to-transparent" />
        <div className={`${MD.wide} relative z-10 flex min-h-[78vh] items-center py-16 sm:min-h-[86vh]`}>
          <HeroEnter className="max-w-xl">
            <p className="text-[15px] font-semibold" style={{ color: MD.primary }}>
              {heroKicker}
            </p>
            <h1 className="mt-3 text-[40px] font-extrabold leading-[1.15] sm:text-[52px] lg:text-[58px]">
              {heroHeadline}
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-white/85 sm:text-[16px]">{heroBody}</p>
            <div className="mt-8">
              <PinkBtn href="#appointment" color={primary} onNavigate={newsNav.goSection}>
                {heroCta}
              </PinkBtn>
            </div>
          </HeroEnter>
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-white py-16 sm:py-20">
        <div className={`${MD.wide} grid items-center gap-10 lg:grid-cols-2 lg:gap-14`}>
          <Reveal x={-24}>
            <div className="relative">
              <img src={aboutImage} alt="" className="w-full rounded-sm object-cover shadow-lg" />
              <div className="absolute -bottom-6 right-4 flex max-w-[220px] items-center gap-3 rounded-sm bg-white p-3 shadow-xl sm:right-8">
                <img src={founderImage} alt="" className="h-14 w-14 rounded-full object-cover" />
                <div>
                  <div className="text-[14px] font-bold text-[#223645]">{founderName}</div>
                  <div className="text-[12px] uppercase tracking-wide text-[#e12454]">{founderRole}</div>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1} x={24}>
            <p className="text-[14px] font-semibold uppercase tracking-wide text-[#e12454]">{aboutKicker}</p>
            <h2 className="mt-2 text-[28px] font-extrabold leading-tight text-[#223645] sm:text-[36px]">
              {aboutTitle}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[#64748b]">{aboutBody}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-[#64748b]">{aboutBody2}</p>
          </Reveal>
        </div>
      </section>

      {/* Departments */}
      <section id="departments" className="bg-[#f4f9ff] py-16 sm:py-20">
        <Reveal className={`${MD.wide} mb-10 text-center`}>
          <p className="text-[14px] font-semibold uppercase tracking-wide text-[#e12454]">{deptKicker}</p>
          <h2 className="mt-2 text-[28px] font-extrabold text-[#223645] sm:text-[36px]">{deptTitle}</h2>
        </Reveal>
        <Stagger className={`${MD.wide} grid gap-6 sm:grid-cols-2 lg:grid-cols-3`}>
          {departments.map((d) => (
            <StaggerItem key={d.key}>
              <Tilt3D className="relative h-full">
                <a
                  href="#appointment"
                  className="group block h-full overflow-hidden rounded-sm bg-white shadow-sm transition hover:shadow-lg"
                >
                  <div className="aspect-[16/10] overflow-hidden">
                    <img
                      src={d.image}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-[18px] font-bold text-[#223645] group-hover:text-[#e12454]">{d.label}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[#64748b]">{deptBodyDefault}</p>
                    <span className="mt-3 inline-block text-[13px] font-semibold text-[#e12454]">{deptCta} →</span>
                  </div>
                </a>
              </Tilt3D>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Team */}
      <section id="team" className="bg-white py-16 sm:py-20">
        <Reveal className={`${MD.wide} mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end`}>
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-wide text-[#e12454]">{teamKicker}</p>
            <h2 className="mt-2 text-[28px] font-extrabold text-[#223645] sm:text-[36px]">{teamTitle}</h2>
          </div>
          <PinkBtn href="#appointment" color={primary} onNavigate={newsNav.goSection}>
            {teamCta}
          </PinkBtn>
        </Reveal>
        <Stagger className={`${MD.wide} grid gap-5 sm:grid-cols-2 lg:grid-cols-3`} stagger={0.07}>
          {teamMembers.map((m, i) => (
            <StaggerItem key={`${m.name}-${i}`}>
              <HoverLift className="group overflow-hidden rounded-sm bg-[#f4f9ff]">
                <div className="aspect-[4/5] overflow-hidden bg-[#e8eef5]">
                  <img
                    src={teamGallery[i]}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-4 text-center">
                  <div className="text-[16px] font-bold text-[#223645]">{m.name}</div>
                  <div className="mt-1 text-[13px] font-medium uppercase tracking-wide text-[#e12454]">
                    {m.role || 'Specialist'}
                  </div>
                </div>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* 24/7 Challenge */}
      <section className="relative min-h-[48vh] overflow-hidden bg-[#223645] text-white sm:min-h-[54vh]">
        <img src={challengeImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-[#223645]/75" />
        <div className={`${MD.wide} relative z-10 flex min-h-[48vh] flex-col items-start justify-center py-16 sm:min-h-[54vh]`}>
          <Reveal>
            <p className="text-[14px] font-semibold uppercase tracking-wide text-[#8fb569]">{challengeKicker}</p>
            <h2 className="mt-3 max-w-2xl text-[32px] font-extrabold leading-tight sm:text-[42px]">{challengeTitle}</h2>
            <div className="mt-8">
              <PinkBtn href="#appointment" color={primary} onNavigate={newsNav.goSection}>
                {challengeCta}
              </PinkBtn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-14 sm:py-16">
        <Stagger className={`${MD.wide} grid gap-8 md:grid-cols-2`}>
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <div className="rounded-sm border border-[#e8eef5] bg-[#f4f9ff] p-8">
                <div className="text-[48px] font-extrabold leading-none text-[#e12454] sm:text-[56px]">{s.value}</div>
                <div className="mt-3 text-[18px] font-bold text-[#223645]">{s.label}</div>
                <p className="mt-3 text-[14px] leading-relaxed text-[#64748b]">{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Pricing */}
      <section id="appointment" className="bg-[#f4f9ff] py-16 sm:py-20">
        <Reveal className={`${MD.wide} mb-10 text-center`}>
          <p className="text-[14px] font-semibold uppercase tracking-wide text-[#e12454]">{pricingKicker}</p>
          <h2 className="mt-2 text-[28px] font-extrabold text-[#223645] sm:text-[36px]">{pricingTitle}</h2>
        </Reveal>
        <Stagger className={`${MD.wide} grid gap-6 lg:grid-cols-3`}>
          {plans.map((p) => (
            <StaggerItem key={p.title}>
              <Tilt3D className="relative h-full">
                <div
                  className={`h-full rounded-sm bg-white p-8 shadow-sm ${
                    p.featured ? 'ring-2 ring-[#e12454]' : 'border border-[#e8eef5]'
                  }`}
                >
                  <h3 className="text-[22px] font-extrabold text-[#223645]">{p.title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[#64748b]">{p.body}</p>
                  <div className="mt-6 text-[15px] font-semibold text-[#223645]">
                    Price: <span className="text-[#e12454]">{p.price}</span>
                  </div>
                  <a
                    href="#kontak"
                    className="mt-6 inline-flex w-full items-center justify-center rounded-sm px-4 py-3 text-[14px] font-semibold text-white"
                    style={{ background: p.featured ? MD.primary : MD.dark }}
                  >
                    Choose plan
                  </a>
                </div>
              </Tilt3D>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Consultant */}
      <section className="relative min-h-[42vh] overflow-hidden bg-[#223645] text-white">
        <img src={consultImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-[#223645]/70" />
        <div className={`${MD.wide} relative z-10 flex min-h-[42vh] flex-col items-center justify-center py-14 text-center`}>
          <Reveal>
            <p className="text-[14px] font-semibold uppercase tracking-wide text-[#8fb569]">{consultKicker}</p>
            <h2 className="mt-3 max-w-3xl text-[28px] font-extrabold leading-tight sm:text-[38px]">{consultTitle}</h2>
            <div className="mt-8">
              <PinkBtn href="#kontak" color={primary} onNavigate={newsNav.goSection}>
                {consultCta}
              </PinkBtn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* News */}
      {news.length > 0 ? (
      <section id="news" className="bg-white py-16 sm:py-20">
        <Reveal className={`${MD.wide} mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end`}>
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-wide text-[#e12454]">{newsKicker}</p>
            <h2 className="mt-2 text-[28px] font-extrabold text-[#223645] sm:text-[36px]">{newsTitle}</h2>
          </div>
          <button
            type="button"
            onClick={newsNav.openList}
            className="text-[14px] font-semibold text-[#e12454] hover:underline"
          >
            {newsCta} →
          </button>
        </Reveal>
        <Stagger className={`${MD.wide} grid gap-6 lg:grid-cols-2`}>
          {news.map((n) => (
            <StaggerItem key={n.id} as="article">
              <HoverLift className="overflow-hidden rounded-sm border border-[#e8eef5] bg-white shadow-sm">
                <button
                  type="button"
                  className="group w-full text-left"
                  onClick={() => newsNav.openDetail(n)}
                >
                  <div className="aspect-[16/9] overflow-hidden">
                    <img src={n.image} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                  </div>
                  <div className="p-6">
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-[#8fb569]">
                      {n.tags || 'Medical, Medicine'}
                    </div>
                    <h3 className="mt-2 text-[18px] font-bold leading-snug text-[#223645] group-hover:text-[#e12454]">
                      {n.title}
                    </h3>
                    <p className="mt-3 text-[14px] leading-relaxed text-[#64748b]">{n.excerpt}</p>
                    <div className="mt-4 text-[14px] font-semibold text-[#e12454]">Read more →</div>
                  </div>
                </button>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
      ) : null}

      {/* Emergency */}
      <section className="border-y border-[#e8eef5] bg-[#f4f9ff] py-10">
        <Reveal className={`${MD.wide} flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left`}>
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-wide text-[#64748b]">{emergencyLabel}</div>
            <a
              href={`tel:${emergencyPhone.replace(/\s/g, '')}`}
              className="mt-1 block text-[28px] font-extrabold text-[#e12454] sm:text-[32px]"
            >
              {emergencyPhone}
            </a>
          </div>
          <PinkBtn href={`tel:${emergencyPhone.replace(/\s/g, '')}`} color={primary}>
            Make call
          </PinkBtn>
        </Reveal>
      </section>

      {/* Footer */}
      <footer id="kontak" className="bg-[#223645] text-white">
        <Reveal className={`${MD.wide} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4`}>
          <div className="lg:col-span-2">
            <div className="text-[20px] font-extrabold">
              {brand}
              <span style={{ color: MD.primary }}>.</span>
            </div>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/70">{footerTagline}</p>
            <ul className="mt-5 space-y-1 text-[14px] text-white/75">
              {model.contact_email || topEmail ? <li>{model.contact_email || topEmail}</li> : null}
              {model.contact_phone || topPhone ? <li>{model.contact_phone || topPhone}</li> : null}
              {model.contact_address ? <li>{model.contact_address}</li> : <li>227 Marion Street, Columbia</li>}
            </ul>
          </div>
          <div>
            <div className="text-[16px] font-bold">{footerCol1.title}</div>
            <FooterLinkList
              links={footerCol1.links}
              className="mt-4 space-y-2 text-[14px] text-white/70"
              itemClassName="transition hover:text-white"
            />
          </div>
          <div>
            <div className="text-[16px] font-bold">{footerCol2.title}</div>
            <FooterLinkList
              links={footerCol2.links}
              className="mt-4 space-y-2 text-[14px] text-white/70"
              itemClassName="transition hover:text-white"
            />
          </div>
        </Reveal>
        <div className={`${MD.wide} flex flex-col gap-3 border-t border-white/10 py-5 text-[13px] text-white/55 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            {footerCopy}
          </div>
          <FooterLinkList links={footerLegal} inline className="flex flex-wrap gap-4" itemClassName="hover:text-white" />
        </div>
      </footer>
    </Shell>
  )
}
