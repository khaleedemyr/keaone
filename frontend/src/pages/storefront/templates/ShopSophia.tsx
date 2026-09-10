import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatRupiah } from '../../../lib/money'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import { useShop } from '../commerce/StorefrontShop'
import type { StorefrontRenderModel, StorefrontRenderProduct } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { parseFooterLinks, readFooterColumn, readFooterLegal, readSophiaServicesColumn } from '../lib/footerLinks'
import { coerceNavForTemplate, handleShopNavClick, useStorefrontScrolled } from './storefrontNav'
import { SOPHIA_DEMO } from './sophiaDemo'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import {
  Float,
  HeroEnter,
  HoverLift,
  Magnetic,
  Parallax,
  Reveal,
  ScalePop,
  Stagger,
  StaggerItem,
  Tilt3D,
} from './storefrontMotion'

/**
 * Sophia Pro — Homepage Style 3
 * https://demo-sophia-pro.wpcustomthemes.com/homepage-style-3/
 *
 * Measured from demo CSS / theme tokens:
 * - body bg #fdf6f2, deep peach #f7daca, secondary #fbede5
 * - button #954e26, secondary CTA #da5d04, icon-bg #f8caaf
 * - headings Merriweather, body Switzer-like
 * - hero: centered copy + semicircle image (64vw×32vw) + 3 float circles
 * - buttons border-radius 32px
 */

const S = {
  frame: 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8',
  bg: '#fdf6f2',
  deep: '#f7daca',
  secondary: '#fbede5',
  peach: '#f9dfd0',
  iconBg: '#f8caaf',
  button: '#954e26',
  buttonSecondary: '#da5d04',
  title: '#010101',
  body: '#0d0d0d',
  muted: '#686868',
  border: '#CFAE9B',
  borderLight: '#EEDCD0',
  espresso: '#4d3422',
  softTerracotta: '#d29878',
} as const

const DEFAULT_CATS = [
  'Body Care Accessories',
  'Skin Cleansers',
  'Face Moisturisers',
  'Sunscreen Protection',
  'Face Masks',
]

const DEMO_PRODUCT_NAMES = [
  'Jasmine Dream Cleansing Balm',
  'Moisture Lock Hyaluronic Gel',
  'Advanced Brightening Mask',
  'Aloe Soothe Calming Gel',
  'AquaBoost Overnight Serum',
  'Brightening Vitamin C Serum',
  'ClearGlow Gentle Cleanser',
  'ClearSpot Rapid Action Gel',
  'Coconut Bliss Moisture Cream',
  'Daily Defense SPF Moisturizer',
  'PureLift Foaming Wash',
  'Rose Silk Eye Cream',
]

const DEMO_PRODUCT_BODIES = [
  'Silky cleansing balm that melts away makeup and daily buildup.',
  'Lightweight gel with multiple molecular weights of hyaluronic acid.',
  'Dual-action mask that brightens and shields skin from UV damage.',
  'Cooling gel infused with pure aloe vera that instantly calms irritated skin.',
  'Intensive overnight serum that replenishes moisture and repairs skin.',
  'Potent vitamin C formula that targets dark spots and uneven tone.',
  'Soft, non-foaming cleanser that removes impurities without stripping.',
  'Targeted treatment gel that quickly reduces the appearance of blemishes.',
  'Rich, creamy moisturizer with organic coconut oil.',
  'Lightweight daily moisturizer with broad-spectrum sun protection.',
  'Airy foam cleanser that lifts away impurities and excess oil.',
  'Delicate eye cream with rose extract and peptides.',
]

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return {
      primary: S.button,
      accent: S.buttonSecondary,
      background: S.bg,
      text: S.body,
    }
  }
  return {
    primary: model.brand_colors.primary || S.button,
    accent: model.brand_colors.accent || S.buttonSecondary,
    background: model.brand_colors.background || S.bg,
    text: model.brand_colors.text || S.body,
  }
}

function theme(model: StorefrontRenderModel) {
  return model.theme_content ?? {}
}

