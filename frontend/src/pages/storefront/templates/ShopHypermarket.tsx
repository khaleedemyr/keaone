import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatRupiah } from '../../../lib/money'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import { useShop } from '../commerce/StorefrontShop'
import type { StorefrontRenderModel, StorefrontRenderProduct } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { readFooterColumn, readFooterLegal } from '../lib/footerLinks'

/** Soft product-like SVG demos so empty slots still look like the Hypermarket reference. */
const DEMO_CAT = {
  kitchen:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none">
        <ellipse cx="120" cy="100" rx="78" ry="48" fill="#c4a574"/>
        <ellipse cx="120" cy="96" rx="70" ry="42" fill="#e8d4b0"/>
        <ellipse cx="120" cy="96" rx="52" ry="28" fill="#f3e6cf"/>
        <rect x="148" y="48" width="6" height="52" rx="2" fill="#8b7355"/>
        <rect x="160" y="56" width="5" height="44" rx="2" fill="#8b7355"/>
        <rect x="172" y="62" width="5" height="38" rx="2" fill="#8b7355"/>
        <path d="M151 48h18M162 56h14M174 62h12" stroke="#c0c0c0" stroke-width="3" stroke-linecap="round"/>
      </svg>`,
    ),
  books:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none">
        <rect x="70" y="70" width="100" height="14" rx="1" fill="#f5f5f5" stroke="#ddd"/>
        <rect x="74" y="84" width="100" height="14" rx="1" fill="#fafafa" stroke="#ddd"/>
        <rect x="78" y="98" width="100" height="14" rx="1" fill="#fff" stroke="#ddd"/>
        <path d="M155 40c18 22 18 48 0 70" stroke="#c9a227" stroke-width="10" stroke-linecap="round" fill="none"/>
        <circle cx="155" cy="40" r="6" fill="#c9a227"/>
      </svg>`,
    ),
  office:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none">
        <ellipse cx="120" cy="130" rx="36" ry="8" fill="#d4a574" opacity=".35"/>
        <circle cx="120" cy="95" r="42" fill="#b87333"/>
        <circle cx="120" cy="95" r="32" fill="#1a1a1a"/>
        <circle cx="120" cy="95" r="3" fill="#eee"/>
        <circle cx="92" cy="62" r="14" fill="none" stroke="#b87333" stroke-width="5"/>
        <circle cx="148" cy="62" r="14" fill="none" stroke="#b87333" stroke-width="5"/>
        <rect x="116" y="48" width="8" height="12" fill="#b87333"/>
      </svg>`,
    ),
  play:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none">
        <path d="M100 50c0-8 6-14 14-14s14 6 14 14v20h-28V50z" fill="#c4a06a"/>
        <path d="M90 70h60l8 55H82l8-55z" fill="#d4b483"/>
        <path d="M95 125h10v30H95zm40 0h10v30h-10z" fill="#c4a06a"/>
        <circle cx="108" cy="88" r="4" fill="#a07848"/>
        <circle cx="132" cy="88" r="4" fill="#a07848"/>
        <circle cx="120" cy="102" r="4" fill="#a07848"/>
      </svg>`,
    ),
} as const

