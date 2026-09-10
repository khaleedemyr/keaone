import { useEffect, useState, type ReactNode } from 'react'
import { formatRupiah } from '../../../lib/money'
import type { StorefrontThemeContent } from '../types'
import { cartSubtotal } from '../lib/cart'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import { EDITORIAL_DEMO } from './editorialDemo'
import { ProductSocialMeta } from './ProductSocialMeta'
import { ShopHypermarket } from './ShopHypermarket'
import { ShopCapsule } from './ShopCapsule'
import { ShopSophia } from './ShopSophia'
import { ShopMizu } from './ShopMizu'
import { ShopAvalon } from './ShopAvalon'
import { useShop } from '../commerce/StorefrontShop'
import type { StorefrontRenderModel, StorefrontRenderProduct } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { readFooterColumn, readFooterLegal } from '../lib/footerLinks'

export type { StorefrontRenderModel, StorefrontRenderProduct } from './renderTypes'

const SAMPLE_PRODUCTS: StorefrontRenderProduct[] = [
  { id: -1, name: 'Form 01 - Button Shirt', description: 'Soft cotton layer for everyday wear.', price: 699000 },
  { id: -2, name: 'Form 07 - Cocoon Jacket', description: 'Relaxed outer with flared silhouette.', price: 769000 },
  { id: -3, name: 'Form 17 - Poplin Shirt', description: 'Clean column cut for layering.', price: 699000 },
  { id: -4, name: 'Form 22 - Long Vest', description: 'Structured vest for cooler days.', price: 789000 },
  { id: -5, name: 'Form 38 - Linea Bermuda', description: 'Tailored short for warm weather.', price: 530000 },
  { id: -6, name: 'Form 39 - Whisper Tee', description: 'Lightweight essential top.', price: 279000 },
  { id: -7, name: 'Form 40 - Oversized Shirt', description: 'Relaxed fit with soft drape.', price: 589000 },
  { id: -8, name: 'Form 36 - Stud Jacket', description: 'Statement outer with subtle detail.', price: 698000 },
]

function colors(model: StorefrontRenderModel) {
  if (model.template_key === 'shop_editorial' && !model.brand_colors?.primary) {
    return {
      primary: '#111111',
      accent: '#6b6b6b',
      background: '#f7f5f2',
      text: '#171717',
    }
  }

  if (model.template_key === 'shop_nexora' && !model.brand_colors?.primary) {
    return {
      primary: '#2158f5',
      accent: '#f5c518',
      background: '#ffffff',
      text: '#111827',
    }
  }

  if (model.template_key === 'shop_hypermarket' && !model.brand_colors?.primary) {
    return {
      primary: '#6ba8c4',
      accent: '#c45c26',
      background: '#ffffff',
      text: '#222222',
    }
  }

  if (model.template_key === 'shop_capsule' && !model.brand_colors?.primary) {
    return {
      primary: '#111111',
      accent: '#6b6b6b',
      background: '#ffffff',
      text: '#171717',
    }
  }

  if (model.template_key === 'shop_sophia' && !model.brand_colors?.primary) {
    return {
      primary: '#954e26',
      accent: '#da5d04',
      background: '#fdf6f2',
      text: '#0d0d0d',
    }
  }

  if (model.template_key === 'shop_mizu' && !model.brand_colors?.primary) {
    return {
      primary: '#232323',
      accent: '#7a7a7a',
      background: '#ffffff',
      text: '#232323',
    }
  }

  if (model.template_key === 'shop_avalon' && !model.brand_colors?.primary) {
    return {
      primary: '#da3f3f',
      accent: '#4c4c4c',
      background: '#ffffff',
      text: '#000000',
    }
  }

  return {
    primary: model.brand_colors?.primary || '#0f766e',
    accent: model.brand_colors?.accent || '#f59e0b',
    background: model.brand_colors?.background || '#f8fafc',
    text: model.brand_colors?.text || '#0f172a',
  }
}

function theme(model: StorefrontRenderModel): StorefrontThemeContent {
  return model.theme_content ?? {}
}

function BrandMark({ model, className = '' }: { model: StorefrontRenderModel; className?: string }) {
  if (model.logo_url) {
    return <img src={model.logo_url} alt={model.title} className={`object-contain ${className}`} />
  }
  return <span className={className}>{model.title}</span>
}

function MediaFill({
  src,
  fallback,
  className = '',
}: {
  src?: string | null
  fallback?: string
  className?: string
}) {
  if (src) {
    return <img src={src} alt="" className={`h-full w-full object-cover ${className}`} />
  }
  return <div className={`h-full w-full ${className}`} style={{ background: fallback || '#d4d4d4' }} />
}

