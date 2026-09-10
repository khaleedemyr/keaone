import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatRupiah } from '../../../lib/money'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import { useShop } from '../commerce/StorefrontShop'
import type { StorefrontRenderModel, StorefrontRenderProduct } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { readFooterColumn, readFooterLegal } from '../lib/footerLinks'

/**
 * Capsule recreation from https://capsule.merchantsbestfriends.com/
 * Measured tokens from demo CSS:
 * - wideSize 1680px, contentSize 694px
 * - site bg #f4f4f4, layout #fff, primary #000, secondary #525252
 * - product grid column-gap 2px, row-gap 40px, image 3:4, radius 0
 * - header 80px, font Inter, huge ~42px
 */

const CAP = {
  wide: 'mx-auto w-full max-w-[1680px]',
  pad: 'px-4 sm:px-[1rem]',
  frame: 'mx-auto w-full max-w-[1680px] px-4 sm:px-[1rem]',
  content: 'mx-auto w-full max-w-[694px]',
  bg: '#f4f4f4',
  surface: '#ffffff',
  primary: '#000000',
  secondary: '#525252',
  border: '#d9d9d9',
  gap: '2px',
} as const

const BRANDS = ['Shift', 'Forme', 'Outline', 'Leve', 'Element'] as const

const DEMO_HERO_IMGS = [
  heroSvg('#1c1c1c', '#3a3a3a'),
  heroSvg('#222018', '#4a4538'),
  heroSvg('#181820', '#3a3a48'),
]

const DEMO_PRODUCT_IMGS = [
  productSvg('#e8e4de', '#cfc8be'),
  productSvg('#e2e6e8', '#b8c0c4'),
  productSvg('#ebe3d8', '#d0c0ae'),
  productSvg('#e5e5e5', '#bdbdbd'),
  productSvg('#e8ebe4', '#c2cbb8'),
  productSvg('#ebe8e4', '#c9c0b8'),
]

const DEMO_CAT_IMGS = [
  catSvg('#161616', '#3a3a3a'),
  catSvg('#1a1814', '#4a4030'),
  catSvg('#14181c', '#303840'),
]

const DEFAULT_HERO = [
  'Your Choice: Minimal by Design, Strong by Nature',
  'Strong Basics That Carry The Whole Look Daily',
  'No Trends Here, Just Pieces That Hold Up',
]

const DEFAULT_CATS = [
  {
    label: 'Tops',
    body: 'A clean, everyday piece with a comfortable fit and simple finish. Suitable for layering or wearing on its own across different settings.',
  },
  {
    label: 'Bottoms',
    body: 'A well-structured staple with a consistent fit and practical design. Easy to combine with casual or more refined outfits.',
  },
  {
    label: 'Accessories',
    body: 'A practical selection of caps, bags, and footwear designed for travel, outdoor activities, and everyday use.',
  },
]

const DEMO_PRODUCT_NAMES = [
  'Hooded Waterproof Raincoat',
  'Lace-Up Hiking Shoes',
  'Lightweight Hooded Rain Jacket',
  'Lace-Up Outdoor Hiking Shoes',
  'Sherpa Zip Fleece Jacket',
  'Hooded Puffer Jacket',
  'Zip Front Bomber Jacket',
  'Printed Puffer Jacket',
  'Graphic Print Baseball Cap',
  'Lightweight Hooded Windbreaker',
  'Floral Print Shirt',
  'Adjustable Training Cap',
]

function heroSvg(a: string, b: string) {
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" fill="none">
        <rect width="1920" height="1080" fill="${a}"/>
        <rect x="1080" y="80" width="620" height="920" fill="${b}" opacity=".55"/>
        <rect x="160" y="220" width="480" height="720" fill="${b}" opacity=".35"/>
      </svg>`,
    )
  )
}

function productSvg(bg: string, shape: string) {
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" fill="none">
        <rect width="600" height="800" fill="${bg}"/>
        <ellipse cx="300" cy="720" rx="140" ry="18" fill="#000" opacity=".06"/>
        <path d="M160 480c40-90 90-160 160-170 80-12 140 40 180 110 20 35 40 70 55 70H200c-20 0-50-10-40-10z" fill="${shape}"/>
        <path d="M200 490h240" stroke="#bbb" stroke-width="6"/>
        <path d="M180 430c60-40 140-50 220-20" stroke="#aaa" stroke-width="8" fill="none"/>
      </svg>`,
    )
  )
}

