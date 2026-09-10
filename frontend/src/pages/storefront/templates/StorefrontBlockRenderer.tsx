import { useEffect, useState, type ReactNode } from 'react'
import { formatRupiah } from '../../../lib/money'
import type { StorefrontBankAccount } from '../types'
import type { StorefrontBlock, StorefrontBlockProps, StorefrontCarouselSlide } from '../lib/storefrontBlocks'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import { EDITORIAL_DEMO } from './editorialDemo'
import { ProductSocialMeta } from './ProductSocialMeta'
import type { StorefrontRenderProduct } from './StorefrontSite'
import { useShop } from '../commerce/StorefrontShop'
import { withDemoFallback, withDemoImage } from './storefrontDemo'
import { storefrontFixed } from './storefrontNav'

export type BlockRendererModel = {
  title: string
  tagline?: string
  about?: string
  logo_url?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  contact_address?: string | null
  bank_accounts?: StorefrontBankAccount[]
  brand_colors?: {
    primary?: string
    accent?: string
    background?: string
    text?: string
  }
  products?: StorefrontRenderProduct[]
  preview?: boolean
  site_kind?: 'landing' | 'shop'
}

const SAMPLE_PRODUCTS: StorefrontRenderProduct[] = [
  { id: -1, name: 'Form 01 - Button Shirt', description: 'Soft cotton layer for everyday wear.', price: 699000, category_id: 1 },
  { id: -2, name: 'Form 07 - Cocoon Jacket', description: 'Relaxed outer with flared silhouette.', price: 769000, category_id: 1 },
  { id: -3, name: 'Form 17 - Poplin Shirt', description: 'Clean column cut for layering.', price: 699000, category_id: 1 },
  { id: -4, name: 'Form 22 - Long Vest', description: 'Structured vest for cooler days.', price: 789000, category_id: 2 },
  { id: -5, name: 'Form 38 - Linea Bermuda', description: 'Tailored short for warm weather.', price: 530000, category_id: 2 },
  { id: -6, name: 'Form 39 - Whisper Tee', description: 'Lightweight essential top.', price: 279000, category_id: 2 },
  { id: -7, name: 'Form 40 - Oversized Shirt', description: 'Relaxed fit with soft drape.', price: 589000, category_id: 1 },
  { id: -8, name: 'Form 36 - Stud Jacket', description: 'Statement outer with subtle detail.', price: 698000, category_id: 2 },
]