function Shell({
  model,
  children,
}: {
  model: StorefrontRenderModel
  children: ReactNode
}) {
  const c = colors(model)
  return (
    <div className="min-h-screen" style={{ background: c.background, color: c.text }}>
      {model.preview ? (
        <div className="sticky top-0 z-20 border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function LandingMinimal({ model }: { model: StorefrontRenderModel }) {
  const c = colors(model)
  const content = theme(model)
  const cta = content.hero_cta || 'Hubungi kami'
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Navigasi',
    links: 'Layanan | #layanan\nKontak | #kontak',
  })

  return (
    <Shell model={model}>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3 text-lg font-semibold" style={{ color: c.primary }}>
          <BrandMark model={model} className="h-9 max-w-[140px]" />
        </div>
        <nav className="flex gap-5 text-sm opacity-70">
          {footerCol1.links
            .filter((l) => l.href)
            .slice(0, 4)
            .map((l) => (
              <a key={l.label} href={l.href}>
                {l.label}
              </a>
            ))}
        </nav>
      </header>

      <section className="relative overflow-hidden">
        {content.hero_image ? (
          <div className="absolute inset-0">
            <MediaFill src={content.hero_image} />
            <div className="absolute inset-0 bg-black/45" />
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${c.primary}28, ${c.accent}20)` }}
          />
        )}
        <div className={`relative px-6 py-24 text-center ${content.hero_image ? 'text-white' : ''}`}>
          <h1 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">{model.title}</h1>
          {model.tagline ? (
            <p className={`mx-auto mt-4 max-w-xl text-lg ${content.hero_image ? 'opacity-90' : 'opacity-75'}`}>
              {model.tagline}
            </p>
          ) : null}
          <a
            href="#kontak"
            className="mt-8 inline-flex rounded-full px-6 py-3 text-sm font-medium text-white"
            style={{ background: content.hero_image ? 'rgba(255,255,255,0.18)' : c.primary }}
          >
            {cta}
          </a>
        </div>
      </section>

      <section id="layanan" className="mx-auto grid max-w-5xl gap-4 px-6 py-14 sm:grid-cols-3">
        {['Konsultasi', 'Pengerjaan', 'Support'].map((label) => (
          <div key={label} className="rounded-3xl border border-black/5 bg-white/70 p-5 shadow-sm">
            <div className="mb-3 h-10 w-10 rounded-full" style={{ background: `${c.primary}33` }} />
            <h2 className="font-semibold">{label}</h2>
            <p className="mt-2 text-sm opacity-70">{model.about || 'Deskripsi layanan singkat untuk pelanggan.'}</p>
          </div>
        ))}
      </section>
      <section id="kontak" className="border-t border-black/5 px-6 py-12 text-center">
        <h2 className="text-xl font-semibold">Kontak</h2>
        <p className="mt-2 text-sm opacity-70">
          {[model.contact_phone, model.contact_email, model.contact_address].filter(Boolean).join(' · ') ||
            'Isi kontak di setup situs.'}
        </p>
        {footerCol1.links.length > 0 ? (
          <FooterLinkList
            links={footerCol1.links}
            inline
            className="mt-6 flex flex-wrap justify-center gap-4 text-sm"
            itemClassName="opacity-70 hover:opacity-100"
          />
        ) : null}
      </section>
    </Shell>
  )
}

function LandingStudio({ model }: { model: StorefrontRenderModel }) {
  const c = colors(model)
  const content = theme(model)
  const gallery = Array.isArray(content.gallery) ? content.gallery : []
  const tiles = gallery.length > 0 ? gallery : [null, null, null, null]
  const cta = content.hero_cta || 'Mulai proyek'
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Navigasi',
    links: 'Work | #work\nAbout | #about\nContact | #kontak',
  })

  return (
    <Shell model={model}>
      <header className="mx-auto flex w-full max-w-none items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3 text-lg font-semibold" style={{ color: c.primary }}>
          <BrandMark model={model} className="h-9 max-w-[140px]" />
        </div>
        <nav className="flex gap-5 text-sm opacity-70">
          {footerCol1.links
            .filter((l) => l.href)
            .slice(0, 5)
            .map((l) => (
              <a key={l.label} href={l.href}>
                {l.label}
              </a>
            ))}
        </nav>
      </header>
      <section className="mx-auto grid w-full max-w-none gap-8 px-6 py-12 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">{model.title}</h1>
          {model.tagline ? <p className="mt-4 text-lg opacity-75">{model.tagline}</p> : null}
          <a
            href="#kontak"
            className="mt-8 inline-flex rounded-full px-5 py-2.5 text-sm font-medium text-white"
            style={{ background: c.primary }}
          >
            {cta}
          </a>
        </div>
        <div id="work" className="grid grid-cols-2 gap-3 lg:col-span-3">
          {tiles.slice(0, 4).map((src, i) => (
            <div key={i} className="aspect-[4/3] overflow-hidden rounded-3xl">
              <MediaFill
                src={src || content.hero_image}
                fallback={i % 2 ? `${c.accent}55` : `${c.primary}33`}
              />
            </div>
          ))}
        </div>
      </section>
      <section id="about" className="mx-auto max-w-3xl px-6 pb-10 text-center">
        <h2 className="text-xl font-semibold">About</h2>
        <p className="mt-3 text-sm leading-relaxed opacity-75">
          {model.about || 'Ceritakan profil usaha Anda di sini.'}
        </p>
      </section>
      <section id="kontak" className="border-t border-black/5 px-6 py-10 text-center text-sm opacity-70">
        <div>{[model.contact_phone, model.contact_email].filter(Boolean).join(' · ') || 'Kontak belum diisi'}</div>
        {footerCol1.links.length > 0 ? (
          <FooterLinkList
            links={footerCol1.links}
            inline
            className="mt-4 flex flex-wrap justify-center gap-4"
            itemClassName="hover:opacity-100"
          />
        ) : null}
      </section>
    </Shell>
  )
}

/** Match Nexora demo: full-bleed surfaces, content capped near theme wideSize (~1440). */
const NEXORA_FRAME = 'mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8'

function ShopNexora({ model }: { model: StorefrontRenderModel }) {
  const c = colors(model)
  const content = theme(model)
  const shop = useShop()
  const products = model.products?.length ? model.products : SAMPLE_PRODUCTS
  const flagged = (flag: 'is_deal' | 'is_new_arrival' | 'is_bestseller') => {
    const hits = products.filter((p) => p[flag])
    return hits.length > 0 ? hits.slice(0, 8) : products.slice(0, 8)
  }
  const deals = flagged('is_deal')
  const arrivals = flagged('is_new_arrival')
  const trending = flagged('is_bestseller')
  const cartCount = shop?.cartCount ?? 0
  const cartTotal = cartSubtotal(shop?.cart ?? [])
  const heroCta = (typeof content.hero_cta === 'string' && content.hero_cta.trim()) || 'Shop Home Tech'
  const heroKicker =
    (typeof content.hero_kicker_left === 'string' && content.hero_kicker_left.trim()) || 'HOME TECH'
  const dealsTitle =
    (typeof content.deals_title === 'string' && content.deals_title.trim()) || "Today's Best Deals"
  const dealsBody =
    (typeof content.deals_body === 'string' && content.deals_body.trim()) ||
    'Selected picks with special pricing today.'
  const trendingTitle =
    (typeof content.trending_title === 'string' && content.trending_title.trim()) || 'Best Sellers'
  const arrivalsTitle =
    (typeof content.arrivals_title === 'string' && content.arrivals_title.trim()) || 'New Arrivals'
  const categoriesTitle =
    (typeof content.categories_title === 'string' && content.categories_title.trim()) ||
    'Shop deals by category'
  const saleKicker =
    (typeof content.sale_kicker === 'string' && content.sale_kicker.trim()) || 'Limited offer'
  const saleTitle =
    (typeof content.sale_banner_title === 'string' && content.sale_banner_title.trim()) ||
    'Mid-Season Sale Is Live'
  const saleBody =
    (typeof content.sale_banner_body === 'string' && content.sale_banner_body.trim()) ||
    'Up to 25% Off Storewide. Limited time. Exclusions apply.'
  const saleCta = (typeof content.sale_cta === 'string' && content.sale_cta.trim()) || 'Shop the sale'
  const storyKicker =
    (typeof content.story_kicker === 'string' && content.story_kicker.trim()) || 'Designed with care'
  const storyTitle =
    (typeof content.story_title === 'string' && content.story_title.trim()) || model.title
  const storyBody =
    (typeof content.story_body === 'string' && content.story_body.trim()) ||
    model.about ||
    'Purifiers and smart essentials designed for quieter comfort and cleaner spaces.'
  const footerTagline =
    (typeof content.footer_tagline === 'string' && content.footer_tagline.trim()) ||
    'Multibrand store for everyday essentials.'
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Quick Links',
    links: 'Home | #categories\nCategories | #categories\nBest Deals | #deals\nNew Arrivals | #arrivals',
  })
  const footerCol2 = readFooterColumn(content, 2, {
    title: 'Help',
    links: 'Cart | cart\nMy Account | account\nContact | #contact',
  })
  const footerLegal = readFooterLegal(content, 'Privacy Policy | #\nTerms & Conditions | #')
  const heroHeadline =
    (typeof content.hero_headline === 'string' && content.hero_headline.trim()) ||
    model.tagline?.trim() ||
    'Clean Air, Better Living'
  const heroBody =
    (typeof content.hero_body === 'string' && content.hero_body.trim()) ||
    model.about?.trim() ||
    'Purifiers and smart essentials designed for quieter comfort and cleaner spaces.'

  const categoryItems = (() => {
    const fromSlot = Array.isArray(content.categories) ? content.categories : []
    if (fromSlot.length > 0) {
      return fromSlot.slice(0, 6).map((row, index) => ({
        key: `cat-${index}`,
        label:
          typeof row === 'object' && row && 'label' in row && typeof row.label === 'string' && row.label.trim()
            ? row.label
            : `Kategori ${index + 1}`,
        image:
          typeof row === 'object' && row && 'image' in row && typeof row.image === 'string' ? row.image : null,
      }))
    }
    return [
      { key: 'phones', label: 'Smartphones', image: null as string | null },
      { key: 'laptops', label: 'Laptops', image: null },
      { key: 'audio', label: 'Audio', image: null },
      { key: 'wearables', label: 'Wearables', image: null },
      { key: 'tv', label: 'TV & Home', image: null },
      { key: 'accessories', label: 'Accessories', image: null },
    ]
  })()

  const promoLeftTitle =
    (typeof content.promo_left_title === 'string' && content.promo_left_title.trim()) ||
    'Catch Big Deals on Laptops'
  const promoLeftBody =
    (typeof content.promo_left_body === 'string' && content.promo_left_body.trim()) ||
    'Save up to 20% on select notebooks today.'
  const promoRightTitle =
    (typeof content.promo_right_title === 'string' && content.promo_right_title.trim()) ||
    'Smartwatch Essentials'
  const promoRightBody =
    (typeof content.promo_right_body === 'string' && content.promo_right_body.trim()) ||
    'Fitness tracking, notifications, and all-day comfort.'

  const navLinks = [
    { href: '#', label: 'Home' },
    { href: '#categories', label: 'Shop' },
    { href: '#arrivals', label: 'New Arrivals' },
    { href: '#trending', label: 'Best Sellers' },
    { href: '#story', label: 'Explore' },
  ]

  return (
    <Shell model={{ ...model, brand_colors: { ...c, background: '#ffffff', text: '#111827' } }}>
      <header className="sticky top-0 z-20 text-white" style={{ background: c.primary }}>
        <div className={`${NEXORA_FRAME} flex items-center gap-4 py-3`}>
          <a href="#" className="flex min-w-0 shrink-0 items-center gap-2">
            {model.logo_url ? (
              <img
                src={model.logo_url}
                alt=""
                className="h-8 w-auto max-w-[120px] object-contain brightness-0 invert"
              />
            ) : null}
            <span className="truncate text-lg font-extrabold tracking-[0.04em] uppercase">{model.title}</span>
          </a>

          <div className="relative mx-auto hidden min-w-0 max-w-2xl flex-1 md:block">
            <input
              readOnly
              placeholder="Search products..."
              className="h-10 w-full rounded-md border-0 bg-white pl-4 pr-10 text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-4 sm:gap-5">
            <button
              type="button"
              className="hidden items-center gap-1.5 text-sm text-white/90 hover:text-white sm:inline-flex"
            >
              <span className="text-base leading-none">☺</span>
              Login
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium text-white"
              onClick={() => shop?.openCart()}
            >
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <span aria-hidden>🛒</span>
                <span
                  className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-slate-900"
                  style={{ background: c.accent }}
                >
                  {cartCount}
                </span>
              </span>
              <span className="hidden tabular-nums sm:inline">{formatRupiah(cartTotal)}</span>
            </button>
          </div>
        </div>

        <div className="border-t border-white/15 md:hidden">
          <div className={`${NEXORA_FRAME} py-2`}>
            <div className="relative">
              <input
                readOnly
                placeholder="Search products..."
                className="h-9 w-full rounded-md bg-white pl-3 pr-9 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white">
        <div className={`${NEXORA_FRAME} flex items-center gap-4 overflow-x-auto py-2.5 text-sm`}>
          <a href="#categories" className="inline-flex shrink-0 items-center gap-2 font-semibold text-slate-800">
            <span className="grid h-7 w-7 place-items-center rounded bg-slate-100 text-xs">☰</span>
            Shop by Categories
          </a>
          <div className="hidden h-4 w-px bg-slate-200 sm:block" />
          <div className="flex min-w-0 items-center gap-4 text-slate-600">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="shrink-0 hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </div>
          <div className="ml-auto hidden items-center gap-4 text-slate-700 lg:flex">
            <a href="#deals" className="inline-flex items-center gap-1.5 font-medium">
              <span style={{ color: c.accent }}>⚡</span> Top Deals
            </a>
            <a href="#deals" className="inline-flex items-center gap-1.5 font-medium">
              <span style={{ color: c.primary }}>◷</span> Deal of the Day
            </a>
          </div>
        </div>
      </nav>

      <section className="bg-[#eef1f4]">
        <div className={`${NEXORA_FRAME} grid items-center gap-8 py-10 lg:grid-cols-2 lg:py-14`}>
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{heroKicker}</div>
            <h1 className="mt-3 text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl">
              {heroHeadline}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">{heroBody}</p>
            <a
              href="#deals"
              className="mt-7 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
              style={{ background: c.primary }}
            >
              {heroCta}
              <span aria-hidden>→</span>
            </a>
          </div>
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="aspect-[5/4] overflow-hidden rounded-lg bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
              <MediaFill
                src={typeof content.hero_image === 'string' ? content.hero_image : null}
                fallback={`${c.primary}18`}
              />
            </div>
          </div>
        </div>
      </section>

      <section className={`${NEXORA_FRAME} grid gap-4 py-8 sm:grid-cols-2`}>
        {[
          {
            title: promoLeftTitle,
            body: promoLeftBody,
            image: typeof content.promo_left_image === 'string' ? content.promo_left_image : null,
            tone: '#dbeafe',
          },
          {
            title: promoRightTitle,
            body: promoRightBody,
            image: typeof content.promo_right_image === 'string' ? content.promo_right_image : null,
            tone: '#fef3c7',
          },
        ].map((card) => (
          <article
            key={card.title}
            className="grid grid-cols-[1.1fr_0.9fr] overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <div className="flex flex-col justify-center gap-2 p-5 sm:p-6">
              <h3 className="text-base font-bold leading-snug text-slate-900 sm:text-lg">{card.title}</h3>
              <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">{card.body}</p>
              <a href="#deals" className="mt-1 text-xs font-semibold" style={{ color: c.primary }}>
                Shop now →
              </a>
            </div>
            <div className="min-h-[120px]" style={{ background: card.tone }}>
              <MediaFill src={card.image} fallback={card.tone} />
            </div>
          </article>
        ))}
      </section>

      <section id="categories" className={`${NEXORA_FRAME} pb-4`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{categoriesTitle}</h2>
          <a href="#deals" className="shrink-0 text-sm font-medium" style={{ color: c.primary }}>
            View All →
          </a>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {categoryItems.map((cat, i) => (
            <a key={cat.key} href="#deals" className="group text-center">
              <div className="mx-auto aspect-square overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-sm transition group-hover:shadow-md">
                <MediaFill src={cat.image} fallback={i % 2 ? `${c.accent}33` : `${c.primary}18`} />
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-800 sm:text-sm">{cat.label}</div>
            </a>
          ))}
        </div>
      </section>

      <section id="deals" className={`${NEXORA_FRAME} py-10`}>
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{dealsTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{dealsBody}</p>
          </div>
          <a href="#trending" className="hidden text-sm font-medium sm:inline" style={{ color: c.primary }}>
            View All →
          </a>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {deals.map((p) => (
            <article
              key={`deal-${p.id}`}
              className="flex h-full flex-col border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              <button type="button" className="block w-full text-left" onClick={() => shop?.openProduct(p)}>
                <div className="aspect-square overflow-hidden bg-[#f5f6f8]">
                  <MediaFill src={p.image_url} fallback={`${c.primary}12`} />
                </div>
                <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-800">{p.name}</h3>
                <ProductSocialMeta
                  className="mt-1.5"
                  soldCount={p.sold_count}
                  avgRating={p.avg_rating}
                  reviewCount={p.review_count}
                />
              </button>
              <div className="mt-auto space-y-2 pt-2">
                <div className="text-base font-bold text-slate-900">{formatRupiah(p.price)}</div>
                <button
                  type="button"
                  className="w-full rounded-md border border-slate-300 py-2 text-xs font-semibold text-slate-800 transition hover:border-transparent hover:bg-slate-900 hover:text-white"
                  onClick={() => shop?.addToCart(p)}
                >
                  Add to cart
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={`${NEXORA_FRAME} pb-10`}>
        <div
          className="relative overflow-hidden rounded-lg px-6 py-10 text-white sm:px-10"
          style={{ background: `linear-gradient(90deg, ${c.primary}, #0f172a)` }}
        >
          <div className="absolute inset-y-0 right-0 hidden w-2/5 opacity-25 sm:block">
            <MediaFill
              src={typeof content.sale_banner_image === 'string' ? content.sale_banner_image : null}
              fallback={`${c.accent}66`}
            />
          </div>
          <div className="relative z-[1] max-w-xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{saleKicker}</div>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{saleTitle}</h2>
            <p className="mt-2 text-sm text-white/80">{saleBody}</p>
            <a
              href="#arrivals"
              className="mt-5 inline-flex rounded-md px-4 py-2 text-sm font-bold text-slate-900"
              style={{ background: c.accent }}
            >
              {saleCta}
            </a>
          </div>
        </div>
      </section>

      <section id="arrivals" className={`${NEXORA_FRAME} pb-10`}>
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{arrivalsTitle}</h2>
          <a href="#trending" className="text-sm font-medium" style={{ color: c.primary }}>
            View All →
          </a>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {arrivals.map((p) => (
            <article
              key={`new-${p.id}`}
              className="flex h-full flex-col border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              <button type="button" className="block w-full text-left" onClick={() => shop?.openProduct(p)}>
                <div className="aspect-square overflow-hidden bg-[#f5f6f8]">
                  <MediaFill src={p.image_url} fallback={`${c.primary}12`} />
                </div>
                <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-800">{p.name}</h3>
                <ProductSocialMeta
                  className="mt-1.5"
                  soldCount={p.sold_count}
                  avgRating={p.avg_rating}
                  reviewCount={p.review_count}
                />
              </button>
              <div className="mt-auto space-y-2 pt-2">
                <div className="text-base font-bold text-slate-900">{formatRupiah(p.price)}</div>
                <button
                  type="button"
                  className="w-full rounded-md py-2 text-xs font-semibold text-white"
                  style={{ background: c.primary }}
                  onClick={() => shop?.addToCart(p)}
                >
                  Add to cart
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="trending" className={`${NEXORA_FRAME} pb-12`}>
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{trendingTitle}</h2>
          <a href="#deals" className="text-sm font-medium" style={{ color: c.primary }}>
            View All →
          </a>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {trending.map((p) => (
            <article
              key={`trend-${p.id}`}
              className="flex h-full flex-col border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              <button type="button" className="block w-full text-left" onClick={() => shop?.openProduct(p)}>
                <div className="aspect-square overflow-hidden bg-[#f5f6f8]">
                  <MediaFill src={p.image_url} fallback={`${c.primary}12`} />
                </div>
                <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-800">{p.name}</h3>
                <ProductSocialMeta
                  className="mt-1.5"
                  soldCount={p.sold_count}
                  avgRating={p.avg_rating}
                  reviewCount={p.review_count}
                />
              </button>
              <div className="mt-auto space-y-2 pt-2">
                <div className="text-base font-bold text-slate-900">{formatRupiah(p.price)}</div>
                <button
                  type="button"
                  className="w-full rounded-md py-2 text-xs font-semibold text-white"
                  style={{ background: c.primary }}
                  onClick={() => shop?.addToCart(p)}
                >
                  Add to cart
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="story" className="border-y border-slate-200 bg-[#f8fafc]">
        <div className={`${NEXORA_FRAME} grid gap-8 py-12 lg:grid-cols-2 lg:items-center`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{storyKicker}</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{storyTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{storyBody}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['Fast shipping', 'Genuine products', 'Easy support'].map((label) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
                <div className="mx-auto mb-2 h-8 w-8 rounded-full" style={{ background: `${c.primary}18` }} />
                <div className="text-[11px] font-semibold text-slate-800">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-[#0f172a] text-slate-300">
        <div className={`${NEXORA_FRAME} grid gap-8 py-12 text-sm md:grid-cols-4`}>
          <div>
            <div className="text-base font-bold tracking-wide text-white uppercase">{model.title}</div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {footerTagline}
            </p>
          </div>
          <div>
            <div className="font-semibold text-white">{footerCol1.title}</div>
            <FooterLinkList
              links={footerCol1.links}
              className="mt-3 space-y-1 text-xs text-slate-400"
              itemClassName="transition hover:text-white"
            />
          </div>
          <div>
            <div className="font-semibold text-white">{footerCol2.title}</div>
            <FooterLinkList
              links={footerCol2.links}
              className="mt-3 space-y-1 text-xs text-slate-400"
              itemClassName="transition hover:text-white"
            />
            <div className="mt-4 space-y-1 text-xs text-slate-400">
              <div>{model.contact_phone || 'Phone not set'}</div>
              <div>{model.contact_email || 'Email not set'}</div>
              <div>{model.contact_address || 'Address not set'}</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-white">Payment</div>
            <div className="mt-3 text-xs text-slate-400">
              {(model.bank_accounts?.length ?? 0) > 0
                ? model.bank_accounts!.map((b) => `${b.bank_name} ${b.account_number}`).join(' · ')
                : 'Bank transfer after checkout'}
            </div>
          </div>
        </div>
        {footerLegal.length > 0 ? (
          <div className={`${NEXORA_FRAME} flex flex-wrap gap-4 border-t border-white/10 py-4 text-xs text-slate-500`}>
            <FooterLinkList links={footerLegal} inline className="flex flex-wrap gap-4" itemClassName="hover:text-white" />
          </div>
        ) : null}
      </footer>
    </Shell>
  )
}

function ShopEditorial({ model }: { model: StorefrontRenderModel }) {
  const content = theme(model)
  const shop = useShop()
  const allProducts = model.products?.length ? model.products : SAMPLE_PRODUCTS.map((p, i) => ({
    ...p,
    category_id: i % 2 === 0 ? 1 : 2,
  }))
  const gallery = (Array.isArray(content.gallery) && content.gallery.length > 0
    ? content.gallery
    : EDITORIAL_DEMO.gallery
  ).slice(0, 6)
  const [navSolid, setNavSolid] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > window.innerHeight * 0.55)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const categoryItems = (() => {
    const fromSlot = Array.isArray(content.categories) ? content.categories : []
    if (fromSlot.length > 0) {
      return fromSlot.map((row, index) => ({
        category_id: typeof row === 'object' && row && 'category_id' in row ? Number(row.category_id) || 0 : 0,
        label:
          typeof row === 'object' && row && 'label' in row && typeof row.label === 'string' && row.label.trim()
            ? row.label
            : `Kategori ${index + 1}`,
        image:
          typeof row === 'object' && row && 'image' in row && typeof row.image === 'string'
            ? row.image
            : EDITORIAL_DEMO.gallery[index % EDITORIAL_DEMO.gallery.length],
      }))
    }
    return [
      {
        category_id: 0,
        label: (typeof content.category_left_label === 'string' && content.category_left_label.trim()) || 'Kategori 1',
        image: (typeof content.category_left_image === 'string' && content.category_left_image) || EDITORIAL_DEMO.women,
      },
      {
        category_id: 0,
        label: (typeof content.category_right_label === 'string' && content.category_right_label.trim()) || 'Kategori 2',
        image: (typeof content.category_right_image === 'string' && content.category_right_image) || EDITORIAL_DEMO.men,
      },
    ]
  })()

  const filteredProducts =
    activeCategoryId && activeCategoryId > 0
      ? allProducts.filter((p) => (p.category_id ?? null) === activeCategoryId)
      : allProducts
  const rowA = filteredProducts.slice(0, 6)
  const rowB = filteredProducts.slice(0, 6)
  const shoppableProducts = filteredProducts.slice(0, 3)

  const heroImage = content.hero_image || EDITORIAL_DEMO.hero
  const collectionImage = content.collection_image || EDITORIAL_DEMO.collection
  const shoppableImage = content.shoppable_image || EDITORIAL_DEMO.shoppable
  const navCategoryLabel = categoryItems[0]?.label || 'Kategori'
  const dropTitle = activeCategoryLabel
    ? `${content.drop_title || 'Produk'} · ${activeCategoryLabel}`
    : content.drop_title || 'Produk terbaru'
  const dropBody =
    content.drop_body ||
    'Pilih produk unggulan untuk ditampilkan di sini. Isi teks dan upload gambar kategori sesuai jenis usaha Anda — fashion, spare part, F&B, atau lainnya.'
  const collectionTitle = content.collection_title || model.tagline || 'Koleksi unggulan'
  const collectionBody =
    content.collection_body ||
    model.about ||
    'Ceritakan koleksi atau lini produk utama di sini. Teks dan gambar bisa diganti dari setup template.'
  const heroCopy =
    model.about ||
    'Tulis singkat tentang brand atau toko Anda. Upload foto hero dan atur label pojok sesuai kebutuhan.'
  const socialBody =
    content.social_body ||
    'Tampilkan foto galeri — update produk, dokumentasi, atau konten sosial. Ganti teks dan CTA di setup.'
  const socialCta = content.social_cta || 'Lihat selengkapnya →'
  const footerTagline =
    (typeof content.footer_tagline === 'string' && content.footer_tagline.trim()) ||
    model.tagline ||
    'Koleksi pilihan untuk gaya sehari-hari.'
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Halaman',
    links: 'Tentang | #home\nKontak | #kontak',
  })
  const footerCol2Default =
    categoryItems.length > 0
      ? `Semua | #drop\n${categoryItems
          .slice(0, 3)
          .map((c) => `${c.label} | #drop`)
          .join('\n')}\nCart | cart\nAkun | account`
      : 'Semua | #drop\nProduk | #drop\nCart | cart\nAkun | account'
  const footerCol2 = readFooterColumn(content, 2, {
    title: 'Toko',
    links: footerCol2Default,
  })
  const footerCta =
    (typeof content.footer_cta === 'string' && content.footer_cta.trim()) || 'Hubungi kami'
  const footerLegal = readFooterLegal(content, 'Privacy Policy | #\nTerms & Conditions | #')

  function productImage(p: StorefrontRenderProduct, index: number) {
    return p.image_url || EDITORIAL_DEMO.products[index % EDITORIAL_DEMO.products.length]
  }

  function selectCategory(categoryId: number, label: string) {
    if (categoryId <= 0) {
      document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setActiveCategoryId(categoryId)
    setActiveCategoryLabel(label)
    window.requestAnimationFrame(() => {
      document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const navStyleRaw = typeof content.nav_style === 'string' ? content.nav_style : 'overlay'
  const navStyle = navStyleRaw === 'overlay_dark' || navStyleRaw === 'solid' ? navStyleRaw : 'overlay'
  const barSolid = navStyle === 'solid' || navSolid
  const lightOnHero = navStyle === 'overlay' && !barSolid
  const navText = lightOnHero ? '#ffffff' : '#171717'
  const previewOffset = model.preview ? 'top-9' : 'top-0'
  const catCols =
    categoryItems.length <= 1
      ? 'grid-cols-1'
      : categoryItems.length === 2
        ? 'md:grid-cols-2'
        : categoryItems.length === 3
          ? 'md:grid-cols-3'
          : 'md:grid-cols-2 lg:grid-cols-4'

  const navBarClass = barSolid
    ? navStyle === 'solid'
      ? 'border-b border-neutral-200/70 bg-white/80 shadow-sm backdrop-blur-md'
      : 'border-b border-neutral-200/35 bg-white/50 shadow-sm backdrop-blur-xl'
    : lightOnHero
      ? 'bg-gradient-to-b from-black/55 via-black/25 to-transparent'
      : 'bg-gradient-to-b from-white/85 via-white/40 to-transparent'

  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
      {model.preview ? (
        <div className="sticky top-0 z-50 border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}

      {/* Persistent navbar — overlay over hero, solid after scroll (unless forced solid) */}
      <header
        className={`fixed inset-x-0 z-40 transition-[background-color,box-shadow,border-color] duration-300 ${previewOffset} ${navBarClass}`}
        style={{ color: navText }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-3.5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-10">
            <a href="#home" className="shrink-0 text-[15px] font-semibold tracking-tight" style={{ color: navText }}>
              {model.logo_url ? (
                <img
                  src={model.logo_url}
                  alt={model.title}
                  className={`h-7 max-w-[120px] object-contain ${lightOnHero ? 'brightness-0 invert' : ''}`}
                />
              ) : (
                model.title
              )}
            </a>
            <nav className="hidden items-center gap-7 text-[11px] font-medium uppercase tracking-[0.14em] md:flex">
              <a href="#home" className="opacity-85 transition hover:opacity-100" style={{ color: navText }}>
                Home
              </a>
              <a href="#shop" className="opacity-85 transition hover:opacity-100" style={{ color: navText }}>
                Shop
              </a>
              <a href="#categories" className="opacity-85 transition hover:opacity-100" style={{ color: navText }}>
                {navCategoryLabel}
              </a>
              <a href="#about" className="opacity-85 transition hover:opacity-100" style={{ color: navText }}>
                About
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-5 text-[11px] font-medium uppercase tracking-[0.14em]">
            <button
              type="button"
              className="hidden opacity-85 transition hover:opacity-100 sm:inline"
              style={{ color: navText }}
              onClick={() => (shop?.customer ? shop.openAccount() : shop?.openLogin())}
            >
              {shop?.customer ? 'Akun' : 'Login'}
            </button>
            <button type="button" className="opacity-85 transition hover:opacity-100" onClick={() => shop?.openCart()}>
              Cart ({shop?.cartCount ?? 0})
            </button>
            <button
              type="button"
              className="md:hidden"
              aria-label="Menu"
              style={{ color: navText }}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div
            className={`border-t px-5 py-3 md:hidden ${
              barSolid || !lightOnHero ? 'border-neutral-200 bg-white' : 'border-white/15 bg-black/80'
            }`}
            style={{ color: barSolid || !lightOnHero ? '#171717' : '#ffffff' }}
          >
            <nav className="flex flex-col gap-3 text-[13px]">
              <a href="#home" onClick={() => setMenuOpen(false)}>
                Home
              </a>
              <a href="#shop" onClick={() => setMenuOpen(false)}>
                Shop
              </a>
              <a href="#categories" onClick={() => setMenuOpen(false)}>
                {categoryItems.map((c) => c.label).join(' / ')}
              </a>
              <a href="#about" onClick={() => setMenuOpen(false)}>
                About
              </a>
              <a href="#kontak" onClick={() => setMenuOpen(false)}>
                Kontak
              </a>
              <button
                type="button"
                className="text-left"
                onClick={() => {
                  setMenuOpen(false)
                  if (shop?.customer) shop.openAccount()
                  else shop?.openLogin()
                }}
              >
                {shop?.customer ? 'Akun' : 'Login'}
              </button>
            </nav>
          </div>
        ) : null}
      </header>

      {/* 1. Full-bleed hero */}
      <section id="home" className="relative h-[100svh] min-h-[560px] w-full overflow-hidden text-white">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/25" />

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
          <div className="text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            {model.logo_url ? (
              <img src={model.logo_url} alt={model.title} className="mx-auto h-16 max-w-[280px] object-contain brightness-0 invert sm:h-20" />
            ) : (
              model.title
            )}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-8 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-5xl grid-cols-[auto_1fr_auto] items-end gap-4">
            <div className="text-[12px] tracking-[0.08em]">{content.hero_kicker_left || 'Baru'}</div>
            <p className="mx-auto max-w-xl text-center text-[12px] leading-relaxed text-white/90 sm:text-[13px]">
              {heroCopy}
            </p>
            <div className="text-right text-[12px] tracking-[0.08em]">{content.hero_kicker_right || '2026'}</div>
          </div>
        </div>
      </section>

      {/* 2. Dynamic product categories */}
      <section id="categories" className={`grid min-h-[70vh] ${catCols}`}>
        {categoryItems.map((item, index) => (
          <button
            key={`${item.category_id}-${index}`}
            type="button"
            onClick={() => selectCategory(item.category_id, item.label)}
            className={`group relative min-h-[42vh] overflow-hidden text-left ${
              activeCategoryId === item.category_id && item.category_id > 0 ? 'ring-4 ring-inset ring-white/70' : ''
            }`}
          >
            <img
              src={item.image}
              alt={item.label}
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 grid place-items-center px-4 text-center text-3xl font-medium tracking-wide text-white sm:text-4xl">
              {item.label}
            </div>
          </button>
        ))}
      </section>

      {/* 3. Latest Drop */}
      <section id="shop" className="bg-white px-5 py-14 sm:px-8 lg:px-10">
        <div className="mb-10 grid gap-6 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dropTitle}</h2>
            {activeCategoryId ? (
              <button
                type="button"
                className="mt-2 text-[13px] text-neutral-600 underline"
                onClick={() => {
                  setActiveCategoryId(null)
                  setActiveCategoryLabel(null)
                }}
              >
                Tampilkan semua
              </button>
            ) : null}
          </div>
          <div>
            <p className="max-w-xl text-[13px] leading-relaxed text-neutral-600">{dropBody}</p>
            <a href="#shop" className="mt-4 inline-block text-[13px] text-neutral-900 hover:opacity-70">
              Lihat semua →
            </a>
          </div>
        </div>
        {rowA.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
            Tidak ada produk di kategori ini.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4">
            {rowA.map((p, i) => (
              <button
                key={`a-${p.id}`}
                type="button"
                className="group text-left"
                onClick={() => shop?.openProduct(p)}
              >
                <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                  <img
                    src={productImage(p, i)}
                    alt={p.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="mt-3 space-y-1">
                  <h3 className="text-[12px] leading-snug text-neutral-800">{p.name}</h3>
                  <ProductSocialMeta
                    className="mt-1"
                    soldCount={p.sold_count}
                    avgRating={p.avg_rating}
                    reviewCount={p.review_count}
                  />
                  <div className="text-[12px] font-semibold">{formatRupiah(p.price)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 4. Full-bleed collection banner */}
      <section className="relative min-h-[85vh] overflow-hidden text-white">
        <img src={collectionImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 flex min-h-[85vh] flex-col items-center justify-center px-6 text-center">
          <h2 className="text-3xl font-medium tracking-tight sm:text-5xl">{collectionTitle}</h2>
          <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-white/90">{collectionBody}</p>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-between px-5 pb-8 text-[12px] tracking-[0.08em] sm:px-8 lg:px-10">
          <span>{content.collection_kicker_left || 'Unggulan'}</span>
          <span>{content.collection_kicker_right || 'Koleksi'}</span>
        </div>
      </section>

      {/* 5. Second drop row */}
      <section className="bg-white px-5 py-14 sm:px-8 lg:px-10">
        <div className="mb-10 grid gap-6 md:grid-cols-2 md:items-start">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dropTitle}</h2>
          <div>
            <p className="max-w-xl text-[13px] leading-relaxed text-neutral-600">{dropBody}</p>
            <a href="#shop" className="mt-4 inline-block text-[13px] text-neutral-900 hover:opacity-70">
              Lihat semua →
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4">
          {rowB.map((p, i) => (
            <button
              key={`b-${p.id}`}
              type="button"
              className="group text-left"
              onClick={() => shop?.openProduct(p)}
            >
              <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                <img
                  src={productImage(p, i + 2)}
                  alt={p.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />
              </div>
              <div className="mt-3 space-y-1">
                <h3 className="text-[12px] leading-snug text-neutral-800">{p.name}</h3>
                <ProductSocialMeta
                  className="mt-1"
                  soldCount={p.sold_count}
                  avgRating={p.avg_rating}
                  reviewCount={p.review_count}
                />
                <div className="text-[12px] font-semibold">{formatRupiah(p.price)}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 6. Shoppable hero */}
      <section className="relative min-h-[80vh] overflow-hidden">
        <img src={shoppableImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/15" />
        <div className="relative z-10 flex min-h-[80vh] flex-col justify-end gap-8 px-5 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-md text-white">
            <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {content.shoppable_title || collectionTitle}
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-white/90">
              {content.shoppable_body || collectionBody}
            </p>
          </div>
          <div className="w-full max-w-xl bg-white p-4 sm:p-5">
            <div className="grid grid-cols-3 gap-3">
              {shoppableProducts.map((p, i) => (
                <button key={`s-${p.id}`} type="button" className="text-left" onClick={() => shop?.openProduct(p)}>
                  <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                    <img src={productImage(p, i + 1)} alt={p.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <div className="line-clamp-2 text-[10px] leading-snug text-neutral-800">{p.name}</div>
                    <div className="text-[11px] font-semibold">{formatRupiah(p.price)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. About */}
      <section id="about" className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
        <p className="text-[14px] leading-relaxed text-neutral-700">
          {model.about ||
            'Ceritakan usaha Anda di sini — produk, layanan, atau komitmen toko. Teks ini bisa diganti dari setup situs.'}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 text-[13px]">
          <a href="#kontak" className="hover:opacity-60">
            Kontak
          </a>
          <a href="#shop" className="hover:opacity-60">
            Lihat produk
          </a>
        </div>
      </section>

      {/* 8. Gallery */}
      <section className="border-t border-neutral-200 px-5 py-16 sm:px-8 lg:px-10">
        <p className="mx-auto max-w-3xl text-center text-[13px] leading-relaxed text-neutral-600">{socialBody}</p>
        <div className="mt-10 grid grid-cols-3 gap-0 md:grid-cols-6">
          {gallery.map((src, i) => (
            <div key={`${src}-${i}`} className="aspect-[3/4] overflow-hidden bg-neutral-100">
              <img src={src} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
        <div className="mt-8 text-center text-[13px]">
          <a href="#home" className="hover:opacity-60">
            {socialCta}
          </a>
        </div>
      </section>

      {/* 9. Footer */}
      <footer id="kontak" className="border-t border-neutral-200 px-5 py-12 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight">{model.title}</div>
            {footerTagline ? <div className="mt-1 text-sm text-neutral-500">{footerTagline}</div> : null}
          </div>
          <div className="flex gap-16 text-[13px]">
            <div>
              <div className="mb-3 font-medium">{footerCol1.title}</div>
              <FooterLinkList
                links={footerCol1.links}
                className="space-y-2 text-neutral-600"
                itemClassName="hover:text-neutral-900"
              />
            </div>
            <div>
              <div className="mb-3 font-medium">{footerCol2.title}</div>
              <FooterLinkList
                links={footerCol2.links}
                className="space-y-2 text-neutral-600"
                itemClassName="hover:text-neutral-900"
              />
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-neutral-100 pt-6 text-[11px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {model.title} © {new Date().getFullYear()}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#kontak" className="hover:text-neutral-800">
              {footerCta}
            </a>
            <FooterLinkList links={footerLegal} inline className="flex gap-4" itemClassName="hover:text-neutral-800" />
          </div>
        </div>
        {(model.bank_accounts?.length ?? 0) > 0 ? (
          <div className="mt-4 text-[11px] text-neutral-500">
            Transfer:{' '}
            {model.bank_accounts!.map((b) => `${b.bank_name} ${b.account_number} a/n ${b.account_name}`).join(' · ')}
          </div>
        ) : null}
      </footer>
    </div>
  )
}

export function StorefrontSite({ model }: { model: StorefrontRenderModel }) {
  // Static templates only — theme slots drive content. Blocks / designer ignored.
  switch (model.template_key) {
    case 'shop_nexora':
      return <ShopNexora model={model} />
    case 'shop_editorial':
      return <ShopEditorial model={model} />
    case 'shop_hypermarket':
      return <ShopHypermarket model={model} />
    case 'shop_capsule':
      return <ShopCapsule model={model} />
    case 'shop_sophia':
      return <ShopSophia model={model} />
    case 'shop_mizu':
      return <ShopMizu model={model} />
    case 'shop_avalon':
      return <ShopAvalon model={model} />
    case 'landing_studio':
      return <LandingStudio model={model} />
    case 'landing_minimal':
    default:
      return <LandingMinimal model={model} />
  }
}
