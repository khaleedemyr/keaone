import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatRupiah } from '../../../lib/money'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import { useShop } from '../commerce/StorefrontShop'
import type { StorefrontRenderModel, StorefrontRenderProduct } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { readFooterColumn, readFooterLegal } from '../lib/footerLinks'
import {
  MIZU_DEFAULT_CATS,
  MIZU_DEFAULT_HERO,
  MIZU_DEMO,
  MIZU_PRODUCT_NAMES,
} from './mizuDemo'

/**
 * Mizu recreation from https://woodemo1.modstar.co.uk/
 * Measured tokens:
 * - contentSize 1200px, wideSize 1500px
 * - primary #232323, secondary #7a7a7a, base #fff, border #eee
 * - fonts: SUIT-like (Outfit) + DM Sans
 * - hero cover min-height 95vh; title/body sit UNDER the image (not overlay)
 * - product cards: portrait ~3:4, name + price, minimal chrome
 */

const M = {
  content: 'mx-auto w-full max-w-[1200px] px-4 sm:px-6',
  wide: 'mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8',
  primary: '#232323',
  secondary: '#7a7a7a',
  base: '#ffffff',
  border: '#eeeeee',
  borderDark: '#d0d0d0',
} as const

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return { primary: M.primary, accent: M.secondary, background: M.base, text: M.primary }
  }
  return {
    primary: model.brand_colors.primary || M.primary,
    accent: model.brand_colors.accent || M.secondary,
    background: model.brand_colors.background || M.base,
    text: model.brand_colors.text || M.primary,
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
    const id = 'mizu-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@300;400;500;600;700&display=swap'
    document.head.appendChild(link)
  }, [])
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        background: c.background || M.base,
        color: c.text,
        fontFamily: '"DM Sans", system-ui, sans-serif',
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

function ProductCard({
  product,
  imageFallback,
}: {
  product: StorefrontRenderProduct
  imageFallback: string
}) {
  const shop = useShop()
  return (
    <article className="group flex h-full min-w-0 flex-col">
      <button
        type="button"
        className="relative aspect-[3/4] w-full overflow-hidden bg-[#f3f3f3] text-left"
        onClick={() => shop?.openProduct(product)}
      >
        <img
          src={product.image_url || imageFallback}
          alt=""
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
        />
      </button>
      <div className="pt-3">
        <button type="button" className="text-left" onClick={() => shop?.openProduct(product)}>
          <h3 className="text-[14px] font-medium leading-snug text-[#232323]">{product.name}</h3>
        </button>
        <div className="mt-1 text-[13px] text-[#7a7a7a]">{formatRupiah(product.price)}</div>
      </div>
    </article>
  )
}