const DEMO_PRODUCT =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
      <rect width="200" height="200" fill="#f7f7f7"/>
      <rect x="55" y="70" width="90" height="70" rx="4" fill="#e8e8e8"/>
      <rect x="70" y="55" width="60" height="20" rx="2" fill="#dedede"/>
    </svg>`,
  )

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return {
      primary: '#6ba8c4',
      accent: '#c45c26',
      background: '#ffffff',
      text: '#222222',
    }
  }
  return {
    primary: model.brand_colors.primary || '#6ba8c4',
    accent: model.brand_colors.accent || '#c45c26',
    background: model.brand_colors.background || '#ffffff',
    text: model.brand_colors.text || '#222222',
  }
}

function theme(model: StorefrontRenderModel) {
  return model.theme_content ?? {}
}

function slotText(content: Record<string, unknown>, key: string, fallback: string) {
  const value = content[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

/** Hypermarket demo scale: wide content frame, not edge-stretched. */
const HM_FRAME = 'mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-10'
const HM_FRAME_TIGHT = 'mx-auto w-full max-w-[1520px] px-3 sm:px-4 lg:px-6'

function Shell({ model, children }: { model: StorefrontRenderModel; children: ReactNode }) {
  const c = colors(model)
  return (
    <div className="min-h-screen font-sans antialiased" style={{ background: c.background, color: c.text }}>
      {model.preview ? (
        <div className="sticky top-0 z-30 border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function useOfferCountdown(deadlineRaw: string) {
  const target = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(deadlineRaw)) return null
    const d = new Date(`${deadlineRaw.slice(0, 10)}T23:59:59`)
    return Number.isNaN(d.getTime()) ? null : d.getTime()
  }, [deadlineRaw])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [target])

  if (!target) {
    return { days: '00', hours: '00', mins: '00', secs: '00' }
  }
  const diff = Math.max(0, target - now)
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { days: pad(days), hours: pad(hours), mins: pad(mins), secs: pad(secs) }
}

function Stars({ rating = 0 }: { rating?: number }) {
  const full = Math.round(rating)
  return (
    <div className="flex items-center gap-0.5 text-[11px]" style={{ color: '#f0b400' }} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? 'opacity-100' : 'opacity-25'}>
          ★
        </span>
      ))}
    </div>
  )
}

function ProductCard({ product }: { product: StorefrontRenderProduct }) {
  const shop = useShop()
  const onSale = Boolean(product.is_deal)
  return (
    <article className="group flex h-full flex-col bg-white text-center">
      <button type="button" className="relative block w-full text-left" onClick={() => shop?.openProduct(product)}>
        {onSale ? (
          <span className="absolute left-3 top-3 z-10 rounded bg-[#e85d4c] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Sale
          </span>
        ) : null}
        <div className="mx-auto flex aspect-square max-w-[220px] items-center justify-center bg-[#f7f7f7] p-6">
          <img
            src={product.image_url || DEMO_PRODUCT}
            alt=""
            className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="space-y-2 px-2 pb-1 pt-4">
          <Stars rating={product.avg_rating ?? 0} />
          <h3 className="text-[15px] font-normal tracking-tight text-neutral-800 transition group-hover:opacity-70">
            {product.name}
          </h3>
          <div className="text-[15px] font-medium text-neutral-900">{formatRupiah(product.price)}</div>
        </div>
      </button>
      <button
        type="button"
        className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline"
        onClick={() => shop?.addToCart(product)}
      >
        Add to cart
      </button>
    </article>
  )
}

const SAMPLE: StorefrontRenderProduct[] = [
  { id: -1, name: 'Black Sushi Tray', price: 150000, avg_rating: 5, review_count: 2, is_bestseller: true, is_deal: true },
  { id: -2, name: 'Zenbrew Tea Set', price: 178000, avg_rating: 3, review_count: 1, is_deal: true },
  { id: -3, name: 'Artisan Kettle', price: 45000, avg_rating: 4, review_count: 1 },
  { id: -4, name: 'Mini Matchbox', price: 16000, avg_rating: 5, review_count: 1, is_bestseller: true, is_deal: true },
  { id: -5, name: 'Aire Market Tote', price: 11050, avg_rating: 5, review_count: 2 },
  { id: -6, name: 'Japanese Teapot', price: 25000, avg_rating: 5, review_count: 1 },
  { id: -7, name: 'Watering Can', price: 24000, avg_rating: 5, review_count: 1 },
  { id: -8, name: 'Straight Razor', price: 25000, avg_rating: 4.5, review_count: 2 },
]

/**
 * Hypermarket-inspired boutique shop layout.
 * Visual language: centered uppercase nav, soft gray 2×2 category tiles
 * (title left + floating product image right), airy product grids.
 */
export function ShopHypermarket({ model }: { model: StorefrontRenderModel }) {
  const c = colors(model)
  const content = theme(model)
  const shop = useShop()
  const products = model.products?.length ? model.products : SAMPLE
  const cartCount = shop?.cartCount ?? 0

  const bestsellersTitle = slotText(content, 'bestsellers_title', 'Best Sellers')
  const topratedTitle = slotText(content, 'toprated_title', 'Top Rated')
  const offerKicker = slotText(content, 'offer_kicker', 'Special Offer -30%')
  const offerTitle = slotText(content, 'offer_title', 'Matte Black Slate Sushi Platter')
  const offerBody = slotText(content, 'offer_body', 'Limited-time deal on a customer favourite.')
  const offerOld = slotText(content, 'offer_price_old', 'Rp 210.000')
  const offerNew = slotText(content, 'offer_price_new', 'Rp 150.000')
  const offerCta = slotText(content, 'offer_cta', 'Shop now')
  const offerDeadline = typeof content.offer_deadline === 'string' ? content.offer_deadline.trim() : ''
  const countdown = useOfferCountdown(offerDeadline)
  const brandsTitle = slotText(content, 'brands_title', 'More brands')
  const brandsBody = slotText(
    content,
    'brands_body',
    'Lorem ipsum dolor sit amet, consectetur adipisicing elit.\nThoughtful tools for daily rituals and quiet spaces.\nDesign-led essentials for the modern home.',
  )
  const brandCards = brandsBody
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
  const footerTagline = slotText(content, 'footer_tagline', 'Everyday goods for kitchen, work, and play.')
  const supportPhone = slotText(content, 'support_phone', 'Need support? Call us')
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Quick Links',
    links: 'Home | #categories\nBest Sellers | #bestsellers\nTop Rated | #toprated\nCart | cart\nMy Account | account',
  })
  const footerLegal = readFooterLegal(content, 'Privacy Policy | #\nTerms of Use | #')

  const trust = [
    {
      title: slotText(content, 'trust_shipping_title', 'Free World-Wide Shipping'),
      body: slotText(content, 'trust_shipping_body', 'Free shipping on all orders over Rp 100.000'),
    },
    {
      title: slotText(content, 'trust_money_title', 'Money Back Guarantee'),
      body: slotText(content, 'trust_money_body', 'We return money within 30 days'),
    },
    {
      title: slotText(content, 'trust_support_title', '24/7 Online Support'),
      body: slotText(content, 'trust_support_body', 'Friendly 24/7 customer support'),
    },
    {
      title: slotText(content, 'trust_secure_title', 'Secure Online Payments'),
      body: slotText(content, 'trust_secure_body', 'SSL / Secure Certificate'),
    },
  ]

  const demoCats = [
    { key: 'kitchen', label: 'Kitchen', image: DEMO_CAT.kitchen, starting: 11050 },
    { key: 'books', label: 'Books', image: DEMO_CAT.books, starting: 20000 },
    { key: 'office', label: 'Office', image: DEMO_CAT.office, starting: 18000 },
    { key: 'play', label: 'Play', image: DEMO_CAT.play, starting: 15000 },
  ]

  const categoryItems = (() => {
    const fromSlot = Array.isArray(content.categories) ? content.categories : []
    if (fromSlot.length > 0) {
      return fromSlot.slice(0, 4).map((row, index) => {
        const demo = demoCats[index] ?? demoCats[0]
        const catId =
          typeof row === 'object' && row && 'category_id' in row ? Number(row.category_id) : 0
        const matched = products.find((p) => p.category_id && catId && p.category_id === catId)
        return {
          key: `cat-${index}`,
          label:
            typeof row === 'object' && row && 'label' in row && typeof row.label === 'string' && row.label.trim()
              ? row.label
              : demo.label,
          image:
            typeof row === 'object' && row && 'image' in row && typeof row.image === 'string' && row.image
              ? row.image
              : demo.image,
          starting: matched?.price ?? demo.starting,
        }
      })
    }
    return demoCats
  })()

  // Pad to 4 tiles for the 2×2 composition.
  while (categoryItems.length < 4) {
    categoryItems.push(demoCats[categoryItems.length]!)
  }

  const bestsellers = (() => {
    const hits = products.filter((p) => p.is_bestseller)
    return (hits.length ? hits : products).slice(0, 4)
  })()

  const toprated = [...products].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0)).slice(0, 8)

  const initials =
    model.title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => (w[0] ?? '').toUpperCase())
      .join(' / ') || 'H / M'

  const nav = [
    { href: '#categories', label: 'Home', active: true },
    { href: '#bestsellers', label: 'Shop' },
    { href: '#toprated', label: 'Pages' },
    { href: '#brands', label: 'Elements' },
    { href: '#trust', label: 'Blog' },
  ]

  return (
    <Shell model={model}>
      <header className="relative z-20 border-b border-transparent bg-white">
        <div className={`${HM_FRAME} grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-5`}>
          <a href="#categories" className="justify-self-start">
            {model.logo_url ? (
              <img src={model.logo_url} alt="" className="h-7 w-auto max-w-[140px] object-contain" />
            ) : (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium tracking-[0.12em] text-neutral-800">
                <span className="text-neutral-400">[</span>
                <span>{initials}</span>
                <span className="text-neutral-400">]</span>
              </span>
            )}
          </a>

          <nav className="hidden items-center gap-7 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 md:flex">
            {nav.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="transition hover:text-neutral-900"
                style={item.active ? { color: c.primary } : undefined}
              >
                {item.label}
                {item.label !== 'Home' && item.label !== 'Blog' ? (
                  <span className="ml-1 text-[8px] opacity-50">▾</span>
                ) : null}
              </a>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-4 text-neutral-700">
            <button type="button" className="grid h-8 w-8 place-items-center rounded-full hover:bg-neutral-100" aria-label="Account">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
              </svg>
            </button>
            <button
              type="button"
              className="relative grid h-8 w-8 place-items-center rounded-full hover:bg-neutral-100"
              aria-label="Cart"
              onClick={() => shop?.openCart()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 8h12l-1 11H7L6 8z" />
                <path d="M9 8V7a3 3 0 016 0v1" />
              </svg>
              {cartCount > 0 ? (
                <span
                  className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: c.primary }}
                >
                  {cartCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      {/* 2×2 category tiles — title left, floating product image right */}
      <section id="categories" className={`${HM_FRAME_TIGHT} pb-4 pt-1`}>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-5">
          {categoryItems.slice(0, 4).map((cat) => (
            <a
              key={cat.key}
              href="#bestsellers"
              className="group relative flex min-h-[220px] overflow-hidden bg-[#f6f6f6] px-7 py-8 transition hover:bg-[#f2f2f2] sm:min-h-[260px] lg:min-h-[300px] sm:px-10 sm:py-10"
            >
              <div className="relative z-10 max-w-[48%] pt-1">
                <h2 className="text-[28px] font-light leading-none tracking-tight text-neutral-800 sm:text-[34px]">
                  {cat.label}
                </h2>
                <p className="mt-3 text-[13px] font-normal text-neutral-400">
                  Starting from {formatRupiah(cat.starting)}
                </p>
              </div>
              <div className="pointer-events-none absolute inset-y-5 right-4 flex w-[52%] items-center justify-center sm:inset-y-6 sm:right-6">
                <img
                  src={cat.image}
                  alt=""
                  className="max-h-full max-w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.08)] transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
            </a>
          ))}
        </div>
      </section>

      <section id="bestsellers" className={`${HM_FRAME} py-12`}>
        <h2 className="mb-10 text-center text-[28px] font-light tracking-tight text-neutral-800 sm:text-[32px]">
          {bestsellersTitle}
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 lg:gap-x-8">
          {bestsellers.map((p) => (
            <ProductCard key={`bs-${p.id}`} product={p} />
          ))}
        </div>
      </section>

      <section className="bg-[#1c1c1c] text-white">
        <div className={`${HM_FRAME} grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-16`}>
          <div className="flex aspect-[5/4] items-center justify-center bg-[#2a2a2a] p-10">
            <img
              src={typeof content.offer_image === 'string' && content.offer_image ? content.offer_image : DEMO_PRODUCT}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="space-y-5">
            <div className="text-[12px] font-medium uppercase tracking-[0.22em]" style={{ color: c.accent }}>
              {offerKicker}
            </div>
            <h2 className="text-[30px] font-light leading-tight tracking-tight sm:text-[36px]">{offerTitle}</h2>
            <p className="max-w-md text-sm leading-relaxed text-white/55">{offerBody}</p>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-sm text-white/35 line-through">{offerOld}</span>
              <span className="text-[28px] font-medium" style={{ color: c.accent }}>
                {offerNew}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {(
                [
                  ['Days', countdown.days],
                  ['Hours', countdown.hours],
                  ['Mins', countdown.mins],
                  ['Secs', countdown.secs],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="min-w-[4.5rem] border border-white/15 bg-white/5 px-3 py-2.5 text-center">
                  <div className="text-xl font-light tabular-nums tracking-wide">{value}</div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-white/40">{label}</div>
                </div>
              ))}
            </div>
            <a
              href="#toprated"
              className="inline-flex border border-white/30 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-neutral-900"
            >
              {offerCta}
            </a>
          </div>
        </div>
      </section>

      <section id="toprated" className={`${HM_FRAME} py-14`}>
        <h2 className="mb-10 text-center text-[28px] font-light tracking-tight text-neutral-800 sm:text-[32px]">
          {topratedTitle}
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 lg:gap-x-8">
          {toprated.map((p) => (
            <ProductCard key={`tr-${p.id}`} product={p} />
          ))}
        </div>
      </section>

      <section id="brands" className="border-y border-neutral-100 bg-[#fafafa]">
        <div className={`${HM_FRAME} py-14`}>
          <h2 className="mb-10 text-center text-[28px] font-light tracking-tight text-neutral-800 sm:text-[32px]">
            {brandsTitle}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {brandCards.map((text) => (
              <div key={text} className="bg-white px-6 py-7 text-[13px] leading-relaxed text-neutral-500 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className={`${HM_FRAME} py-14`}>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map((item) => (
            <div key={item.title} className="text-center sm:text-left">
              <div
                className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full text-sm text-white sm:mx-0"
                style={{ background: c.primary }}
              >
                ✓
              </div>
              <div className="text-[14px] font-medium text-neutral-800">{item.title}</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-neutral-400">{item.body}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-neutral-100 bg-white">
        <div className={`${HM_FRAME} grid gap-10 py-12 text-sm md:grid-cols-4`}>
          <div>
            <div className="text-[13px] font-medium tracking-[0.08em] text-neutral-800">
              [ {initials} ]
            </div>
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-neutral-400">{footerTagline}</p>
            <p className="mt-4 text-[12px] text-neutral-500">
              {supportPhone}
              {model.contact_phone ? ` · ${model.contact_phone}` : ''}
            </p>
          </div>
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-800">{footerCol1.title}</div>
            <FooterLinkList
              links={footerCol1.links}
              className="mt-3 space-y-1.5 text-[12px] text-neutral-400"
              itemClassName="transition hover:text-neutral-700"
            />
          </div>
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-800">Customer Care</div>
            <div className="mt-3 space-y-1.5 text-[12px] text-neutral-400">
              <div>{model.contact_email || 'Email belum diisi'}</div>
              <div>{model.contact_address || 'Alamat belum diisi'}</div>
            </div>
          </div>
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-800">Payment Methods</div>
            <div className="mt-3 text-[12px] leading-relaxed text-neutral-400">
              {(model.bank_accounts?.length ?? 0) > 0
                ? model.bank_accounts!.map((b) => `${b.bank_name}`).join(' · ')
                : 'Bank transfer after checkout'}
            </div>
          </div>
        </div>
        <div className={`${HM_FRAME} flex flex-col gap-3 border-t border-neutral-50 py-4 text-[11px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            © {new Date().getFullYear()} {model.title || 'Hypermarket'}
          </div>
          <FooterLinkList links={footerLegal} inline className="flex gap-4" itemClassName="hover:text-neutral-700" />
        </div>
      </footer>
    </Shell>
  )
}