const DEMO_SALE_PRODUCT =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" fill="none">
      <rect width="640" height="400" fill="#000"/>
      <path d="M80 240c50-70 120-120 220-110 90 8 150 70 200 120 25 25 55 45 80 40H140c-30 0-70-20-60-50z" fill="#1a1a1a" stroke="#333"/>
      <path d="M120 250c80-30 180-20 280 20" stroke="#39ff14" stroke-width="10" opacity=".85"/>
      <path d="M200 210c40-25 100-30 150-10" stroke="#39ff14" stroke-width="6" opacity=".5"/>
      <ellipse cx="420" cy="300" rx="70" ry="22" fill="#111" stroke="#222"/>
    </svg>`,
  )

function catSvg(a: string, b: string) {
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1100" fill="none">
        <rect width="900" height="1100" fill="${a}"/>
        <rect x="220" y="200" width="460" height="640" fill="${b}" opacity=".5"/>
      </svg>`,
    )
  )
}

function colors(model: StorefrontRenderModel) {
  return {
    primary: model.brand_colors?.primary || CAP.primary,
    accent: model.brand_colors?.accent || CAP.secondary,
    background: model.brand_colors?.background || CAP.bg,
    text: model.brand_colors?.text || CAP.primary,
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
    const id = 'capsule-inter-font'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        background: c.background || CAP.bg,
        color: c.text,
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
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

function BtnPrimary({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center bg-black px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-white transition hover:bg-neutral-800"
    >
      {children}
    </a>
  )
}

function BtnSecondary({ href, children, light = false }: { href: string; children: ReactNode; light?: boolean }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center border px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.06em] transition ${
        light
          ? 'border-white text-white hover:bg-white hover:text-black'
          : 'border-black text-black hover:bg-black hover:text-white'
      }`}
    >
      {children}
    </a>
  )
}

function ProductCard({
  product,
  brandHint,
  imageFallback,
}: {
  product: StorefrontRenderProduct
  brandHint: string
  imageFallback: string
}) {
  const shop = useShop()
  return (
    <article className="group flex h-full min-w-0 flex-col bg-[#f4f4f4]">
      <div className="relative aspect-[3/4] overflow-hidden bg-[#efefef]">
        <button type="button" className="grid h-full w-full place-items-center p-4 text-left" onClick={() => shop?.openProduct(product)}>
          <img
            src={product.image_url || imageFallback}
            alt=""
            className="max-h-full max-w-full object-contain transition duration-500 group-hover:scale-[1.02]"
          />
        </button>
        <button
          type="button"
          aria-label="Add to cart"
          className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center bg-white text-black opacity-0 shadow-sm transition group-hover:opacity-100"
          onClick={() => shop?.addToCart(product)}
        >
          <span className="text-[14px] leading-none tracking-widest">⋮</span>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-0 pb-2 pt-3">
        <div className="text-[11px] text-[#8a8a8a]">{brandHint}</div>
        <button type="button" className="text-left" onClick={() => shop?.openProduct(product)}>
          <h3 className="text-[14px] font-semibold leading-snug text-black">{product.name}</h3>
        </button>
        <div className="text-[14px] text-black">{formatRupiah(product.price)}</div>
      </div>
    </article>
  )
}

/** Horizontal product carousel — demo: 6 desktop, ~1px gutters, circular arrows */
function ProductCarousel({
  products,
  id,
}: {
  products: StorefrontRenderProduct[]
  id: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-card]')
    const w = card ? card.offsetWidth + 1 : el.clientWidth / 6
    el.scrollBy({ left: dir * w * 2, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Previous"
        className="absolute left-1 top-[32%] z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-white text-[18px] text-black shadow-sm lg:grid"
        onClick={() => scrollBy(-1)}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next"
        className="absolute right-1 top-[32%] z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-white text-[18px] text-black shadow-sm lg:grid"
        onClick={() => scrollBy(1)}
      >
        ›
      </button>
      <div
        id={id}
        ref={ref}
        className="flex overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ gap: '1px' }}
      >
        {products.map((p, i) => (
          <div
            key={`${id}-${p.id}`}
            data-card
            className="w-[calc((100%-1px)/2)] shrink-0 sm:w-[calc((100%-2px)/3)] lg:w-[calc((100%-3px)/4)] xl:w-[calc((100%-5px)/6)]"
          >
            <ProductCard product={p} brandHint={BRANDS[i % BRANDS.length]!} imageFallback={DEMO_PRODUCT_IMGS[i % DEMO_PRODUCT_IMGS.length]!} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionHeader({
  title,
  body,
  actionHref,
  actionLabel = 'Shop all',
}: {
  title: string
  body?: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className={CAP.frame}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[28px] font-semibold leading-none tracking-tight text-black sm:text-[32px]">{title}</h2>
        {actionHref ? (
          <a href={actionHref} className="shrink-0 pt-1 text-[14px] font-medium text-black">
            {actionLabel}
          </a>
        ) : null}
      </div>
      {body ? <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[#525252]">{body}</p> : null}
    </div>
  )
}

export function ShopCapsule({ model }: { model: StorefrontRenderModel }) {
  const content = theme(model)
  const shop = useShop()
  const [navSolid, setNavSolid] = useState(false)
  const [slide, setSlide] = useState(0)
  const [activeCat, setActiveCat] = useState(0)

  const catalog = useMemo(() => {
    if (model.products?.length) return model.products
    return DEMO_PRODUCT_NAMES.map((name, i) => ({
      id: -(i + 1),
      name,
      description: '',
      price: [1290000, 280000, 990000, 1290000, 890000, 1490000, 1090000, 1390000, 270000, 990000, 1000000, 310000][i] ?? 990000,
      image_url: DEMO_PRODUCT_IMGS[i % DEMO_PRODUCT_IMGS.length],
      is_new_arrival: i < 8,
      is_bestseller: i % 2 === 0,
    }))
  }, [model.products])

  const latest = (() => {
    const hits = catalog.filter((p) => p.is_new_arrival)
    return (hits.length ? hits : catalog).slice(0, 12)
  })()
  const bestsellers = (() => {
    const hits = catalog.filter((p) => p.is_bestseller)
    return (hits.length ? hits : catalog).slice(0, 12)
  })()
  const campaignProducts = catalog.slice(0, 8)

  const heroCta = slotText(content, 'hero_cta', 'Shop Collection')
  const heroCtaSecondary = slotText(content, 'hero_cta_secondary', 'View All items')
  const dropTitle = slotText(content, 'drop_title', 'Latest Drop')
  const campaignKicker = slotText(content, 'campaign_kicker', "FW’25")
  const campaignTitle = slotText(content, 'campaign_title', 'Built on Better, Stronger Basics')
  const campaignBody = slotText(
    content,
    'campaign_body',
    'Core pieces upgraded with stronger materials and refined tailoring. Made to perform consistently across seasons.',
  )
  const campaignCta = slotText(content, 'campaign_cta', 'Shop Collection')
  const bestsellersTitle = slotText(content, 'bestsellers_title', 'Bestsellers')
  const bestsellersBody = slotText(
    content,
    'bestsellers_body',
    'The most purchased styles across categories, chosen for design, function, and durability.',
  )
  const reviewsTitle = slotText(content, 'reviews_title', 'Rated by Customers')
  const storiesTitle = slotText(content, 'stories_title', 'Latest Stories')

  const heroSlides = useMemo(() => {
    const fromSlot = Array.isArray(content.hero_slides) ? content.hero_slides : []
    const slides = fromSlot
      .filter((s): s is { image?: string; title?: string } => !!s && typeof s === 'object')
      .map((s, i) => ({
        image: typeof s.image === 'string' && s.image ? s.image : DEMO_HERO_IMGS[i % DEMO_HERO_IMGS.length]!,
        title: (typeof s.title === 'string' && s.title.trim()) || DEFAULT_HERO[i] || DEFAULT_HERO[0]!,
      }))
    if (slides.length) return slides.slice(0, 3)
    const single = typeof content.hero_image === 'string' && content.hero_image ? content.hero_image : null
    const headline = slotText(content, 'hero_headline', DEFAULT_HERO[0]!)
    return DEFAULT_HERO.map((title, i) => ({
      image: i === 0 && single ? single : DEMO_HERO_IMGS[i]!,
      title: i === 0 ? headline : title,
    }))
  }, [content])

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (heroSlides.length < 2) return
    const id = window.setInterval(() => setSlide((s) => (s + 1) % heroSlides.length), 5000)
    return () => window.clearInterval(id)
  }, [heroSlides.length])

  const categoryBodies = lines(
    slotText(
      content,
      'category_bodies',
      DEFAULT_CATS.map((c) => c.body).join('\n'),
    ),
  )

  const categoryItems = (() => {
    const fromSlot = Array.isArray(content.categories) ? content.categories : []
    if (fromSlot.length > 0) {
      return fromSlot.slice(0, 3).map((row, index) => ({
        key: `cat-${index}`,
        label:
          typeof row === 'object' && row && 'label' in row && typeof row.label === 'string' && row.label.trim()
            ? row.label
            : DEFAULT_CATS[index]?.label || `Kategori ${index + 1}`,
        body: categoryBodies[index] || DEFAULT_CATS[index]?.body || '',
        image:
          typeof row === 'object' && row && 'image' in row && typeof row.image === 'string' && row.image
            ? row.image
            : DEMO_CAT_IMGS[index] || DEMO_CAT_IMGS[0]!,
      }))
    }
    return DEFAULT_CATS.map((cat, index) => ({
      key: `demo-${index}`,
      label: cat.label,
      body: categoryBodies[index] || cat.body,
      image: DEMO_CAT_IMGS[index]!,
    }))
  })()

  const reviews = lines(
    slotText(
      content,
      'reviews_body',
      "Great Fit|Fits comfortably and feels well balanced for everyday wear. The shape holds up nicely throughout the entire day.|Daniel R., about Long Sleeve Crewneck Sweatshirt\nWeather Ready|Lightweight but still protective. It works well for windy or light rainy days when you need an easy outer layer.|Marcus L., about Lightweight Hooded Windbreaker\nSoft Warmth|Comfortable and warm without being too heavy. Works great for cooler days and relaxed casual layering.|Alex K., about Sherpa Zip Fleece Jacket\nClean Style|Simple design that pairs easily with different outfits. The fit is accurate, comfortable, and easy to wear.|Jordan M., about Zip Front Bomber Jacket",
    ),
  )
    .slice(0, 4)
    .map((line, i) => {
      const [title, quote, name] = line.split('|').map((p) => p.trim())
      return {
        title: title || 'Review',
        quote: quote || line,
        name: name || '',
        image: catalog[i]?.image_url || DEMO_PRODUCT_IMGS[i]!,
      }
    })

  const storyTitles = lines(
    slotText(
      content,
      'stories_titles',
      "This Is What the New Street Era Looks Like\nBuilt Different: The Rules Are Changing\nThe Standard Just Moved — And It’s Not Moving Back\nThis Isn’t a Trend Cycle. It’s a Shift in Direction.",
    ),
  ).slice(0, 4)

  const storyBodies = [
    'Streetwear is entering a sharper, more intentional phase. Clean cuts, stronger silhouettes, and deliberate design now…',
    'Fashion is no longer about blending in. Today’s direction favors clarity, structure, and a distinct point…',
    'What once felt progressive now feels outdated. The new benchmark is precision, restraint, and confidence in…',
    'Seasonal updates are giving way to long-term change. Design choices now reflect a deeper evolution in…',
  ]

  const storyImages = (Array.isArray(content.gallery) ? content.gallery : []).filter(
    (u): u is string => typeof u === 'string' && !!u,
  )

  const trust = [
    slotText(content, 'trust_1', 'Secure Checkout & Buyer Protection'),
    slotText(content, 'trust_2', 'Free Express Shipping Over Rp 250.000'),
    slotText(content, 'trust_3', '30-Day Hassle-Free Returns'),
    slotText(content, 'trust_4', '24/7 Always-On Support'),
  ]

  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Features',
    links:
      'Standard Post | #drop\nOverlay Post | #drop\nStandard Product | #drop\nVariable Product | #drop\nDiscounted Product | #drop',
  })
  const footerCol2DefaultLinks =
    categoryItems.length > 0
      ? categoryItems.map((c) => `${c.label} | #categories`).join('\n')
      : 'Tops | #categories\nBottoms | #categories\nAccessories | #categories'
  const footerCol2 = readFooterColumn(content, 2, {
    title: 'Categories',
    links: footerCol2DefaultLinks,
  })
  const footerCol3 = readFooterColumn(content, 3, {
    title: 'Pages',
    links: 'Cart | cart\nCheckout | checkout\nMy Account | account\nBlog | #stories\nAbout | #hero\nContact | #stories',
  })
  const footerLegal = readFooterLegal(content, 'Privacy Policy | #\nTerms of Use | #')

  const nav = [
    { href: '#drop', label: 'Catalog' },
    { href: '#categories', label: 'Shop' },
    { href: '#bestsellers', label: 'Most popular' },
    { href: '#stories', label: 'Blog' },
  ]

  const active = heroSlides[slide] ?? heroSlides[0]!

  return (
    <Shell model={model}>
      {/* Header — 80px, transparent over hero then solid */}
      <header
        className={`sticky top-0 z-40 transition ${
          navSolid ? 'border-b border-[#e8e8e8] bg-white/95 backdrop-blur-md' : 'bg-transparent'
        }`}
        style={{ height: 80, marginBottom: -80 }}
      >
        <div className={`${CAP.frame} grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3`}>
          <a
            href="#hero"
            className={`justify-self-start text-[15px] font-semibold tracking-[0.04em] uppercase ${
              navSolid ? 'text-black' : 'text-white'
            }`}
          >
            {model.logo_url ? (
              <img
                src={model.logo_url}
                alt=""
                className={`h-7 w-auto max-w-[140px] object-contain ${navSolid ? '' : 'brightness-0 invert'}`}
              />
            ) : (
              model.title || 'Capsule'
            )}
          </a>
          <nav
            className={`hidden items-center gap-7 text-[13px] font-medium md:flex ${
              navSolid ? 'text-black' : 'text-white'
            }`}
          >
            {nav.map((item) => (
              <a key={item.label} href={item.href} className="opacity-90 transition hover:opacity-100">
                {item.label}
              </a>
            ))}
          </nav>
          <div
            className={`flex items-center justify-end gap-4 text-[13px] font-medium ${
              navSolid ? 'text-black' : 'text-white'
            }`}
          >
            <button type="button" className="hidden sm:inline" aria-label="Search">
              Search
            </button>
            <button type="button" onClick={() => (shop?.customer ? shop.openAccount() : shop?.openLogin())}>
              Login
            </button>
            <button type="button" onClick={() => shop?.openCart()}>
              {shop?.cartCount ?? 0}
            </button>
          </div>
        </div>
      </header>

      {/* Hero slider — full bleed, content stick-bottom, uppercase */}
      <section id="hero" className="relative min-h-[100svh] overflow-hidden bg-black text-white">
        <div className="absolute inset-0">
          {heroSlides.map((s, i) => (
            <img
              key={s.title + i}
              src={s.image}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                i === slide ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-black/40" />
        </div>
        <div className={`${CAP.frame} relative z-10 flex min-h-[100svh] flex-col justify-end pb-16 pt-28 sm:pb-20`}>
          <h1 className="max-w-[18ch] text-[34px] font-medium uppercase leading-[1.08] tracking-tight sm:text-[42px] lg:text-[48px]">
            {active.title}
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <BtnPrimary href="#categories">{heroCta}</BtnPrimary>
            <BtnSecondary href="#drop" light>
              {heroCtaSecondary}
            </BtnSecondary>
          </div>
          {heroSlides.length > 1 ? (
            <div className="mt-10 flex gap-2">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  className={`h-[2px] w-8 transition ${i === slide ? 'bg-white' : 'bg-white/40'}`}
                  onClick={() => setSlide(i)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Latest Drop — carousel 6-up / gap 2px */}
      <section id="drop" className="bg-[#f4f4f4] py-12 sm:py-14">
        <SectionHeader title={dropTitle} actionHref="#bestsellers" />
        <div className={`${CAP.frame} mt-7`}>
          <ProductCarousel products={latest} id="cap-drop" />
        </div>
      </section>

      {/* FW’25 campaign — centered editorial + feature icons + carousel */}
      <section className="bg-white py-14 sm:py-16">
        <div className={`${CAP.content} px-4 text-center`}>
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-black">{campaignKicker}</p>
          <h2 className="mt-4 text-[28px] font-medium uppercase leading-tight tracking-tight sm:text-[36px] lg:text-[42px]">
            {campaignTitle}
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-[#525252]">{campaignBody}</p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-3 aspect-square max-w-[88px] overflow-hidden bg-[#f4f4f4]">
                  {typeof content.campaign_image === 'string' && content.campaign_image && i === 1 ? (
                    <img src={content.campaign_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <img src={DEMO_PRODUCT_IMGS[i]!} alt="" className="h-full w-full object-cover opacity-90" />
                  )}
                </div>
                <div className="text-[12px] text-[#525252]">Lightweight Comfort</div>
              </div>
            ))}
          </div>
        </div>
        <div className={`${CAP.frame} mt-12`}>
          <ProductCarousel products={campaignProducts} id="cap-campaign" />
        </div>
        <div className="mt-10 flex justify-center">
          <BtnPrimary href="#bestsellers">{campaignCta}</BtnPrimary>
        </div>
      </section>

      {/* Categories — full-bleed tabbed banner (demo: left tabs + body + white CTA) */}
      <section id="categories" className="relative min-h-[78vh] overflow-hidden bg-neutral-900 text-white sm:min-h-[88vh]">
        {categoryItems.map((cat, i) => (
          <img
            key={cat.key}
            src={cat.image}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              i === activeCat ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
        <div className={`${CAP.frame} relative z-10 flex min-h-[78vh] flex-col justify-center py-16 sm:min-h-[88vh]`}>
          <div className="max-w-md">
            <div className="flex flex-wrap gap-6 sm:gap-8">
              {categoryItems.map((cat, i) => (
                <button
                  key={cat.key}
                  type="button"
                  className={`text-[18px] font-medium transition sm:text-[22px] ${
                    i === activeCat ? 'text-white' : 'text-white/45 hover:text-white/70'
                  }`}
                  onClick={() => setActiveCat(i)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <p className="mt-8 max-w-[280px] text-[14px] leading-relaxed text-white/90 sm:mt-10 sm:max-w-[300px] sm:text-[15px]">
              {categoryItems[activeCat]?.body}
            </p>
            <a
              href="#bestsellers"
              className="mt-8 inline-flex bg-white px-5 py-3 text-[12px] font-extrabold uppercase tracking-[0.08em] text-black transition hover:bg-neutral-100"
            >
              Shop Collection
            </a>
          </div>
        </div>
      </section>

      {/* Bestsellers */}
      <section id="bestsellers" className="bg-[#f4f4f4] py-12 sm:py-14">
        <SectionHeader title={bestsellersTitle} body={bestsellersBody} actionHref="#drop" />
        <div className={`${CAP.frame} mt-7`}>
          <ProductCarousel products={bestsellers} id="cap-best" />
        </div>
      </section>

      {/* Promo pair — Sale (product on black) + New Drop (lifestyle), badge top, underline CTA */}
      <section className="grid lg:grid-cols-2">
        {[
          {
            kicker: slotText(content, 'sale_kicker', 'Sale'),
            title: slotText(content, 'sale_title', 'Power in Motion'),
            body: slotText(
              content,
              'sale_body',
              'High-performance footwear built with advanced cushioning, responsive support, and durable construction.',
            ),
            cta: slotText(content, 'sale_cta', 'Explore sale'),
            image: typeof content.sale_image === 'string' ? content.sale_image : DEMO_SALE_PRODUCT,
            mode: 'product' as const,
          },
          {
            kicker: slotText(content, 'newdrop_kicker', 'New Drop'),
            title: slotText(content, 'newdrop_title', 'New Drop. New Rules.'),
            body: slotText(
              content,
              'newdrop_body',
              'New season pieces added to the collection, available in updated colors and fits.',
            ),
            cta: slotText(content, 'newdrop_cta', 'Explore sale'),
            image: typeof content.newdrop_image === 'string' ? content.newdrop_image : DEMO_HERO_IMGS[2]!,
            mode: 'lifestyle' as const,
          },
        ].map((card) => (
          <div
            key={card.title}
            className={`relative flex min-h-[520px] flex-col items-center overflow-hidden px-6 pb-10 pt-8 text-center text-white sm:min-h-[560px] sm:px-10 sm:pb-12 sm:pt-10 ${
              card.mode === 'product' ? 'bg-black' : 'bg-neutral-900'
            }`}
          >
            {card.mode === 'lifestyle' ? (
              <>
                <img src={card.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/25" />
              </>
            ) : null}

            <div className="relative z-10 inline-flex bg-white px-2.5 py-1 text-[11px] font-medium text-black">
              {card.kicker}
            </div>

            {card.mode === 'product' ? (
              <div className="relative z-10 flex flex-1 items-center justify-center py-8">
                <img src={card.image} alt="" className="max-h-[240px] w-auto max-w-[70%] object-contain sm:max-h-[280px]" />
              </div>
            ) : (
              <div className="relative z-10 flex-1" />
            )}

            <div className="relative z-10 mt-auto max-w-md">
              <h3 className="text-[26px] font-semibold uppercase leading-tight tracking-tight sm:text-[32px]">{card.title}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-white/80 sm:text-[14px]">{card.body}</p>
              <a href="#drop" className="mt-5 inline-block text-[14px] text-white underline underline-offset-4">
                {card.cta}
              </a>
            </div>
          </div>
        ))}
      </section>

      {/* Rated by Customers — quote + product thumb */}
      <section className="bg-white py-14 sm:py-16">
        <h2 className={`${CAP.frame} text-[28px] font-medium tracking-tight sm:text-[32px]`}>{reviewsTitle}</h2>
        <div className={`${CAP.frame} mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4`}>
          {reviews.map((r) => (
            <blockquote key={r.title} className="flex flex-col">
              <p className="text-[16px] font-medium text-[#525252]">{r.title}</p>
              <p className="mt-3 flex-1 text-[18px] leading-snug text-black sm:text-[20px]">“{r.quote}”</p>
              <p className="mt-6 text-[13px] text-[#525252]">{r.name}</p>
              <div className="mt-4 aspect-[3/4] max-w-[120px] overflow-hidden bg-[#ececec]">
                <img src={r.image} alt="" className="h-full w-full object-cover" />
              </div>
            </blockquote>
          ))}
        </div>
      </section>

      {/* Latest Stories */}
      <section id="stories" className="bg-[#f4f4f4] py-14 sm:py-16">
        <div className={`${CAP.frame} flex items-end justify-between gap-4`}>
          <h2 className="text-[28px] font-medium tracking-tight sm:text-[32px]">{storiesTitle}</h2>
          <span className="text-[13px] font-medium text-black">Read all</span>
        </div>
        <div className={`${CAP.frame} mt-8 grid gap-[1px] sm:grid-cols-2 lg:grid-cols-4`}>
          {storyTitles.map((title, i) => (
            <article key={title} className="bg-white">
              <div className="aspect-[4/3] overflow-hidden bg-[#e8e8e8]">
                {storyImages[i] ? (
                  <img src={storyImages[i]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: `hsl(30 6% ${72 - i * 5}%)` }} />
                )}
              </div>
              <div className="p-4 sm:p-5">
                <div className="text-[12px] text-[#525252]">March 9, 2026</div>
                <h3 className="mt-2 text-[16px] font-medium leading-snug text-black">{title}</h3>
                <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#525252]">{storyBodies[i]}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer — trust bar + black brand footer (demo match) */}
      <footer className="bg-black text-white">
        <div className="border-b border-white/10 bg-[#1a1a1a]">
          <div className={`${CAP.frame} flex flex-wrap items-center justify-center gap-y-2 py-3.5 text-[12px] text-white/90 lg:justify-between lg:text-[13px]`}>
            {trust.map((item, i) => (
              <div key={item} className="contents">
                {i > 0 ? (
                  <span className="mx-3 hidden text-white/30 lg:inline" aria-hidden>
                    •
                  </span>
                ) : null}
                <span className="mx-2 inline-flex items-center gap-2 whitespace-nowrap lg:mx-0">
                  <TrustIcon index={i} />
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${CAP.frame} flex flex-col gap-12 py-14 lg:flex-row lg:items-start lg:justify-between lg:gap-20 lg:py-16`}>
          <div className="shrink-0">
            {model.logo_url ? (
              <img src={model.logo_url} alt="" className="h-10 w-auto max-w-[220px] object-contain brightness-0 invert" />
            ) : (
              <div className="text-[42px] font-semibold lowercase leading-none tracking-tight sm:text-[52px]">
                {(model.title || 'capsule').toLowerCase().replace(/\.$/, '')}.
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-14 lg:gap-16">
            {[footerCol1, footerCol2, footerCol3].map((col) => (
              <div key={col.title}>
                <div className="text-[13px] font-medium text-white">{col.title}</div>
                <FooterLinkList
                  links={col.links}
                  className="mt-4 space-y-2.5 text-[13px] text-white/55"
                  itemClassName="transition hover:text-white"
                />
              </div>
            ))}
          </div>
        </div>

        <div className={`${CAP.frame} flex flex-col gap-4 border-t border-white/10 py-5 text-[12px] text-white/50 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            © {new Date().getFullYear()} — {model.title || 'Capsule'}. All Rights Reserved.
          </div>
          <div className="flex items-center gap-3 text-white/80">
            <span className="font-medium text-white">Stay Tuned</span>
            <span className="inline-flex gap-3 text-[14px]" aria-hidden>
              <span>○</span>
              <span>◎</span>
              <span>✕</span>
            </span>
          </div>
          <FooterLinkList
            links={footerLegal}
            inline
            className="flex gap-5"
            itemClassName="underline underline-offset-2 hover:text-white"
          />
        </div>
      </footer>
    </Shell>
  )
}

function TrustIcon({ index }: { index: number }) {
  const common = 'h-4 w-4 shrink-0 opacity-90'
  if (index === 0) {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="10" width="16" height="10" rx="1" />
        <path d="M8 10V7a4 4 0 018 0v3" />
      </svg>
    )
  }
  if (index === 1) {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7V10z" />
        <circle cx="7" cy="18" r="1.5" />
        <circle cx="17" cy="18" r="1.5" />
      </svg>
    )
  }
  if (index === 2) {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 12a8 8 0 0114.5-4.5M20 12a8 8 0 01-14.5 4.5" />
        <path d="M18 3v5h-5M6 21v-5h5" />
      </svg>
    )
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 014.5 1.5c0 1.5-2.5 2-2.5 3.5M12 17h.01" />
    </svg>
  )
}
