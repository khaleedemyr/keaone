import { useState, type ReactNode, type RefObject } from 'react'
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
import { LandingMedidove } from './LandingMedidove'
import { LandingStructura } from './LandingStructura'
import { LandingEllipse } from './LandingEllipse'
import { LandingDilabs } from './LandingDilabs'
import { LandingOneex } from './LandingOneex'
import { LandingPrompt } from './LandingPrompt'
import { LandingCanun } from './LandingCanun'
import { useShop } from '../commerce/StorefrontShop'
import type { StorefrontRenderModel, StorefrontRenderProduct } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { parseFooterLinks, readFooterColumn, readFooterLegal } from '../lib/footerLinks'
import { coerceNavForTemplate, handleShopNavClick, useStorefrontScrolled } from './storefrontNav'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import {
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

export type { StorefrontRenderModel, StorefrontRenderNews, StorefrontRenderProduct } from './renderTypes'

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

  if (model.template_key === 'landing_medidove' && !model.brand_colors?.primary) {
    return {
      primary: '#e12454',
      accent: '#8fb569',
      background: '#ffffff',
      text: '#223645',
    }
  }

  if (model.template_key === 'landing_structura' && !model.brand_colors?.primary) {
    return {
      primary: '#272727',
      accent: '#8a8a8a',
      background: '#ffffff',
      text: '#272727',
    }
  }

  if (model.template_key === 'landing_ellipse' && !model.brand_colors?.primary) {
    return {
      primary: '#272727',
      accent: '#8a8a8a',
      background: '#ffffff',
      text: '#272727',
    }
  }

  if (model.template_key === 'landing_dilabs' && !model.brand_colors?.primary) {
    return {
      primary: '#FF5A1F',
      accent: '#0B0C2A',
      background: '#ffffff',
      text: '#0B0C2A',
    }
  }

  if (model.template_key === 'landing_oneex' && !model.brand_colors?.primary) {
    return {
      primary: '#e0e0e0',
      accent: '#5f5f5f',
      background: '#111111',
      text: '#e0e0e0',
    }
  }

  if (model.template_key === 'landing_prompt' && !model.brand_colors?.primary) {
    return {
      primary: '#335EEA',
      accent: '#0EA5E9',
      background: '#ffffff',
      text: '#0F172A',
    }
  }

  if (model.template_key === 'landing_canun' && !model.brand_colors?.primary) {
    return {
      primary: '#C9A227',
      accent: '#1B2336',
      background: '#ffffff',
      text: '#1B2336',
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
        <div className="border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** Match Nexora demo: full-bleed surfaces, content capped near theme wideSize (~1440). */
const NEXORA_FRAME = 'mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8'

function ShopNexora({ model }: { model: StorefrontRenderModel }) {
  const c = colors(model)
  const content = theme(model)
  const shop = useShop()
  const [navGlass, chromeRef] = useStorefrontScrolled(16)
  const products = withDemoFallback(model, model.products ?? [], SAMPLE_PRODUCTS)
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
        categoryId:
          typeof row === 'object' && row && 'category_id' in row ? Number(row.category_id) || 0 : 0,
        label:
          typeof row === 'object' && row && 'label' in row && typeof row.label === 'string' && row.label.trim()
            ? row.label
            : `Kategori ${index + 1}`,
        image:
          typeof row === 'object' && row && 'image' in row && typeof row.image === 'string' ? row.image : null,
      }))
    }
    return withDemoFallback(model, [], [
      { key: 'phones', categoryId: 0, label: 'Smartphones', image: null as string | null },
      { key: 'laptops', categoryId: 0, label: 'Laptops', image: null },
      { key: 'audio', categoryId: 0, label: 'Audio', image: null },
      { key: 'wearables', categoryId: 0, label: 'Wearables', image: null },
      { key: 'tv', categoryId: 0, label: 'TV & Home', image: null },
      { key: 'accessories', categoryId: 0, label: 'Accessories', image: null },
    ])
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
  const promoLeftCta =
    (typeof content.promo_left_cta === 'string' && content.promo_left_cta.trim()) || 'Shop now'
  const promoRightCta =
    (typeof content.promo_right_cta === 'string' && content.promo_right_cta.trim()) || 'Shop now'

  const navDefault = 'Home | #\nShop | #categories\nNew Arrivals | #arrivals\nBest Sellers | #trending\nExplore | #story'
  const navLinks = coerceNavForTemplate(
    parseFooterLinks(
      (typeof content.nav_links === 'string' && content.nav_links.trim()) || navDefault,
    ),
    parseFooterLinks(navDefault),
    ['categories', 'deals', 'arrivals', 'trending', 'story', 'contact'],
  )

  return (
    <Shell model={{ ...model, preview: false, brand_colors: { ...c, background: '#ffffff', text: '#111827' } }}>
      <div
        ref={chromeRef as RefObject<HTMLDivElement | null>}
        className={`sticky top-0 z-40 transition-[box-shadow] duration-300 ${navGlass ? 'shadow-lg shadow-black/10' : ''}`}
      >
      {model.preview ? (
        <div
          className={`border-b border-black/10 px-4 py-2 text-center text-xs text-amber-950 transition-colors duration-300 ${
            navGlass ? 'bg-amber-50/70 backdrop-blur-md' : 'bg-amber-50'
          }`}
        >
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      <header
        className={`text-white transition-[background-color,backdrop-filter] duration-300 ${
          navGlass ? 'backdrop-blur-md' : ''
        }`}
        style={{
          background: navGlass ? `color-mix(in srgb, ${c.primary} 62%, transparent)` : c.primary,
        }}
      >
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
              onClick={() => (shop?.customer ? shop.openAccount() : shop?.openLogin())}
            >
              <span className="text-base leading-none">☺</span>
              {shop?.customer ? 'Akun' : 'Login'}
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

      <nav
        className={`border-b transition-[background-color,border-color,backdrop-filter,box-shadow] duration-300 ${
          navGlass
            ? 'border-slate-200/40 bg-white/55 shadow-none backdrop-blur-md'
            : 'border-slate-200 bg-white shadow-sm'
        }`}
      >
        <div className={`${NEXORA_FRAME} flex items-center gap-4 overflow-x-auto py-2.5 text-sm`}>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 font-semibold text-slate-800"
            onClick={() => shop?.openCategories()}
          >
            <span className="grid h-7 w-7 place-items-center rounded bg-slate-100 text-xs">☰</span>
            Shop by Categories
          </button>
          <div className="hidden h-4 w-px bg-slate-200 sm:block" />
          <div className="flex min-w-0 items-center gap-4 text-slate-600">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href || '#categories'}
                className="shrink-0 hover:text-slate-900"
                onClick={(e) => handleShopNavClick(e, link, shop)}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="ml-auto hidden items-center gap-4 text-slate-700 lg:flex">
            <a
              href="#deals"
              className="inline-flex items-center gap-1.5 font-medium"
              onClick={(e) => handleShopNavClick(e, { href: '#deals' }, shop)}
            >
              <span style={{ color: c.accent }}>⚡</span> Top Deals
            </a>
            <a
              href="#deals"
              className="inline-flex items-center gap-1.5 font-medium"
              onClick={(e) => handleShopNavClick(e, { href: '#deals' }, shop)}
            >
              <span style={{ color: c.primary }}>◷</span> Deal of the Day
            </a>
          </div>
        </div>
      </nav>
      </div>

      <section className="bg-[#eef1f4]">
        <div className={`${NEXORA_FRAME} grid items-center gap-8 py-10 lg:grid-cols-2 lg:py-14`}>
          <HeroEnter className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{heroKicker}</div>
            <h1 className="mt-3 text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl">
              {heroHeadline}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">{heroBody}</p>
            <Magnetic className="mt-7 inline-block">
              <a
                href="#deals"
                className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                style={{ background: c.primary }}
                onClick={(e) => handleShopNavClick(e, { href: '#deals' }, shop)}
              >
                {heroCta}
                <span aria-hidden>→</span>
              </a>
            </Magnetic>
          </HeroEnter>
          <HeroEnter delay={0.12} className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <Tilt3D className="relative overflow-hidden rounded-lg shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
              <Parallax offset={70}>
                <div className="aspect-[5/4] bg-white">
                  <MediaFill
                    src={typeof content.hero_image === 'string' ? content.hero_image : null}
                    fallback={`${c.primary}18`}
                  />
                </div>
              </Parallax>
            </Tilt3D>
          </HeroEnter>
        </div>
      </section>

      <Stagger className={`${NEXORA_FRAME} grid gap-4 py-8 sm:grid-cols-2`}>
        {[
          {
            title: promoLeftTitle,
            body: promoLeftBody,
            cta: promoLeftCta,
            image: typeof content.promo_left_image === 'string' ? content.promo_left_image : null,
            tone: '#dbeafe',
          },
          {
            title: promoRightTitle,
            body: promoRightBody,
            cta: promoRightCta,
            image: typeof content.promo_right_image === 'string' ? content.promo_right_image : null,
            tone: '#fef3c7',
          },
        ].map((card) => (
          <StaggerItem key={card.title} as="article">
            <HoverLift className="grid grid-cols-[1.1fr_0.9fr] overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-col justify-center gap-2 p-5 sm:p-6">
                <h3 className="text-base font-bold leading-snug text-slate-900 sm:text-lg">{card.title}</h3>
                <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">{card.body}</p>
                <button
                  type="button"
                  className="mt-1 text-left text-xs font-semibold"
                  style={{ color: c.primary }}
                  onClick={() => shop?.openCatalog()}
                >
                  {card.cta}
                </button>
              </div>
              <div className="min-h-[120px]" style={{ background: card.tone }}>
                <MediaFill src={card.image} fallback={card.tone} />
              </div>
            </HoverLift>
          </StaggerItem>
        ))}
      </Stagger>

      {categoryItems.length > 0 ? (
      <Reveal as="section" id="categories" className={`${NEXORA_FRAME} pb-4`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{categoriesTitle}</h2>
          <button
            type="button"
            className="shrink-0 text-sm font-medium"
            style={{ color: c.primary }}
            onClick={() => shop?.openCategories()}
          >
            View All →
          </button>
        </div>
        <Stagger className="grid grid-cols-3 gap-4 sm:grid-cols-6" stagger={0.06}>
          {categoryItems.map((cat, i) => (
            <StaggerItem key={cat.key}>
              <Tilt3D className="relative text-center">
                <button
                  type="button"
                  className="group block w-full"
                  onClick={() =>
                    cat.categoryId > 0
                      ? shop?.openCatalog({ categoryId: cat.categoryId })
                      : shop?.openCategories()
                  }
                >
                  <div className="mx-auto aspect-square overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-sm transition group-hover:shadow-md">
                    <MediaFill src={cat.image} fallback={i % 2 ? `${c.accent}33` : `${c.primary}18`} />
                  </div>
                  <div className="mt-2 text-xs font-semibold text-slate-800 sm:text-sm">{cat.label}</div>
                </button>
              </Tilt3D>
            </StaggerItem>
          ))}
        </Stagger>
      </Reveal>
      ) : null}

      {deals.length > 0 ? (
      <Reveal as="section" id="deals" className={`${NEXORA_FRAME} py-10`}>
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{dealsTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{dealsBody}</p>
          </div>
          <button
            type="button"
            className="hidden text-sm font-medium sm:inline"
            style={{ color: c.primary }}
            onClick={() => shop?.openCatalog()}
          >
            View All →
          </button>
        </div>
        <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" stagger={0.07}>
          {deals.map((p) => (
            <StaggerItem key={`deal-${p.id}`} as="article">
              <Tilt3D className="relative flex h-full flex-col border border-slate-200 bg-white p-3 shadow-sm">
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
              </Tilt3D>
            </StaggerItem>
          ))}
        </Stagger>
      </Reveal>
      ) : null}

      <Reveal className={`${NEXORA_FRAME} pb-10`}>
        <div
          className="relative overflow-hidden rounded-lg px-6 py-10 text-white sm:px-10"
          style={{ background: `linear-gradient(90deg, ${c.primary}, #0f172a)` }}
        >
          <div className="absolute inset-y-0 right-0 hidden w-2/5 opacity-25 sm:block">
            <Parallax offset={50}>
              <MediaFill
                src={typeof content.sale_banner_image === 'string' ? content.sale_banner_image : null}
                fallback={`${c.accent}66`}
              />
            </Parallax>
          </div>
          <div className="relative z-[1] max-w-xl">
            <ScalePop>
              <div className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{saleKicker}</div>
            </ScalePop>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{saleTitle}</h2>
            <p className="mt-2 text-sm text-white/80">{saleBody}</p>
            <Magnetic className="mt-5 inline-block">
              <button
                type="button"
                className="inline-flex rounded-md px-4 py-2 text-sm font-bold text-slate-900"
                style={{ background: c.accent }}
                onClick={() => shop?.openCatalog()}
              >
                {saleCta}
              </button>
            </Magnetic>
          </div>
        </div>
      </Reveal>

      {arrivals.length > 0 ? (
      <Reveal as="section" id="arrivals" className={`${NEXORA_FRAME} pb-10`}>
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{arrivalsTitle}</h2>
          <button
            type="button"
            className="text-sm font-medium"
            style={{ color: c.primary }}
            onClick={() => shop?.openCatalog()}
          >
            View All →
          </button>
        </div>
        <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" stagger={0.07}>
          {arrivals.map((p) => (
            <StaggerItem key={`new-${p.id}`} as="article">
              <Tilt3D className="relative flex h-full flex-col border border-slate-200 bg-white p-3 shadow-sm">
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
              </Tilt3D>
            </StaggerItem>
          ))}
        </Stagger>
      </Reveal>
      ) : null}

      {trending.length > 0 ? (
      <Reveal as="section" id="trending" className={`${NEXORA_FRAME} pb-12`}>
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{trendingTitle}</h2>
          <button
            type="button"
            className="text-sm font-medium"
            style={{ color: c.primary }}
            onClick={() => shop?.openCatalog()}
          >
            View All →
          </button>
        </div>
        <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" stagger={0.07}>
          {trending.map((p) => (
            <StaggerItem key={`trend-${p.id}`} as="article">
              <Tilt3D className="relative flex h-full flex-col border border-slate-200 bg-white p-3 shadow-sm">
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
              </Tilt3D>
            </StaggerItem>
          ))}
        </Stagger>
      </Reveal>
      ) : null}

      <Reveal as="section" id="story" className="border-y border-slate-200 bg-[#f8fafc]">
        <div className={`${NEXORA_FRAME} grid gap-8 py-12 lg:grid-cols-2 lg:items-center`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{storyKicker}</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{storyTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{storyBody}</p>
          </div>
          <Stagger className="grid grid-cols-3 gap-3" stagger={0.08}>
            {['Fast shipping', 'Genuine products', 'Easy support'].map((label) => (
              <StaggerItem key={label}>
                <HoverLift className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
                  <div className="mx-auto mb-2 h-8 w-8 rounded-full" style={{ background: `${c.primary}18` }} />
                  <div className="text-[11px] font-semibold text-slate-800">{label}</div>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>

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
  const allProducts = withDemoFallback(
    model,
    model.products ?? [],
    SAMPLE_PRODUCTS.map((p, i) => ({
      ...p,
      category_id: i % 2 === 0 ? 1 : 2,
    })),
  )
  const galleryUploads = Array.isArray(content.gallery)
    ? content.gallery.filter((src): src is string => typeof src === 'string' && src.trim().length > 0)
    : []
  const gallery = withDemoFallback(model, galleryUploads, EDITORIAL_DEMO.gallery).slice(0, 6)
  const [navSolid, chromeRef] = useStorefrontScrolled(72)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null)

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
            : withDemoImage(model, undefined, EDITORIAL_DEMO.gallery[index % EDITORIAL_DEMO.gallery.length]!),
      }))
    }
    return withDemoFallback(model, [], [
      {
        category_id: 0,
        label: (typeof content.category_left_label === 'string' && content.category_left_label.trim()) || 'Kategori 1',
        image: withDemoImage(
          model,
          typeof content.category_left_image === 'string' ? content.category_left_image : undefined,
          EDITORIAL_DEMO.women,
        ),
      },
      {
        category_id: 0,
        label: (typeof content.category_right_label === 'string' && content.category_right_label.trim()) || 'Kategori 2',
        image: withDemoImage(
          model,
          typeof content.category_right_image === 'string' ? content.category_right_image : undefined,
          EDITORIAL_DEMO.men,
        ),
      },
    ])
  })()

  const filteredProducts =
    activeCategoryId && activeCategoryId > 0
      ? allProducts.filter((p) => (p.category_id ?? null) === activeCategoryId)
      : allProducts
  const rowA = filteredProducts.slice(0, 6)
  const rowB = filteredProducts.slice(0, 6)
  const shoppableProducts = filteredProducts.slice(0, 3)

  const heroImage = withDemoImage(model, typeof content.hero_image === 'string' ? content.hero_image : undefined, EDITORIAL_DEMO.hero)
  const collectionImage = withDemoImage(
    model,
    typeof content.collection_image === 'string' ? content.collection_image : undefined,
    EDITORIAL_DEMO.collection,
  )
  const shoppableImage = withDemoImage(
    model,
    typeof content.shoppable_image === 'string' ? content.shoppable_image : undefined,
    EDITORIAL_DEMO.shoppable,
  )
  const navCategoryLabel = categoryItems[0]?.label || 'Kategori'
  const baseDropTitle = (typeof content.drop_title === 'string' && content.drop_title.trim()) || 'Produk'
  const dropTitle = activeCategoryLabel
    ? `${baseDropTitle} · ${activeCategoryLabel}`
    : (typeof content.drop_title === 'string' && content.drop_title.trim()) || 'Produk terbaru'
  const dropBody =
    (typeof content.drop_body === 'string' && content.drop_body.trim()) ||
    'Pilih produk unggulan untuk ditampilkan di sini. Isi teks dan upload gambar kategori sesuai jenis usaha Anda — fashion, spare part, F&B, atau lainnya.'
  const collectionTitle = (typeof content.collection_title === 'string' && content.collection_title.trim()) || model.tagline || 'Koleksi unggulan'
  const collectionBody =
    (typeof content.collection_body === 'string' && content.collection_body.trim()) ||
    model.about ||
    'Ceritakan koleksi atau lini produk utama di sini. Teks dan gambar bisa diganti dari setup template.'
  const shoppableTitle = (typeof content.shoppable_title === 'string' && content.shoppable_title.trim()) || collectionTitle
  const shoppableBody = (typeof content.shoppable_body === 'string' && content.shoppable_body.trim()) || collectionBody
  const collectionKickerLeft =
    (typeof content.collection_kicker_left === 'string' && content.collection_kicker_left.trim()) || 'Unggulan'
  const collectionKickerRight =
    (typeof content.collection_kicker_right === 'string' && content.collection_kicker_right.trim()) || 'Koleksi'
  const heroCopy =
    model.about ||
    'Tulis singkat tentang brand atau toko Anda. Upload foto hero dan atur label pojok sesuai kebutuhan.'
  const heroKickerLeft = (typeof content.hero_kicker_left === 'string' && content.hero_kicker_left.trim()) || 'Baru'
  const heroKickerRight = (typeof content.hero_kicker_right === 'string' && content.hero_kicker_right.trim()) || '2026'
  const socialBody =
    (typeof content.social_body === 'string' && content.social_body.trim()) ||
    'Tampilkan foto galeri — update produk, dokumentasi, atau konten sosial. Ganti teks dan CTA di setup.'
  const socialCta = (typeof content.social_cta === 'string' && content.social_cta.trim()) || 'Lihat selengkapnya →'
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
  const footerCopy = (typeof content.footer_copy === 'string' && content.footer_copy.trim()) || `${model.title} © ${new Date().getFullYear()}`
  const aboutPrimaryCta = (typeof content.about_primary_cta === 'string' && content.about_primary_cta.trim()) || 'Kontak'
  const aboutSecondaryCta = (typeof content.about_secondary_cta === 'string' && content.about_secondary_cta.trim()) || 'Lihat produk'
  const navDefault = `Home | #home\nShop | #shop\n${navCategoryLabel} | #categories\nAbout | #about\nKontak | #kontak`
  const navItems = coerceNavForTemplate(
    parseFooterLinks((typeof content.nav_links === 'string' && content.nav_links.trim()) || navDefault),
    parseFooterLinks(navDefault),
    ['home', 'shop', 'categories', 'about', 'kontak'],
  )

  function productImage(p: StorefrontRenderProduct, index: number) {
    return withDemoImage(model, p.image_url, EDITORIAL_DEMO.products[index % EDITORIAL_DEMO.products.length]!)
  }

  const navStyleRaw = typeof content.nav_style === 'string' ? content.nav_style : 'overlay'
  const navStyle = navStyleRaw === 'overlay_dark' || navStyleRaw === 'solid' ? navStyleRaw : 'overlay'
  const barSolid = navStyle === 'solid' || navSolid
  const lightOnHero = navStyle === 'overlay' && !barSolid
  const navText = lightOnHero ? '#ffffff' : '#171717'
  const overlayNav = navStyle !== 'solid'
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
    <div className="relative min-h-screen bg-white font-sans text-neutral-900 antialiased">
      {model.preview ? (
        <div className="border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}

      {/* Sticky navbar — stays visible while scrolling (incl. ERP preview panes) */}
      <header
        ref={chromeRef}
        className={`sticky top-0 z-40 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 ${navBarClass}`}
        style={{
          color: navText,
          // Overlay mode: sit on top of the full-bleed hero like the live fixed bar.
          ...(overlayNav ? { marginBottom: '-4.25rem' } : null),
        }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-3.5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-10">
            <a
              href="#home"
              className="shrink-0 text-[15px] font-semibold tracking-tight"
              style={{ color: navText }}
              onClick={(e) => handleShopNavClick(e, { href: '#home' }, shop)}
            >
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
              {navItems.slice(0, 4).map((item) => (
                <a
                  key={item.label}
                  href={item.href || '#home'}
                  className="opacity-85 transition hover:opacity-100"
                  style={{ color: navText }}
                  onClick={(e) => handleShopNavClick(e, item, shop)}
                >
                  {item.label}
                </a>
              ))}
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
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href || '#home'}
                  onClick={(e) => {
                    handleShopNavClick(e, item, shop, () => setMenuOpen(false))
                  }}
                >
                  {item.label}
                </a>
              ))}
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
        <Parallax className="absolute inset-0 h-full w-full" offset={100}>
          {heroImage ? <img src={heroImage} alt="" className="h-full w-full object-cover" /> : null}
        </Parallax>
        <div className="absolute inset-0 bg-black/25" />

        <HeroEnter className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
          <div className="text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            {model.logo_url ? (
              <img src={model.logo_url} alt={model.title} className="mx-auto h-16 max-w-[280px] object-contain brightness-0 invert sm:h-20" />
            ) : (
              model.title
            )}
          </div>
        </HeroEnter>

        <HeroEnter delay={0.15} className="absolute inset-x-0 bottom-0 z-10 px-5 pb-8 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-5xl grid-cols-[auto_1fr_auto] items-end gap-4">
            <div className="text-[12px] tracking-[0.08em]">{heroKickerLeft}</div>
            <p className="mx-auto max-w-xl text-center text-[12px] leading-relaxed text-white/90 sm:text-[13px]">
              {heroCopy}
            </p>
            <div className="text-right text-[12px] tracking-[0.08em]">{heroKickerRight}</div>
          </div>
        </HeroEnter>
      </section>

      {/* 2. Dynamic product categories */}
      {categoryItems.length > 0 ? (
      <Stagger as="section" id="categories" className={`grid min-h-[70vh] ${catCols}`} stagger={0.1}>
        {categoryItems.map((item, index) => (
          <StaggerItem key={`${item.category_id}-${index}`} className="min-h-[42vh]">
            <HoverLift className="h-full">
              <button
                type="button"
                onClick={() => {
                  if (item.category_id > 0) shop?.openCatalog({ categoryId: item.category_id })
                  else shop?.openCategories()
                }}
                className={`group relative h-full min-h-[42vh] w-full overflow-hidden text-left ${
                  activeCategoryId === item.category_id && item.category_id > 0 ? 'ring-4 ring-inset ring-white/70' : ''
                }`}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.label}
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 grid place-items-center px-4 text-center text-3xl font-medium tracking-wide text-white sm:text-4xl">
                  {item.label}
                </div>
              </button>
            </HoverLift>
          </StaggerItem>
        ))}
      </Stagger>
      ) : null}

      {/* 3. Latest Drop */}
      {allProducts.length > 0 ? (
      <Reveal as="section" id="shop" className="bg-white px-5 py-14 sm:px-8 lg:px-10">
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
            <Magnetic className="mt-4 inline-block">
              <button
                type="button"
                className="inline-block text-[13px] text-neutral-900 hover:opacity-70"
                onClick={() => shop?.openCatalog()}
              >
                Lihat semua →
              </button>
            </Magnetic>
          </div>
        </div>
        {rowA.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
            Tidak ada produk di kategori ini.
          </div>
        ) : (
          <Stagger className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4" stagger={0.06}>
            {rowA.map((p, i) => (
              <StaggerItem key={`a-${p.id}`}>
                <Tilt3D className="relative">
                  <button
                    type="button"
                    className="group w-full text-left"
                    onClick={() => shop?.openProduct(p)}
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                      {productImage(p, i) ? (
                        <img
                          src={productImage(p, i)}
                          alt={p.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                        />
                      ) : null}
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
                </Tilt3D>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Reveal>
      ) : null}

      {/* 4. Full-bleed collection banner */}
      <section className="relative min-h-[85vh] overflow-hidden text-white">
        <Parallax className="absolute inset-0 h-full w-full" offset={90}>
          {collectionImage ? <img src={collectionImage} alt="" className="h-full w-full object-cover" /> : null}
        </Parallax>
        <div className="absolute inset-0 bg-black/30" />
        <Reveal className="relative z-10 flex min-h-[85vh] flex-col items-center justify-center px-6 text-center">
          <h2 className="text-3xl font-medium tracking-tight sm:text-5xl">{collectionTitle}</h2>
          <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-white/90">{collectionBody}</p>
        </Reveal>
        <Reveal delay={0.1} className="absolute inset-x-0 bottom-0 z-10 flex justify-between px-5 pb-8 text-[12px] tracking-[0.08em] sm:px-8 lg:px-10">
          <span>{collectionKickerLeft}</span>
          <span>{collectionKickerRight}</span>
        </Reveal>
      </section>

      {/* 5. Second drop row */}
      {rowB.length > 0 ? (
      <Reveal as="section" className="bg-white px-5 py-14 sm:px-8 lg:px-10">
        <div className="mb-10 grid gap-6 md:grid-cols-2 md:items-start">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dropTitle}</h2>
          <div>
            <p className="max-w-xl text-[13px] leading-relaxed text-neutral-600">{dropBody}</p>
            <Magnetic className="mt-4 inline-block">
              <button
                type="button"
                className="inline-block text-[13px] text-neutral-900 hover:opacity-70"
                onClick={() => shop?.openCatalog()}
              >
                Lihat semua →
              </button>
            </Magnetic>
          </div>
        </div>
        <Stagger className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4" stagger={0.06}>
          {rowB.map((p, i) => (
            <StaggerItem key={`b-${p.id}`}>
              <Tilt3D className="relative">
                <button
                  type="button"
                  className="group w-full text-left"
                  onClick={() => shop?.openProduct(p)}
                >
                  <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                    {productImage(p, i + 2) ? (
                      <img
                        src={productImage(p, i + 2)}
                        alt={p.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                      />
                    ) : null}
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
              </Tilt3D>
            </StaggerItem>
          ))}
        </Stagger>
      </Reveal>
      ) : null}

      {/* 6. Shoppable hero */}
      <section className="relative min-h-[80vh] overflow-hidden">
        <Parallax className="absolute inset-0 h-full w-full" offset={80}>
          {shoppableImage ? <img src={shoppableImage} alt="" className="h-full w-full object-cover" /> : null}
        </Parallax>
        <div className="absolute inset-0 bg-black/15" />
        <div className="relative z-10 flex min-h-[80vh] flex-col justify-end gap-8 px-5 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <Reveal className="max-w-md text-white">
            <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {shoppableTitle}
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-white/90">
              {shoppableBody}
            </p>
          </Reveal>
          {shoppableProducts.length > 0 ? (
          <Reveal delay={0.1} className="w-full max-w-xl bg-white p-4 sm:p-5">
            <Stagger className="grid grid-cols-3 gap-3" stagger={0.08}>
              {shoppableProducts.map((p, i) => (
                <StaggerItem key={`s-${p.id}`}>
                  <HoverLift>
                    <button type="button" className="w-full text-left" onClick={() => shop?.openProduct(p)}>
                      <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                        {productImage(p, i + 1) ? <img src={productImage(p, i + 1)} alt={p.name} className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="mt-2 space-y-0.5">
                        <div className="line-clamp-2 text-[10px] leading-snug text-neutral-800">{p.name}</div>
                        <div className="text-[11px] font-semibold">{formatRupiah(p.price)}</div>
                      </div>
                    </button>
                  </HoverLift>
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>
          ) : null}
        </div>
      </section>

      {/* 7. About */}
      <Reveal as="section" id="about" className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
        <p className="text-[14px] leading-relaxed text-neutral-700">
          {model.about ||
            'Ceritakan usaha Anda di sini — produk, layanan, atau komitmen toko. Teks ini bisa diganti dari setup situs.'}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 text-[13px]">
          <Magnetic className="inline-block">
            <a href="#kontak" className="hover:opacity-60">
              {aboutPrimaryCta}
            </a>
          </Magnetic>
          <Magnetic className="inline-block">
            <a href="#shop" className="hover:opacity-60">
              {aboutSecondaryCta}
            </a>
          </Magnetic>
        </div>
      </Reveal>

      {/* 8. Gallery */}
      <Reveal as="section" className="border-t border-neutral-200 px-5 py-16 sm:px-8 lg:px-10">
        <p className="mx-auto max-w-3xl text-center text-[13px] leading-relaxed text-neutral-600">{socialBody}</p>
        <Stagger className="mt-10 grid grid-cols-3 gap-0 md:grid-cols-6" stagger={0.05}>
          {gallery.map((src, i) => (
            <StaggerItem key={`${src}-${i}`}>
              <HoverLift className="aspect-[3/4] overflow-hidden bg-neutral-100">
                <img src={src} alt="" className="h-full w-full object-cover" />
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="mt-8 text-center text-[13px]">
          <Magnetic className="inline-block">
            <a href="#home" className="hover:opacity-60">
              {socialCta}
            </a>
          </Magnetic>
        </div>
      </Reveal>

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
            {footerCopy}
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
    case 'landing_medidove':
      return <LandingMedidove model={model} />
    case 'landing_structura':
      return <LandingStructura model={model} />
    case 'landing_ellipse':
      return <LandingEllipse model={model} />
    case 'landing_oneex':
      return <LandingOneex model={model} />
    case 'landing_prompt':
      return <LandingPrompt model={model} />
    case 'landing_canun':
      return <LandingCanun model={model} />
    case 'landing_dilabs':
    default:
      return <LandingDilabs model={model} />
  }
}