function colors(model: BlockRendererModel) {
  return {
    primary: model.brand_colors?.primary || '#0f766e',
    accent: model.brand_colors?.accent || '#f59e0b',
    background: model.brand_colors?.background || '#f8fafc',
    text: model.brand_colors?.text || '#0f172a',
  }
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

function BrandMark({ model, className = '' }: { model: BlockRendererModel; className?: string }) {
  if (model.logo_url) {
    return <img src={model.logo_url} alt={model.title} className={`object-contain ${className}`} />
  }
  return <span className={className}>{model.title}</span>
}

function Carousel({ slides }: { slides: StorefrontCarouselSlide[] }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (slides.length < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 4500)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null
  const slide = slides[index] ?? slides[0]

  return (
    <div className="relative h-[42vh] min-h-[240px] max-h-[480px] overflow-hidden">
      <MediaFill src={slide.image} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      {(slide.title || slide.subtitle) && (
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10">
          {slide.title ? <div className="font-display text-2xl font-semibold sm:text-4xl">{slide.title}</div> : null}
          {slide.subtitle ? <p className="mt-2 max-w-xl text-sm opacity-85 sm:text-base">{slide.subtitle}</p> : null}
        </div>
      )}
      {slides.length > 1 ? (
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 w-5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Shell({
  model,
  children,
  overlayHero,
}: {
  model: BlockRendererModel
  children: ReactNode
  overlayHero?: boolean
}) {
  const c = colors(model)
  const [navSolid, setNavSolid] = useState(!overlayHero)

  useEffect(() => {
    if (!overlayHero) return
    const onScroll = () => setNavSolid(window.scrollY > window.innerHeight * 0.45)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [overlayHero])

  const lightOnHero = Boolean(overlayHero && !navSolid)
  const navText = lightOnHero ? '#ffffff' : c.text
  const previewOffset = model.preview ? 'top-9' : 'top-0'
  const shop = useShop()
  const pin = storefrontFixed(model.preview)
  const barClass = !overlayHero
    ? 'relative border-b border-black/5 bg-transparent'
    : navSolid
      ? `${pin} inset-x-0 z-40 border-b border-neutral-200/35 bg-white/50 shadow-sm backdrop-blur-xl ${previewOffset}`
      : `${pin} inset-x-0 z-40 bg-gradient-to-b from-black/55 via-black/25 to-transparent ${previewOffset}`

  return (
    <div className="relative min-h-screen" style={{ background: c.background, color: c.text }}>
      {model.preview ? (
        <div className="sticky top-0 z-50 border-b border-black/10 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      <header className={`transition-colors duration-300 ${barClass}`} style={{ color: navText }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-3 text-lg font-semibold" style={{ color: lightOnHero ? '#fff' : c.primary }}>
            <BrandMark
              model={model}
              className={`h-9 max-w-[140px] ${lightOnHero ? 'brightness-0 invert' : ''}`}
            />
          </div>
          <nav className="flex items-center gap-5 text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: navText }}>
            <a href="#content" style={{ color: navText }}>
              Konten
            </a>
            <a href="#kontak" style={{ color: navText }}>
              Kontak
            </a>
            <button
              type="button"
              style={{ color: navText }}
              onClick={() => (shop?.customer ? shop.openAccount() : shop?.openLogin())}
            >
              {shop?.customer ? 'Akun' : 'Login'}
            </button>
            <button type="button" style={{ color: navText }} onClick={() => shop?.openCart()}>
              Cart ({shop?.cartCount ?? 0})
            </button>
          </nav>
        </div>
      </header>
      <div id="content">{children}</div>
      {(model.bank_accounts?.length ?? 0) > 0 ? (
        <footer className="border-t border-black/5 px-6 py-8 text-center text-sm opacity-75">
          Transfer ke:{' '}
          {model.bank_accounts!.map((b) => `${b.bank_name} ${b.account_number} a/n ${b.account_name}`).join(' · ')}
        </footer>
      ) : null}
    </div>
  )
}

function HeroBlock({ model, props }: { model: BlockRendererModel; props: StorefrontBlockProps }) {
  const c = colors(model)
  const headline = props.headline || model.title
  const sub = props.subheadline || model.tagline || ''
  const cta = props.cta || 'Pelajari lebih lanjut'
  const fullbleed = props.style === 'fullbleed'

  if (fullbleed) {
    const image = withDemoImage(model, props.image, EDITORIAL_DEMO.hero)
    return (
      <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden text-white">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{headline}</h1>
          {sub ? <p className="mt-4 max-w-xl text-sm text-white/90 sm:text-base">{sub}</p> : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-between px-5 pb-8 text-[12px] tracking-[0.08em] sm:px-8">
          <span>{props.kicker_left || ''}</span>
          <span>{props.kicker_right || ''}</span>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden">
      {props.image ? (
        <div className="absolute inset-0">
          <MediaFill src={props.image} />
          <div className="absolute inset-0 bg-black/45" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${c.primary}28, ${c.accent}20)` }} />
      )}
      <div className={`relative px-6 py-20 text-center ${props.image ? 'text-white' : ''}`}>
        <h1 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">{headline}</h1>
        {sub ? <p className={`mx-auto mt-4 max-w-xl text-lg ${props.image ? 'opacity-90' : 'opacity-75'}`}>{sub}</p> : null}
        <a
          href="#kontak"
          className="mt-8 inline-flex rounded-full px-6 py-3 text-sm font-medium text-white"
          style={{ background: props.image ? 'rgba(255,255,255,0.18)' : c.primary }}
        >
          {cta}
        </a>
      </div>
    </section>
  )
}

function ProductGridBlock({
  model,
  props,
  categoryId,
  categoryLabel,
  onClearFilter,
}: {
  model: BlockRendererModel
  props: StorefrontBlockProps
  categoryId?: number | null
  categoryLabel?: string | null
  onClearFilter?: () => void
}) {
  const shop = useShop()
  const c = colors(model)
  const all = withDemoFallback(model, model.products ?? [], SAMPLE_PRODUCTS)
  const filtered =
    categoryId && categoryId > 0 ? all.filter((p) => (p.category_id ?? null) === categoryId) : all
  const products = filtered.slice(0, props.limit || 8)
  const title = categoryLabel
    ? `${props.title || 'Produk'} · ${categoryLabel}`
    : props.title

  return (
    <section id="shop-products" className="mx-auto max-w-6xl px-5 py-12">
      {title || props.body || categoryId ? (
        <div className="mb-8 grid gap-4 md:grid-cols-2 md:items-start">
          <div>
            {title ? <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2> : null}
            {categoryId ? (
              <button type="button" className="mt-2 text-sm opacity-70 underline" onClick={onClearFilter}>
                Tampilkan semua
              </button>
            ) : null}
          </div>
          {props.body && !categoryId ? <p className="text-sm leading-relaxed opacity-75">{props.body}</p> : null}
        </div>
      ) : null}
      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-sm opacity-60">
          Tidak ada produk di kategori ini.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="overflow-hidden rounded-3xl border border-black/5 bg-white text-left shadow-sm"
              onClick={() => shop?.openProduct(p)}
            >
              <div className="aspect-[3/4] overflow-hidden">
                <MediaFill
                  src={withDemoImage(model, p.image_url, EDITORIAL_DEMO.products[i % EDITORIAL_DEMO.products.length]!)}
                  fallback={`${c.primary}18`}
                />
              </div>
              <div className="space-y-1 p-4">
                <h3 className="font-medium">{p.name}</h3>
                <ProductSocialMeta
                  soldCount={p.sold_count}
                  avgRating={p.avg_rating}
                  reviewCount={p.review_count}
                />
                <div className="text-sm font-semibold" style={{ color: c.primary }}>
                  {formatRupiah(p.price)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function CategoryTilesBlock({
  model,
  props,
  activeCategoryId,
  onSelect,
}: {
  model: BlockRendererModel
  props: StorefrontBlockProps
  activeCategoryId?: number | null
  onSelect: (categoryId: number, label: string) => void
}) {
  const items =
    Array.isArray(props.items) && props.items.length > 0
      ? props.items
      : withDemoFallback(model, [], [
          {
            category_id: 0,
            label: props.left_label || 'Kategori 1',
            image: withDemoImage(model, props.left_image, EDITORIAL_DEMO.women),
          },
          {
            category_id: 0,
            label: props.right_label || 'Kategori 2',
            image: withDemoImage(model, props.right_image, EDITORIAL_DEMO.men),
          },
        ])

  const count = items.length
  const cols =
    count <= 1 ? 'grid-cols-1' : count === 2 ? 'md:grid-cols-2' : count === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'

  return (
    <section id="categories" className="px-0 py-0">
      {props.title ? (
        <div className="mx-auto max-w-6xl px-5 pb-4 pt-10 text-center text-xl font-semibold">{props.title}</div>
      ) : null}
      <div className={`grid min-h-[42vh] ${cols}`}>
        {items.map((item, index) => {
          const label = item.label?.trim() || `Kategori ${index + 1}`
          const image = withDemoImage(model, item.image, EDITORIAL_DEMO.gallery[index % EDITORIAL_DEMO.gallery.length]!)
          const active = item.category_id > 0 && activeCategoryId === item.category_id
          return (
            <button
              key={`${item.category_id}-${index}`}
              type="button"
              onClick={() => {
                if (item.category_id > 0) onSelect(item.category_id, label)
              }}
              className={`group relative min-h-[36vh] overflow-hidden text-left ${active ? 'ring-4 ring-inset ring-white/80' : ''}`}
            >
              {image ? (
                <img
                  src={image}
                  alt={label}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute inset-0 grid place-items-center px-4 text-center text-2xl font-medium tracking-wide text-white sm:text-3xl">
                {label}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function renderBlock(
  block: StorefrontBlock,
  model: BlockRendererModel,
  ctx: {
    categoryId: number | null
    categoryLabel: string | null
    onSelectCategory: (id: number, label: string) => void
    onClearCategory: () => void
  },
) {
  const c = colors(model)
  const props = block.props

  switch (block.type) {
    case 'hero':
      return <HeroBlock model={model} props={props} />
    case 'carousel':
      return <Carousel slides={Array.isArray(props.slides) ? props.slides : []} />
    case 'gallery': {
      const images =
        withDemoFallback(
          model,
          Array.isArray(props.images)
            ? props.images.filter((src): src is string => typeof src === 'string' && src.trim().length > 0)
            : [],
          EDITORIAL_DEMO.gallery.slice(0, 6),
        )
      return (
        <section className="mx-auto max-w-6xl px-5 py-12">
          {props.title ? <h2 className="mb-3 text-center text-xl font-semibold">{props.title}</h2> : null}
          {props.body ? <p className="mx-auto mb-8 max-w-2xl text-center text-sm opacity-70">{props.body}</p> : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {images.map((src, i) => (
              <div key={`${src}-${i}`} className="aspect-[3/4] overflow-hidden rounded-2xl">
                <MediaFill src={src} fallback={`${c.primary}22`} />
              </div>
            ))}
          </div>
          {props.cta ? (
            <div className="mt-6 text-center text-sm">
              <a href="#content" className="opacity-80 hover:opacity-100">
                {props.cta}
              </a>
            </div>
          ) : null}
        </section>
      )
    }
    case 'rich_text':
      return (
        <section className="mx-auto max-w-3xl px-5 py-12 text-center">
          {props.title ? <h2 className="text-2xl font-semibold">{props.title}</h2> : null}
          <p className="mt-3 text-sm leading-relaxed opacity-75">
            {props.body || model.about || 'Tambahkan teks di designer.'}
          </p>
        </section>
      )
    case 'product_grid':
      return (
        <ProductGridBlock
          model={model}
          props={props}
          categoryId={ctx.categoryId}
          categoryLabel={ctx.categoryLabel}
          onClearFilter={ctx.onClearCategory}
        />
      )
    case 'category_split':
      return (
        <CategoryTilesBlock model={model} props={props} activeCategoryId={ctx.categoryId} onSelect={ctx.onSelectCategory} />
      )
    case 'banner': {
      const image =
        props.style === 'shoppable'
          ? withDemoImage(model, props.image, EDITORIAL_DEMO.shoppable)
          : withDemoImage(model, props.image, EDITORIAL_DEMO.collection)
      if (props.style === 'compact') {
        return (
          <div className="mx-auto max-w-3xl overflow-hidden px-4 pt-4">
            <div className="aspect-[21/9] overflow-hidden rounded-2xl">
              <MediaFill src={image} />
            </div>
            {(props.title || props.body) && (
              <div className="px-1 py-3">
                {props.title ? <div className="font-semibold">{props.title}</div> : null}
                {props.body ? <p className="text-sm opacity-70">{props.body}</p> : null}
              </div>
            )}
          </div>
        )
      }
      return (
        <section className="relative min-h-[70vh] overflow-hidden text-white">
          {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
            <h2 className="text-3xl font-medium tracking-tight sm:text-5xl">{props.title || model.tagline || model.title}</h2>
            <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-white/90">
              {props.body || model.about || ''}
            </p>
          </div>
          {(props.kicker_left || props.kicker_right) && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex justify-between px-5 pb-8 text-[12px] tracking-[0.08em] sm:px-8">
              <span>{props.kicker_left || ''}</span>
              <span>{props.kicker_right || ''}</span>
            </div>
          )}
        </section>
      )
    }
    case 'contact':
      return (
        <section id="kontak" className="border-t border-black/5 px-6 py-12 text-center">
          <h2 className="text-xl font-semibold">Kontak</h2>
          <p className="mt-2 text-sm opacity-70">
            {[model.contact_phone, model.contact_email, model.contact_address].filter(Boolean).join(' · ') ||
              'Isi kontak di setup situs.'}
          </p>
        </section>
      )
    case 'spacer': {
      const h = props.size === 'sm' ? 'h-8' : props.size === 'lg' ? 'h-24' : 'h-14'
      return <div className={h} aria-hidden />
    }
    default:
      return null
  }
}

export function StorefrontBlockRenderer({
  model,
  blocks,
}: {
  model: BlockRendererModel
  blocks: StorefrontBlock[]
}) {
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null)
  const visible = blocks.filter((b) => b.visible !== false)

  function onSelectCategory(id: number, label: string) {
    setCategoryId(id)
    setCategoryLabel(label)
    window.requestAnimationFrame(() => {
      document.getElementById('shop-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function onClearCategory() {
    setCategoryId(null)
    setCategoryLabel(null)
  }

  return (
    <Shell
      model={model}
      overlayHero={visible.some((b) => b.type === 'hero' && b.props?.style === 'fullbleed')}
    >
      {visible.map((block) => (
        <div key={block.id}>
          {renderBlock(block, model, {
            categoryId,
            categoryLabel,
            onSelectCategory,
            onClearCategory,
          })}
        </div>
      ))}
    </Shell>
  )
}