function ProductRow({ products, id }: { products: StorefrontRenderProduct[]; id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-card]')
    const w = card ? card.offsetWidth + 16 : el.clientWidth / 4
    el.scrollBy({ left: dir * w * 2, behavior: 'smooth' })
  }
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Previous"
        className="absolute -left-1 top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center border border-[#eee] bg-white text-[16px] text-[#232323] shadow-sm md:grid"
        onClick={() => scrollBy(-1)}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next"
        className="absolute -right-1 top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center border border-[#eee] bg-white text-[16px] text-[#232323] shadow-sm md:grid"
        onClick={() => scrollBy(1)}
      >
        ›
      </button>
      <div
        id={id}
        ref={ref}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p, i) => (
          <div
            key={`${id}-${p.id}`}
            data-card
            className="w-[calc((100%-1rem)/2)] shrink-0 sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-4rem)/5)]"
          >
            <ProductCard product={p} imageFallback={MIZU_DEMO.products[i % MIZU_DEMO.products.length]!} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ShopMizu({ model }: { model: StorefrontRenderModel }) {
  const content = theme(model)
  const c = colors(model)
  const shop = useShop()
  const [slide, setSlide] = useState(0)

  const catalog = useMemo(() => {
    if (model.products?.length) return model.products
    return MIZU_PRODUCT_NAMES.map((name, i) => ({
      id: -(i + 1),
      name,
      description: '',
      price: [4640000, 8800000, 2080000, 7200000, 5600000, 6400000, 2880000, 5120000][i] ?? 2990000,
      image_url: MIZU_DEMO.products[i % MIZU_DEMO.products.length],
      is_new_arrival: true,
    }))
  }, [model.products])

  const newIn = (() => {
    const hits = catalog.filter((p) => p.is_new_arrival)
    return (hits.length ? hits : catalog).slice(0, 10)
  })()

  const heroSlides = useMemo(() => {
    const fromSlot = Array.isArray(content.hero_slides) ? content.hero_slides : []
    const slides = fromSlot
      .filter((s): s is { image?: string; title?: string; subtitle?: string } => !!s && typeof s === 'object')
      .map((s, i) => ({
        image: typeof s.image === 'string' && s.image ? s.image : MIZU_DEMO.heroes[i % MIZU_DEMO.heroes.length]!,
        title: (typeof s.title === 'string' && s.title.trim()) || MIZU_DEFAULT_HERO[i]?.title || MIZU_DEFAULT_HERO[0]!.title,
        subtitle:
          (typeof s.subtitle === 'string' && s.subtitle.trim()) ||
          MIZU_DEFAULT_HERO[i]?.subtitle ||
          MIZU_DEFAULT_HERO[0]!.subtitle,
      }))
    if (slides.length) return slides.slice(0, 3)
    const single = typeof content.hero_image === 'string' && content.hero_image ? content.hero_image : null
    const headline = slotText(content, 'hero_headline', MIZU_DEFAULT_HERO[0]!.title)
    const body = slotText(content, 'hero_body', MIZU_DEFAULT_HERO[0]!.subtitle)
    return MIZU_DEFAULT_HERO.map((h, i) => ({
      image: i === 0 && single ? single : MIZU_DEMO.heroes[i]!,
      title: i === 0 ? headline : h.title,
      subtitle: i === 0 ? body : h.subtitle,
    }))
  }, [content])

  useEffect(() => {
    if (heroSlides.length < 2) return
    const id = window.setInterval(() => setSlide((s) => (s + 1) % heroSlides.length), 5500)
    return () => window.clearInterval(id)
  }, [heroSlides.length])

  const newinTitle = slotText(content, 'newin_title', 'New In')
  const newinCta = slotText(content, 'newin_cta', 'Shop all')

  const campaignImage =
    typeof content.campaign_image === 'string' && content.campaign_image
      ? content.campaign_image
      : MIZU_DEMO.campaign
  const campaignKicker = slotText(content, 'campaign_kicker', "FW’25 COLLECTION")
  const campaignTitle = slotText(content, 'campaign_title', 'Elegant and Timeless.')
  const campaignCta = slotText(content, 'campaign_cta', 'Discover more')

  const collectionsTitle = slotText(content, 'collections_title', 'Featured collections')
  const collections = [1, 2, 3].map((n) => ({
    title: slotText(content, `collection_${n}_title`, ['Jackets & Coats', 'Dresses', 'Accessories'][n - 1]!),
    image:
      typeof content[`collection_${n}_image`] === 'string' && content[`collection_${n}_image`]
        ? (content[`collection_${n}_image`] as string)
        : MIZU_DEMO.collections[n - 1]!,
  }))

  const exploreTitle = slotText(content, 'explore_title', 'Explore and Discover')
  const exploreBody = slotText(
    content,
    'explore_body',
    'Mizu’s flexible and versatile design allows it to be adapted for many different types of ecommerce websites and stores.',
  )
  const exploreCta = slotText(content, 'explore_cta', 'Learn more')

  const menImage =
    typeof content.men_image === 'string' && content.men_image ? content.men_image : MIZU_DEMO.men
  const menTitle = slotText(content, 'men_title', 'Men')
  const menBody = slotText(
    content,
    'men_body',
    'The Mizu men’s collection was designed to embody sophistication. Featuring beautiful silhouettes and an earthy colour palette, this season’s pieces were inspired by the autumn landscapes of Norway.',
  )
  const menCta = slotText(content, 'men_cta', 'Explore')

  const womenImage =
    typeof content.women_image === 'string' && content.women_image ? content.women_image : MIZU_DEMO.women
  const womenTitle = slotText(content, 'women_title', 'Women')
  const womenBody = slotText(
    content,
    'women_body',
    'The Mizu women’s collection was designed to embody sophistication. Featuring beautiful silhouettes and an earthy colour palette, this season’s pieces were inspired by the autumn landscapes of Norway.',
  )
  const womenCta = slotText(content, 'women_cta', 'Explore')

  const movementImage =
    typeof content.movement_image === 'string' && content.movement_image
      ? content.movement_image
      : MIZU_DEMO.movement
  const movementKicker = slotText(content, 'movement_kicker', 'Join the movement')
  const movementTitle = slotText(content, 'movement_title', 'Effortless, Eco-friendly Styles')

  const shopcatTitle = slotText(content, 'shopcat_title', 'Shop by category')
  const shopcatBody = slotText(
    content,
    'shopcat_body',
    'Discover and explore our curated collection of timeless pieces, designed to be worn with confidence.',
  )

  const categoryItems = (() => {
    const fromSlot = Array.isArray(content.categories) ? content.categories : []
    if (fromSlot.length > 0) {
      return fromSlot.slice(0, 5).map((row, index) => ({
        key: `cat-${index}`,
        label:
          typeof row === 'object' && row && 'label' in row && typeof row.label === 'string' && row.label.trim()
            ? row.label
            : MIZU_DEFAULT_CATS[index] || `Category ${index + 1}`,
        image:
          typeof row === 'object' && row && 'image' in row && typeof row.image === 'string' && row.image
            ? row.image
            : MIZU_DEMO.categories[index % MIZU_DEMO.categories.length]!,
      }))
    }
    return MIZU_DEFAULT_CATS.map((label, index) => ({
      key: `demo-${index}`,
      label,
      image: MIZU_DEMO.categories[index]!,
    }))
  })()

  const footerTagline = slotText(
    content,
    'footer_tagline',
    'Founded with a vision to bring understated luxury to the forefront, Mizu is dedicated to offering minimal designs that speak to both quality and style.',
  )
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Our company',
    links: 'About us | #about\nDelivery & Shipping | #newin\nContact us | #footer\nStores | #shopcat\nSecure Payment | #footer',
  })
  const footerCol2 = readFooterColumn(content, 2, {
    title: 'Account',
    links: 'My account | account\nCart | cart\nCheckout | checkout\nLost password | login',
  })
  const footerCol3Title = slotText(content, 'footer_col3_title', 'Store Information')
  const storeLines = lines(
    slotText(
      content,
      'footer_store_lines',
      [model.title || 'Mizu Theme – Minimalist Luxury Fashion', model.contact_address || '1 Example Road', model.contact_phone || '', model.contact_email || '']
        .filter(Boolean)
        .join('\n') || 'Mizu Theme – Minimalist Luxury Fashion\n1 Example Road\nAAAA 111\nUnited Kingdom',
    ),
  )
  const footerLegal = readFooterLegal(content, 'Terms and conditions of use | #\nLegal Notice | #')

  const brand = model.title || 'Mizu'
  const active = heroSlides[slide] ?? heroSlides[0]!

  const nav = [
    { href: '#newin', label: 'New in' },
    { href: '#women', label: 'Women' },
    { href: '#men', label: 'Men' },
    { href: '#shopcat', label: 'Accessories' },
    { href: '#about', label: 'About us' },
    { href: '#collections', label: 'Blog' },
  ]

  return (
    <Shell model={model}>
      {/* Header — minimal luxury */}
      <header className="sticky top-0 z-40 border-b border-[#eee] bg-white/95 backdrop-blur-md">
        <div className={`${M.wide} grid h-[72px] grid-cols-[1fr_auto_1fr] items-center gap-3`}>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-[#232323] lg:flex">
            {nav.slice(0, 3).map((item) => (
              <a key={item.label} href={item.href} className="transition hover:opacity-55">
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="#hero"
            className="justify-self-center text-[18px] font-semibold tracking-[0.12em] uppercase text-[#232323]"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {model.logo_url ? (
              <img src={model.logo_url} alt="" className="h-8 w-auto max-w-[140px] object-contain" />
            ) : (
              brand
            )}
          </a>
          <div className="flex items-center justify-end gap-4 text-[13px] font-medium text-[#232323]">
            <nav className="mr-2 hidden items-center gap-6 lg:flex">
              {nav.slice(3).map((item) => (
                <a key={item.label} href={item.href} className="transition hover:opacity-55">
                  {item.label}
                </a>
              ))}
            </nav>
            <button type="button" onClick={() => (shop?.customer ? shop.openAccount() : shop?.openLogin())}>
              Login
            </button>
            <button type="button" onClick={() => shop?.openCart()}>
              Cart {shop?.cartCount ?? 0}
            </button>
          </div>
        </div>
      </header>

      {/* Hero — 95vh cover + caption UNDER image (Mizu signature) */}
      <section id="hero" className="bg-white">
        <div className="relative min-h-[95vh] w-full overflow-hidden bg-[#111]">
          {heroSlides.map((s, i) => (
            <img
              key={s.title + i}
              src={s.image}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                i === slide ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ objectPosition: i === 0 ? '65% 40%' : '40% 48%' }}
            />
          ))}
          {heroSlides.length > 1 ? (
            <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1.5 w-1.5 rounded-full transition ${i === slide ? 'bg-white' : 'bg-white/40'}`}
                  onClick={() => setSlide(i)}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className={`${M.wide} py-6 sm:py-8`}>
          <h1
            className="max-w-4xl text-[28px] font-medium leading-tight tracking-tight text-[#232323] sm:text-[36px] lg:text-[42px]"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            <a href="#newin" className="transition hover:opacity-70">
              {active.title}
            </a>
          </h1>
          <p className="mt-2 text-[14px] text-[#7a7a7a] sm:text-[15px]">{active.subtitle}</p>
        </div>
      </section>

      {/* New In */}
      <section id="newin" className="bg-white pb-16 pt-6 sm:pb-20 sm:pt-10">
        <div className={`${M.wide} mb-7 flex items-end justify-between gap-4`}>
          <h2
            className="text-[28px] font-medium tracking-tight text-[#232323] sm:text-[34px]"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {newinTitle}
          </h2>
          <a href="#shopcat" className="text-[13px] font-medium text-[#232323] underline-offset-4 hover:underline">
            {newinCta}
          </a>
        </div>
        <div className={M.wide}>
          <ProductRow products={newIn} id="mizu-newin" />
        </div>
      </section>

      {/* Campaign banner */}
      <section id="campaign" className="relative min-h-[70vh] overflow-hidden bg-[#111] text-white sm:min-h-[80vh]">
        <img src={campaignImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/25" />
        <div className={`${M.wide} relative z-10 flex min-h-[70vh] flex-col items-center justify-center py-20 text-center sm:min-h-[80vh]`}>
          <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-white/90">{campaignKicker}</p>
          <h2
            className="mt-4 max-w-3xl text-[36px] font-medium leading-tight sm:text-[48px] lg:text-[54px]"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {campaignTitle}
          </h2>
          <a
            href="#collections"
            className="mt-8 text-[13px] font-medium uppercase tracking-[0.14em] text-white underline underline-offset-8"
          >
            {campaignCta}
          </a>
        </div>
      </section>

      {/* Featured collections */}
      <section id="collections" className="bg-white py-14 sm:py-16">
        <div className={`${M.wide} mb-8 flex items-center justify-end`}>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#232323]">
            {collectionsTitle} →
          </h2>
        </div>
        <div className={`${M.wide} grid gap-3 sm:grid-cols-3 sm:gap-4`}>
          {collections.map((col) => (
            <a key={col.title} href="#shopcat" className="group relative aspect-[3/4] overflow-hidden bg-[#f3f3f3]">
              <img
                src={col.image}
                alt=""
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-5 pt-16">
                <div
                  className="text-[18px] font-medium uppercase tracking-wide text-white sm:text-[20px]"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {col.title}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Explore & discover */}
      <section id="about" className="bg-white py-16 sm:py-20">
        <div className={`${M.content} text-center`}>
          <h2
            className="text-[28px] font-medium tracking-tight text-[#232323] sm:text-[36px] lg:text-[44px]"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {exploreTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#7a7a7a]">{exploreBody}</p>
          <a
            href="#men"
            className="mt-8 inline-block text-[13px] font-medium text-[#232323] underline underline-offset-4"
          >
            {exploreCta}
          </a>
        </div>
      </section>

      {/* Men / Women */}
      <section className="grid lg:grid-cols-2">
        {[
          { id: 'men', image: menImage, title: menTitle, body: menBody, cta: menCta },
          { id: 'women', image: womenImage, title: womenTitle, body: womenBody, cta: womenCta },
        ].map((panel) => (
          <div key={panel.id} id={panel.id} className="relative min-h-[72vh] overflow-hidden bg-[#111] text-white sm:min-h-[80vh]">
            <img src={panel.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <div className="relative z-10 flex min-h-[72vh] flex-col justify-end p-8 sm:min-h-[80vh] sm:p-12 lg:p-14">
              <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/80">{panel.title}</div>
              <h3
                className="mt-3 max-w-md text-[32px] font-medium leading-tight sm:text-[40px]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                {panel.title}
              </h3>
              <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/80">{panel.body}</p>
              <a
                href="#shopcat"
                className="mt-7 inline-flex w-fit border border-white px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-white hover:text-[#232323]"
              >
                {panel.cta}
              </a>
            </div>
          </div>
        ))}
      </section>

      {/* Movement banner */}
      <section className="relative min-h-[55vh] overflow-hidden bg-[#111] text-white sm:min-h-[62vh]">
        <img src={movementImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/35" />
        <div className={`${M.wide} relative z-10 flex min-h-[55vh] flex-col items-center justify-center py-16 text-center sm:min-h-[62vh]`}>
          <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-white/85">{movementKicker}</p>
          <h2
            className="mt-4 max-w-3xl text-[34px] font-medium leading-tight sm:text-[46px] lg:text-[52px]"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {movementTitle}
          </h2>
        </div>
      </section>

      {/* Shop by category */}
      <section id="shopcat" className="bg-white py-16 sm:py-20">
        <div className={`${M.wide} mb-3`}>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#232323]">
            {shopcatTitle} →
          </h2>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[#7a7a7a]">{shopcatBody}</p>
        </div>
        <div className={`${M.wide} mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5`}>
          {categoryItems.map((cat) => (
            <a key={cat.key} href="#newin" className="group">
              <div className="aspect-[3/4] overflow-hidden bg-[#f3f3f3]">
                <img
                  src={cat.image}
                  alt=""
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                />
              </div>
              <div className="mt-3 text-[14px] font-medium text-[#232323] group-hover:underline">{cat.label}</div>
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="border-t border-[#eee] bg-white text-[#232323]">
        <div className={`${M.wide} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4`}>
          <div>
            <div
              className="text-[18px] font-semibold tracking-[0.1em] uppercase"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {brand}
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-[#7a7a7a]">{footerTagline}</p>
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#232323]">{footerCol1.title}</div>
            <FooterLinkList
              links={footerCol1.links}
              className="mt-4 space-y-2 text-[13px] text-[#7a7a7a]"
              itemClassName="transition hover:text-[#232323]"
            />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#232323]">{footerCol2.title}</div>
            <FooterLinkList
              links={footerCol2.links}
              className="mt-4 space-y-2 text-[13px] text-[#7a7a7a]"
              itemClassName="transition hover:text-[#232323]"
            />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#232323]">{footerCol3Title}</div>
            <ul className="mt-4 space-y-2 text-[13px] text-[#7a7a7a]">
              {storeLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
              {model.contact_email ? (
                <li>
                  <a href={`mailto:${model.contact_email}`} className="hover:text-[#232323]">
                    {model.contact_email}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        <div className={`${M.wide} flex flex-col gap-3 border-t border-[#eee] py-5 text-[12px] text-[#7a7a7a] sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            © {new Date().getFullYear()} {brand}. All Rights Reserved.
          </div>
          <FooterLinkList links={footerLegal} inline className="flex flex-wrap gap-4" itemClassName="hover:text-[#232323]" />
        </div>
      </footer>
    </Shell>
  )
}