function slotText(content: Record<string, unknown>, key: string, fallback: string) {
  const value = content[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function lines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function Shell({ model, children }: { model: StorefrontRenderModel; children: ReactNode }) {
  const c = colors(model)
  useEffect(() => {
    const id = 'sophia-fonts-v2'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Manrope:wght@400;500;600;700&display=swap'
    document.head.appendChild(link)
  }, [])
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        background: c.background || S.bg,
        color: c.text,
        fontFamily: 'Manrope, system-ui, sans-serif',
      }}
    >
      {model.preview ? (
        <div className="border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function StarRow({ n = 5, size = 14 }: { n?: number; size?: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(n)))
  return (
    <span className="inline-flex gap-0.5 text-[#e0a84a]" aria-hidden style={{ fontSize: size }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < filled ? '★' : '☆'}</span>
      ))}
    </span>
  )
}

function TrustIcon({ index }: { index: number }) {
  const paths = [
    'M7 7h10v2H7zm0 4h10v2H7zm2 4h6v2H9zM5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
    'M3 12h18M12 3v10m-5 8h10',
    'M12 21s-7-4.5-7-10a7 7 0 1114 0c0 5.5-7 10-7 10z',
    'M4 10h16v9H4zm2-4h12v4H6z',
  ]
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={S.button} strokeWidth="1.7" aria-hidden>
      <path d={paths[index % paths.length]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProductCard({
  product,
  body,
  imageFallback,
  primary,
}: {
  product: StorefrontRenderProduct
  body?: string
  imageFallback?: string
  primary: string
}) {
  const shop = useShop()
  const desc = (product.description || body || '').trim()
  const imageSrc = product.image_url || imageFallback
  return (
    <article className="group flex h-full flex-col bg-transparent">
      <button
        type="button"
        className="relative aspect-[4/5] w-full overflow-hidden rounded-[18px] bg-[#f8ebe4] text-left"
        onClick={() => shop?.openProduct(product)}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
        {product.is_deal ? (
          <ScalePop className="absolute left-3 top-3">
            <span
              className="inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
              style={{ background: primary }}
            >
              Sale
            </span>
          </ScalePop>
        ) : null}
      </button>
      <div className="flex flex-1 flex-col gap-1.5 px-1 pb-2 pt-4">
        <div className="text-[15px] font-semibold" style={{ color: primary }}>
          {formatRupiah(product.price)}
        </div>
        <button type="button" className="text-left" onClick={() => shop?.openProduct(product)}>
          <h3
            className="text-[17px] font-bold leading-snug text-[#010101]"
            style={{ fontFamily: 'Merriweather, Georgia, serif' }}
          >
            {product.name}
          </h3>
        </button>
        {desc ? <p className="line-clamp-2 text-[13px] leading-relaxed text-[#686868]">{desc}</p> : null}
        <button
          type="button"
          className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-semibold transition hover:opacity-70"
          style={{ color: primary }}
          onClick={() => shop?.addToCart(product)}
        >
          Add To Cart <span aria-hidden>+</span>
        </button>
      </div>
    </article>
  )
}

export function ShopSophia({ model }: { model: StorefrontRenderModel }) {
  const content = theme(model)
  const c = colors(model)
  const shop = useShop()
  const [navGlass, chromeRef] = useStorefrontScrolled(16)
  const [reviewIndex, setReviewIndex] = useState(0)
  const reviewRef = useRef<HTMLDivElement>(null)

  const catalog = useMemo(() => {
    const demoProducts = DEMO_PRODUCT_NAMES.map((name, i) => ({
      id: -(i + 1),
      name,
      description: DEMO_PRODUCT_BODIES[i] || '',
      price: [640000, 588000, 536000, 448000, 742000, 640000, 410000, 384000, 704000, 544000, 544000, 768000][i] ?? 499000,
      image_url: SOPHIA_DEMO.products[i % SOPHIA_DEMO.products.length],
      is_deal: i % 3 === 1,
      is_bestseller: true,
    }))
    return withDemoFallback(model, model.products ?? [], demoProducts)
  }, [model])

  const products = catalog.slice(0, 12)

  const heroImage =
    withDemoImage(model, typeof content.hero_image === 'string' ? content.hero_image : undefined, SOPHIA_DEMO.hero)
  const floatImages = [0, 1, 2].map((i) => {
    const key = `hero_float_${i + 1}`
    const fromSlot = content[key]
    return withDemoImage(model, typeof fromSlot === 'string' ? fromSlot : undefined, SOPHIA_DEMO.floats[i]!)
  })
  const consultImage =
    withDemoImage(model, typeof content.consult_image === 'string' ? content.consult_image : undefined, SOPHIA_DEMO.consult)
  const aboutImage =
    withDemoImage(model, typeof content.about_image === 'string' ? content.about_image : undefined, SOPHIA_DEMO.about)

  const heroKicker = slotText(content, 'hero_kicker', '102+ five star ratings')
  const heroHeadline = slotText(
    content,
    'hero_headline',
    model.tagline || 'Your Trusted Choice for Quality Products in Sydney',
  )
  const heroBody = slotText(
    content,
    'hero_body',
    model.about || 'Professional services tailored to each client’s unique requirements, delivering exceptional results.',
  )
  const heroCta = slotText(content, 'hero_cta', 'Request a Free Consultation')
  const heroCtaSecondary = slotText(content, 'hero_cta_secondary', 'Book Online')

  const trust = [
    {
      title: slotText(content, 'trust_1_title', 'Returns & Exchange'),
      body: slotText(content, 'trust_1_body', 'Hassle free 15 day returns'),
    },
    {
      title: slotText(content, 'trust_2_title', 'Free Fast Shipping'),
      body: slotText(content, 'trust_2_body', 'For orders above Rp 100.000'),
    },
    {
      title: slotText(content, 'trust_3_title', 'Quality Products'),
      body: slotText(content, 'trust_3_body', 'Premium skincare brands'),
    },
    {
      title: slotText(content, 'trust_4_title', 'Secure Payments'),
      body: slotText(content, 'trust_4_body', 'Trusted payment platforms'),
    },
  ]

  const categoriesTitle = slotText(content, 'categories_title', 'Explore our Product Category')
  const categoriesBody = slotText(content, 'categories_body', 'Complete your beauty routine with sun and body care.')

  const categoryItems = (() => {
    const fromSlot = Array.isArray(content.categories) ? content.categories : []
    if (fromSlot.length > 0) {
      return fromSlot.slice(0, 5).map((row, index) => ({
        key: `cat-${index}`,
        categoryId:
          typeof row === 'object' && row && 'category_id' in row ? Number(row.category_id) || 0 : 0,
        label:
          typeof row === 'object' && row && 'label' in row && typeof row.label === 'string' && row.label.trim()
            ? row.label
            : DEFAULT_CATS[index] || `Category ${index + 1}`,
        image:
          typeof row === 'object' && row && 'image' in row && typeof row.image === 'string' && row.image
            ? row.image
            : withDemoImage(model, undefined, SOPHIA_DEMO.categories[index % SOPHIA_DEMO.categories.length]!),
      }))
    }
    return withDemoFallback(
      model,
      [],
      DEFAULT_CATS.map((label, index) => ({
        key: `demo-${index}`,
        categoryId: 0,
        label,
        image: withDemoImage(model, undefined, SOPHIA_DEMO.categories[index]!),
      })),
    )
  })()

  const productsTitle = slotText(content, 'products_title', 'Popular Skin Products for your Daily Use')
  const productsBody = slotText(
    content,
    'products_body',
    'Our picks for your skin: the products we love and recommend for a glowing you',
  )

  const reviewsTitle = slotText(
    content,
    'reviews_title',
    'Hear what our satisfied clients have to say about their experience.',
  )
  const reviewsIntro = slotText(
    content,
    'reviews_body',
    'Read honest reviews that reflect our dedication to client satisfaction and care.',
  )
  const reviewsScore = slotText(content, 'reviews_score', '5.0')
  const reviewsMeta = slotText(content, 'reviews_meta', 'Based on 104 Google Reviews')

  const reviews = lines(
    slotText(
      content,
      'reviews_list',
      "5|I highly recommend to anyone considering laser treatments. Their professional staff, modern equipment, and personalized care truly set them apart.|Joshua M\n5|They truly care about their clients and deliver outstanding results. I am very happy with the service received.|Emily Collins\n5|Based on the test they truly care about their clients and deliver outstanding results. I am very happy with the service received.|Chrisa Laster\n3|I had a good experience and am very happy with the service received. Looking forward to continuing.|Joshua Mullins",
    ),
  )
    .slice(0, 8)
    .map((line) => {
      const [stars, quote, name] = line.split('|').map((p) => p.trim())
      const n = Number(stars)
      return {
        stars: Number.isFinite(n) ? n : 5,
        quote: quote || line,
        name: name || 'Client',
      }
    })

  useEffect(() => {
    if (reviews.length < 2) return
    const id = window.setInterval(() => setReviewIndex((i) => (i + 1) % reviews.length), 4500)
    return () => window.clearInterval(id)
  }, [reviews.length])

  useEffect(() => {
    const el = reviewRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-review]')
    const w = card ? card.offsetWidth + 16 : 320
    el.scrollTo({ left: reviewIndex * w, behavior: 'smooth' })
  }, [reviewIndex])

  const consultTitle = slotText(content, 'consult_title', 'Complimentary Consultations')
  const consultBody = slotText(
    content,
    'consult_body',
    'Discover your ideal treatment plan with a free, personalized consultation.\n\nWe will guide you through our tailored services, designed to address your specific goals. Experience a boost in confidence and achieve the results you desire.',
  )
  const consultCta = slotText(content, 'consult_cta', 'Book Free Consultation')

  const aboutTitle = slotText(content, 'about_title', 'Providing Comprehensive Beauty Services')
  const aboutSubtitle = slotText(
    content,
    'about_subtitle',
    'Complete skincare care. From consultation to lasting results.',
  )
  const aboutBody = slotText(
    content,
    'about_body',
    model.about ||
      'Elevate your routine with our premier services, meticulously designed to enhance and nourish your skin. Our certified specialists leverage proven techniques to deliver personalized solutions for glow, calm, and lasting confidence.',
  )
  const aboutCta = slotText(content, 'about_cta', 'Book Online')
  const aboutPromo = slotText(
    content,
    'about_promo',
    'Use code “SOPHIE10” for 10% off your first booking. Open 7 days a week.',
  )

  const footerTagline = slotText(content, 'footer_tagline', 'Quality beauty products and care you can trust.')
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Quick Links',
    links: 'Home | #hero\nShop | #categories\nProducts | #products\nReviews | #reviews\nBook | #consult\nAbout | #about',
  })
  const footerCol2 = readSophiaServicesColumn(content)
  const footerCol3 = readFooterColumn(content, 3, {
    title: 'Shop',
    links: 'Cart | cart\nMy Account | account\nProducts | #products\nCategories | #categories',
  })
  const brand = model.title || 'Sophia'
  const footerLegal = readFooterLegal(content, 'Privacy Policy | #about\nTerms & Conditions | #about', '#about')
  const footerCopy = slotText(content, 'footer_copy', `Copyright © ${new Date().getFullYear()} ${brand} | All Rights Reserved.`)
  const phone = model.contact_phone || '02 1234 4456'
  const email = model.contact_email || ''
  const address = model.contact_address || 'Level 1 Suite 11, The Street Suburb, NSW Australia'

  const navDefault =
    'Home | #hero\nShop | #categories\nProducts | #products\nReviews | #reviews\nBook | #consult\nAbout | #about'
  const nav = coerceNavForTemplate(
    parseFooterLinks(slotText(content, 'nav_links', navDefault), '#hero'),
    parseFooterLinks(navDefault, '#hero'),
    ['hero', 'categories', 'products', 'reviews', 'consult', 'about'],
  ).slice(0, 6)

  return (
    <Shell model={model}>
      {/* Header — light, phone + Book Online */}
      <header
        ref={chromeRef}
        className={`sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter,box-shadow] duration-300 ${
          navGlass
            ? 'border-[#EEDCD0]/40 bg-[#fdf6f2]/55 shadow-sm backdrop-blur-md'
            : 'border-[#EEDCD0]/80 bg-[#fdf6f2]/92 backdrop-blur-md'
        }`}
      >
        <div className={`${S.frame} flex h-[78px] items-center justify-between gap-4`}>
          <a href="#hero" className="flex shrink-0 items-center gap-2" onClick={(e) => handleShopNavClick(e, { href: '#hero' }, shop)}>
            {model.logo_url ? (
              <img src={model.logo_url} alt="" className="h-9 w-auto max-w-[160px] object-contain" />
            ) : (
              <span
                className="text-[26px] font-bold tracking-tight text-[#010101]"
                style={{ fontFamily: 'Merriweather, Georgia, serif' }}
              >
                {brand}
              </span>
            )}
          </a>
          <nav className="hidden items-center gap-7 text-[13px] font-medium capitalize tracking-wide text-[#0d0d0d] lg:flex">
            {nav.map((item) => (
              <a
                key={item.label}
                href={item.href || '#hero'}
                className="transition hover:opacity-60"
                onClick={(e) => handleShopNavClick(e, item, shop)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="hidden items-center gap-2 text-[13px] font-medium text-[#0d0d0d] md:inline-flex"
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-[12px]"
                style={{ background: S.iconBg }}
                aria-hidden
              >
                ☎
              </span>
              {phone}
            </a>
            <Magnetic className="hidden sm:inline-flex">
              <a
                href="#consult"
                className="inline-flex rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90"
                style={{ background: c.accent || S.buttonSecondary }}
              >
                {heroCtaSecondary}
              </a>
            </Magnetic>
            <button
              type="button"
              className="text-[13px] font-medium text-[#0d0d0d]"
              onClick={() => (shop?.customer ? shop.openAccount() : shop?.openLogin())}
            >
              Account
            </button>
            <button type="button" className="text-[13px] font-semibold" style={{ color: c.primary }} onClick={() => shop?.openCart()}>
              Cart {shop?.cartCount ?? 0}
            </button>
          </div>
        </div>
      </header>

      {/* Hero — centered copy + semicircle image + float circles (Style 3) */}
      <section id="hero" className="overflow-hidden" style={{ background: S.deep }}>
        <div className={`${S.frame} pt-12 text-center sm:pt-16 lg:pt-20`}>
          <HeroEnter className="mx-auto flex max-w-3xl flex-col items-center">
            <div className="flex items-center gap-2">
              <StarRow n={5} size={14} />
              <span className="text-[13px] font-medium uppercase tracking-[0.06em] text-[#010101]">{heroKicker}</span>
            </div>
            <h1
              className="mt-4 max-w-[18ch] text-[34px] font-bold leading-[1.15] text-[#010101] sm:text-[44px] lg:text-[52px]"
              style={{ fontFamily: 'Merriweather, Georgia, serif' }}
            >
              {heroHeadline}
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#010101]/80 sm:text-[16px]">{heroBody}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Magnetic>
                <a
                  href="#consult"
                  className="inline-flex items-center justify-center rounded-[32px] border-2 bg-transparent px-7 py-3 text-[14px] font-semibold text-[#010101] transition hover:bg-white/40"
                  style={{ borderColor: c.primary }}
                >
                  {heroCta}
                </a>
              </Magnetic>
              <Magnetic>
                <a
                  href="#products"
                  className="text-[14px] font-semibold text-[#010101] underline-offset-4 hover:underline"
                  onClick={(e) => {
                    e.preventDefault()
                    shop?.openCatalog()
                  }}
                >
                  {heroCtaSecondary}
                </a>
              </Magnetic>
            </div>
          </HeroEnter>

          {/* Semicircle hero + floating circles */}
          <HeroEnter delay={0.18} className="relative mx-auto mt-10 w-full max-w-[918px] pb-2 sm:mt-14">
            <div
              className="pointer-events-none absolute -left-[8%] -top-[20%] h-[55%] w-[55%] rounded-full opacity-70"
              style={{ background: `radial-gradient(circle, ${S.peach} 0%, transparent 70%)` }}
            />
            <Parallax
              offset={48}
              className="relative mx-auto w-[92%] sm:w-[86%]"
            >
              <div
                className="overflow-hidden"
                style={{
                  aspectRatio: '2 / 1',
                  borderTopLeftRadius: '9999px',
                  borderTopRightRadius: '9999px',
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                }}
              >
                {heroImage ? <img src={heroImage} alt="" className="h-full w-full object-cover object-[center_20%]" /> : null}
              </div>
            </Parallax>

            {/* Float circles — positions approximate demo vw layout */}
            <Float
              amplitude={12}
              duration={3.2}
              className="absolute left-[-2%] top-[2%] hidden h-[18%] w-[18%] overflow-hidden rounded-full sm:block md:left-[-1%] md:top-0 md:h-[22%] md:w-[22%]"
              style={{ background: S.iconBg, maxWidth: 195, maxHeight: 195, aspectRatio: '1' }}
            >
              {floatImages[0] ? <img src={floatImages[0]} alt="" className="h-full w-full object-cover" /> : null}
            </Float>
            <Float
              amplitude={14}
              duration={3.8}
              className="absolute right-[8%] top-[-8%] hidden h-[16%] w-[16%] overflow-hidden rounded-full sm:block md:right-[10%] md:top-[-10%] md:h-[20%] md:w-[20%]"
              style={{ background: S.iconBg, maxWidth: 180, maxHeight: 180, aspectRatio: '1' }}
            >
              {floatImages[1] ? <img src={floatImages[1]} alt="" className="h-full w-full object-cover" /> : null}
            </Float>
            <Float
              amplitude={10}
              duration={4.2}
              className="absolute bottom-[12%] right-[-4%] hidden h-[18%] w-[18%] overflow-hidden rounded-full sm:block md:bottom-[14%] md:right-[-3%] md:h-[22%] md:w-[22%]"
              style={{ background: S.iconBg, maxWidth: 195, maxHeight: 195, aspectRatio: '1' }}
            >
              {floatImages[2] ? <img src={floatImages[2]} alt="" className="h-full w-full object-cover" /> : null}
            </Float>
          </HeroEnter>
        </div>
      </section>

      {/* Trust strip — secondary peach bg + icon tiles */}
      <section style={{ background: S.secondary }}>
        <Stagger className={`${S.frame} grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5 lg:py-12`} stagger={0.08}>
          {trust.map((item, i) => (
            <StaggerItem key={item.title}>
              <div className="flex gap-3.5">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg"
                  style={{ background: S.iconBg }}
                >
                  <TrustIcon index={i} />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-[#010101]">{item.title}</div>
                  <div className="mt-1 text-[13px] text-[#686868]">{item.body}</div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {categoryItems.length > 0 ? (
      <section id="categories" className="py-16 sm:py-20" style={{ background: S.bg }}>
        <Reveal className={`${S.frame} text-center`}>
          <h2
            className="text-[30px] font-bold tracking-tight text-[#010101] sm:text-[36px]"
            style={{ fontFamily: 'Merriweather, Georgia, serif' }}
          >
            {categoriesTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-[#686868]">{categoriesBody}</p>
        </Reveal>
        <Stagger className={`${S.frame} mt-12 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6`} stagger={0.07}>
          {categoryItems.map((cat) => (
            <StaggerItem key={cat.key}>
              <HoverLift>
                <button
                  type="button"
                  className="group flex w-full flex-col items-center text-center"
                  onClick={() =>
                    cat.categoryId > 0
                      ? shop?.openCatalog({ categoryId: cat.categoryId })
                      : shop?.openCategories()
                  }
                >
                  <div
                    className="aspect-square w-full max-w-[180px] overflow-hidden rounded-full shadow-sm transition group-hover:shadow-md"
                    style={{ background: S.peach }}
                  >
                    {cat.image ? <img src={cat.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}
                  </div>
                  <div
                    className="mt-4 text-[15px] font-bold text-[#010101] group-hover:underline"
                    style={{ fontFamily: 'Merriweather, Georgia, serif' }}
                  >
                    {cat.label}
                  </div>
                </button>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
      ) : null}

      {/* Popular products */}
      {products.length > 0 ? (
      <section id="products" className="bg-white py-16 sm:py-20">
        <Reveal className={`${S.frame} text-center`}>
          <h2
            className="text-[30px] font-bold tracking-tight text-[#010101] sm:text-[36px]"
            style={{ fontFamily: 'Merriweather, Georgia, serif' }}
          >
            {productsTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] text-[#686868]">{productsBody}</p>
        </Reveal>
        <Stagger className={`${S.frame} mt-12 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`} stagger={0.06}>
          {products.map((p, i) => (
            <StaggerItem key={p.id}>
              <Tilt3D className="relative h-full" maxTilt={10}>
                <ProductCard
                  product={p}
                  imageFallback={withDemoImage(model, p.image_url, SOPHIA_DEMO.products[i % SOPHIA_DEMO.products.length]!)}
                  primary={c.primary}
                />
              </Tilt3D>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
      ) : null}

      {/* Reviews */}
      <section id="reviews" className="py-16 sm:py-20" style={{ background: S.peach }}>
        <div className={`${S.frame} grid gap-10 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start`}>
          <Reveal>
            <h2
              className="text-[28px] font-bold leading-snug tracking-tight text-[#010101] sm:text-[34px]"
              style={{ fontFamily: 'Merriweather, Georgia, serif' }}
            >
              {reviewsTitle}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-[#686868]">{reviewsIntro}</p>
            <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${S.borderLight}` }}>
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[#686868]">
                <span
                  className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: '#4285F4' }}
                >
                  G
                </span>
                Google Reviews
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-[36px] font-bold leading-none text-[#010101]">{reviewsScore}</span>
                <StarRow n={5} size={16} />
              </div>
              <div className="mt-2 text-[13px] text-[#686868]">{reviewsMeta}</div>
            </div>
          </Reveal>
          <div className="min-w-0">
            <div
              ref={reviewRef}
              className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {reviews.map((r, i) => (
                <HoverLift key={`${r.name}-${i}`} className="w-[min(100%,320px)] shrink-0 sm:w-[340px]">
                  <blockquote
                    data-review
                    className="rounded-2xl bg-white p-5 shadow-sm"
                    style={{ border: `1px solid ${S.borderLight}` }}
                  >
                  <StarRow n={r.stars} size={14} />
                  <p className="mt-3 text-[14px] leading-relaxed text-[#010101]">“{r.quote}”</p>
                  <footer className="mt-4 text-[13px] font-semibold text-[#686868]">{r.name}</footer>
                  </blockquote>
                </HoverLift>
              ))}
            </div>
            {reviews.length > 1 ? (
              <div className="mt-4 flex gap-2">
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Review ${i + 1}`}
                    className={`h-2 rounded-full transition ${i === reviewIndex ? 'w-6' : 'w-2'}`}
                    style={{ background: i === reviewIndex ? c.primary : S.border }}
                    onClick={() => setReviewIndex(i)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Complimentary consultation — full bleed split */}
      <section id="consult" className="bg-white">
        <div className="grid lg:grid-cols-2">
          <div className="relative min-h-[340px] overflow-hidden lg:min-h-[520px]" style={{ background: S.deep }}>
            <Parallax offset={56} className="h-full">
              {consultImage ? <img src={consultImage} alt="" className="h-full min-h-[340px] w-full object-cover lg:min-h-[520px]" /> : null}
            </Parallax>
          </div>
          <div className="flex flex-col justify-center px-6 py-14 sm:px-10 lg:px-16 lg:py-20" style={{ background: S.bg }}>
            <Reveal>
              <h2
                className="text-[30px] font-bold tracking-tight text-[#010101] sm:text-[36px]"
                style={{ fontFamily: 'Merriweather, Georgia, serif' }}
              >
                {consultTitle}
              </h2>
              <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-[#686868]">
                {lines(consultBody).map((para) => (
                  <p key={para.slice(0, 40)}>{para}</p>
                ))}
              </div>
              <Magnetic className="mt-8 w-fit">
                <a
                  href={`mailto:${email || 'hello@example.com'}?subject=${encodeURIComponent(consultCta)}`}
                  className="inline-flex items-center justify-center rounded-[32px] px-7 py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: c.primary }}
                >
                  {consultCta}
                </a>
              </Magnetic>
            </Reveal>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-16 sm:py-20" style={{ background: S.bg }}>
        <div className={`${S.frame} grid items-center gap-10 lg:grid-cols-2 lg:gap-16`}>
          <Reveal>
            <h2
              className="text-[30px] font-bold leading-tight tracking-tight text-[#010101] sm:text-[38px]"
              style={{ fontFamily: 'Merriweather, Georgia, serif' }}
            >
              {aboutTitle}
            </h2>
            <p className="mt-3 text-[16px] font-semibold text-[#010101]/85">{aboutSubtitle}</p>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-[#686868]">
              {lines(aboutBody).map((para) => (
                <p key={para.slice(0, 40)}>{para}</p>
              ))}
            </div>
            <Magnetic className="mt-8 w-fit">
              <a
                href="#consult"
                className="inline-flex items-center justify-center rounded-[32px] px-7 py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
                style={{ background: c.primary }}
              >
                {aboutCta}
              </a>
            </Magnetic>
            {aboutPromo ? <p className="mt-5 text-[13px] text-[#686868]">{aboutPromo}</p> : null}
          </Reveal>
          <Reveal delay={0.12}>
            <Tilt3D className="relative overflow-hidden rounded-[28px]" maxTilt={8}>
              <div style={{ background: S.deep }}>
                <Parallax offset={36}>
                  <div className="aspect-[4/5]">
                    {aboutImage ? <img src={aboutImage} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                </Parallax>
              </div>
            </Tilt3D>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-[#fdf6f2]" style={{ background: S.espresso }}>
        <div className={`${S.frame} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4`}>
          <div>
            {model.logo_url ? (
              <img src={model.logo_url} alt="" className="h-9 w-auto max-w-[160px] object-contain brightness-0 invert" />
            ) : (
              <div className="text-[28px] font-bold" style={{ fontFamily: 'Merriweather, Georgia, serif' }}>
                {brand}
              </div>
            )}
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/60">{footerTagline}</p>
            <div className="mt-5 space-y-1 text-[13px] text-white/70">
              <div>{address}</div>
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="block hover:text-white">
                {phone}
              </a>
              {email ? (
                <a href={`mailto:${email}`} className="block hover:text-white">
                  {email}
                </a>
              ) : null}
            </div>
          </div>
          {[footerCol1, footerCol2, footerCol3].map((col) => (
            <div key={col.title}>
              <div className="text-[13px] font-semibold uppercase tracking-wider text-white/90">{col.title}</div>
              <FooterLinkList
                links={col.links}
                className="mt-4 space-y-2 text-[13px] text-white/55"
                itemClassName="transition hover:text-white"
              />
              {col === footerCol3 && (model.bank_accounts?.length ?? 0) > 0 ? (
                <div className="mt-6 text-[11px] leading-relaxed text-white/40">
                  Transfer:{' '}
                  {model.bank_accounts!.map((b) => `${b.bank_name} ${b.account_number} a/n ${b.account_name}`).join(' · ')}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className={`${S.frame} flex flex-col gap-3 border-t border-white/10 py-5 text-[12px] text-white/45 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            {footerCopy}
          </div>
          <FooterLinkList links={footerLegal} inline className="flex gap-4" itemClassName="hover:text-white" />
        </div>
      </footer>
    </Shell>
  )
}
