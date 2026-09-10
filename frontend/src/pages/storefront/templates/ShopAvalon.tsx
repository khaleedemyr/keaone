import { useEffect, type ReactNode } from 'react'
import { formatRupiah } from '../../../lib/money'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import { useShop } from '../commerce/StorefrontShop'
import type { StorefrontRenderModel, StorefrontRenderProduct } from './renderTypes'
import { FooterLinkList } from './FooterLinkList'
import { readFooterColumn, readFooterLegal } from '../lib/footerLinks'
import {
  AVALON_DEMO,
  AVALON_DEFAULT_CATS,
  AVALON_NEWEST_NAMES,
  AVALON_SALE_NAMES,
} from './avalonDemo'

/**
 * Avalon recreation from https://demo.anarieldesign.com/avalon/
 * (product page ref: /product/street-hoodie/)
 *
 * Measured tokens from theme CSS:
 * - contentSize 720px, wideSize 1620px, root padding 30px
 * - foreground #000, background #fff, primary #da3f3f, secondary #f5f5f5, tertiary #4c4c4c
 * - font: Outfit; headings weight 700; buttons squared, black, padding 7px 25px
 */

const A = {
  content: 'mx-auto w-full max-w-[720px] px-[30px]',
  wide: 'mx-auto w-full max-w-[1620px] px-[30px]',
  primary: '#da3f3f',
  fg: '#000000',
  bg: '#ffffff',
  secondary: '#f5f5f5',
  tertiary: '#4c4c4c',
  senary: '#cdcdcd',
  septenary: '#eeeeee',
} as const

function colors(model: StorefrontRenderModel) {
  if (!model.brand_colors?.primary) {
    return { primary: A.primary, accent: A.tertiary, background: A.bg, text: A.fg }
  }
  return {
    primary: model.brand_colors.primary || A.primary,
    accent: model.brand_colors.accent || A.tertiary,
    background: model.brand_colors.background || A.bg,
    text: model.brand_colors.text || A.fg,
  }
}

function theme(model: StorefrontRenderModel) {
  return model.theme_content ?? {}
}

function slotText(content: Record<string, unknown>, key: string, fallback: string) {
  const value = content[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function Shell({ model, children }: { model: StorefrontRenderModel; children: ReactNode }) {
  const c = colors(model)
  useEffect(() => {
    const id = 'avalon-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        background: c.background || A.bg,
        color: c.text,
        fontFamily: 'Outfit, system-ui, sans-serif',
        fontSize: '1.125rem',
        lineHeight: 1.5,
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

function AvalonButton({
  href,
  onClick,
  children,
  variant = 'solid',
}: {
  href?: string
  onClick?: () => void
  children: ReactNode
  variant?: 'solid' | 'outline' | 'light'
}) {
  const base =
    'inline-flex items-center justify-center px-[25px] py-[7px] text-[1.125rem] font-bold transition'
  const styles =
    variant === 'outline'
      ? 'border-2 border-black bg-transparent text-black hover:bg-black hover:text-white'
      : variant === 'light'
        ? 'border-2 border-white bg-transparent text-white hover:bg-white hover:text-black'
        : 'border-0 bg-black text-white hover:opacity-85'
  if (href) {
    return (
      <a href={href} className={`${base} ${styles}`}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  )
}

function ProductCard({
  product,
  imageFallback,
  sale,
  compareAt,
}: {
  product: StorefrontRenderProduct
  imageFallback: string
  sale?: boolean
  compareAt?: number
}) {
  const shop = useShop()
  const img = product.image_url || imageFallback
  return (
    <div className="group text-center">
      <button
        type="button"
        className="relative block w-full overflow-hidden bg-[#f5f5f5]"
        onClick={() => shop?.openProduct(product)}
      >
        <div className="aspect-[3/4] w-full">
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
        {sale ? (
          <span
            className="absolute left-3 top-3 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
            style={{ background: A.primary }}
          >
            Sale
          </span>
        ) : null}
      </button>
      <button type="button" className="mt-4 text-left w-full" onClick={() => shop?.openProduct(product)}>
        <div className="text-[1.125rem] font-bold text-black">{product.name}</div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[1rem]">
          {sale && compareAt != null && compareAt > product.price ? (
            <>
              <span className="text-[#4c4c4c] line-through">{formatRupiah(compareAt)}</span>
              <span className="font-semibold" style={{ color: A.primary }}>
                {formatRupiah(product.price)}
              </span>
            </>
          ) : (
            <span className="font-semibold text-black">{formatRupiah(product.price)}</span>
          )}
        </div>
        {(product.avg_rating ?? 0) > 0 ? (
          <div className="mt-1 text-[13px] text-[#4c4c4c]">
            {'★'.repeat(Math.round(Math.min(5, product.avg_rating || 5)))}{' '}
            <span className="text-[12px]">({product.review_count ?? 1})</span>
          </div>
        ) : null}
      </button>
      <button
        type="button"
        className="mt-3 text-[14px] font-bold text-black underline-offset-4 hover:underline"
        onClick={() => shop?.openProduct(product)}
      >
        Select options
      </button>
    </div>
  )
}

function demoProducts(
  names: string[],
  prices: number[],
  opts?: { deal?: boolean; rated?: boolean },
): StorefrontRenderProduct[] {
  return names.map((name, i) => ({
    id: -(i + 1),
    name,
    description: '',
    price: prices[i] ?? 249000,
    image_url: AVALON_DEMO.products[i % AVALON_DEMO.products.length],
    is_deal: opts?.deal ?? false,
    is_new_arrival: !opts?.deal,
    avg_rating: opts?.rated && i < 2 ? 5 : undefined,
    review_count: opts?.rated && i < 2 ? 1 : undefined,
  }))
}

export function ShopAvalon({ model }: { model: StorefrontRenderModel }) {
  const content = theme(model)
  const c = colors(model)
  const shop = useShop()
  const brand = model.title || 'avalon'

  const catalog = model.products?.length
    ? model.products
    : [
        ...demoProducts(AVALON_SALE_NAMES, [240000, 624000, 784000], { deal: true }),
        ...demoProducts(AVALON_NEWEST_NAMES, [624000, 240000, 1584000, 784000], { rated: true }).map(
          (p, i) => ({
            ...p,
            id: -(i + 10),
            image_url: AVALON_DEMO.products[(i + 3) % AVALON_DEMO.products.length],
          }),
        ),
      ]

  const saleProducts = (() => {
    const deals = catalog.filter((p) => p.is_deal)
    if (deals.length) return deals.slice(0, 3)
    return catalog.slice(0, 3)
  })()

  const newestProducts = (() => {
    const rest = catalog.filter((p) => !saleProducts.some((s) => s.id === p.id))
    const pool = rest.length ? rest : catalog
    return pool.slice(0, 4)
  })()

  const announce = slotText(
    content,
    'announce_text',
    'Free Delivery on orders over Rp 100.000. Don’t miss it!',
  )
  const heroImage =
    typeof content.hero_image === 'string' && content.hero_image ? content.hero_image : AVALON_DEMO.hero
  const heroKicker = slotText(content, 'hero_kicker', 'Winter Sale')
  const heroBadge = slotText(content, 'hero_badge', '-40%')
  const heroHeadline = slotText(
    content,
    'hero_headline',
    'Welcome to the winter fashion sale! Get ready to save on the latest looks!',
  )
  const heroCta = slotText(content, 'hero_cta', 'Shop the Sale')

  const saleTitle = slotText(content, 'sale_title', 'On Sale')
  const saleBody = slotText(
    content,
    'sale_body',
    'Our winter fashion sale is now on, with up to 40% off select styles.',
  )

  const collectionImage =
    typeof content.collection_image === 'string' && content.collection_image
      ? content.collection_image
      : AVALON_DEMO.collection
  const collectionKicker = slotText(content, 'collection_kicker', 'New')
  const collectionTitle = slotText(content, 'collection_title', 'Collection')
  const collectionCta = slotText(content, 'collection_cta', 'Shop Now')

  const newestTitle = slotText(content, 'newest_title', 'Newest Products')
  const newestBody = slotText(
    content,
    'newest_body',
    'The newest fashion products have been all about bold, daring and unique designs.',
  )

  const saleBannerImage =
    typeof content.sale_banner_image === 'string' && content.sale_banner_image
      ? content.sale_banner_image
      : AVALON_DEMO.saleBanner
  const saleBannerKicker = slotText(content, 'sale_banner_kicker', 'On Sale')
  const saleBannerTitle = slotText(content, 'sale_banner_title', 'Collection')
  const saleBannerCta = slotText(content, 'sale_banner_cta', 'Shop the Sale')

  const catsTitle = slotText(content, 'cats_title', 'Shop by Categories')
  const catsBody = slotText(
    content,
    'cats_body',
    'Browse through our categories to find the perfect look for you.',
  )
  const categoryItems = (() => {
    const fromSlot = Array.isArray(content.categories) ? content.categories : []
    if (fromSlot.length > 0) {
      return fromSlot.slice(0, 5).map((row, index) => ({
        key: `cat-${index}`,
        label:
          typeof row === 'object' && row && 'label' in row && typeof row.label === 'string' && row.label.trim()
            ? row.label
            : AVALON_DEFAULT_CATS[index] || `Category ${index + 1}`,
        image:
          typeof row === 'object' && row && 'image' in row && typeof row.image === 'string' && row.image
            ? row.image
            : AVALON_DEMO.categories[index % AVALON_DEMO.categories.length]!,
      }))
    }
    return AVALON_DEFAULT_CATS.map((label, index) => ({
      key: `demo-${index}`,
      label,
      image: AVALON_DEMO.categories[index]!,
    }))
  })()

  const trusts = [1, 2, 3, 4].map((n) => ({
    title: slotText(
      content,
      `trust_${n}_title`,
      ['Free Shipping', 'Money Guarantee', 'Online Support', 'Flexible Payment'][n - 1]!,
    ),
    body: slotText(
      content,
      `trust_${n}_body`,
      [
        'Free Shipping for orders over Rp 110.000',
        'Within 30 days for an exchange.',
        '24 hours a day, 7 days a week',
        'Pay with Multiple Credit Cards',
      ][n - 1]!,
    ),
  }))

  const companyBody = slotText(content, 'footer_company_body', 'Find a location nearest you.')
  const companyCta = slotText(content, 'footer_company_cta', 'See Our Stores')
  const footerCol1 = readFooterColumn(content, 1, {
    title: 'Information',
    links: 'Shop | #newest\nMy Account | account\nCart | cart\nCheckout | checkout',
  })
  const footerCol2 = readFooterColumn(content, 2, {
    title: 'Services',
    links: 'About Us | #collection\nCareers | #footer\nDelivery Info | #trust\nPrivacy Policy | #footer',
  })
  const footerCol3 = readFooterColumn(content, 3, {
    title: 'Social Media',
    links: 'Twitter | #\nFacebook | #\nInstagram | #\nPinterest | #',
  })
  const footerLegal = readFooterLegal(content, 'Privacy Policy | #\nTerms of Use | #')

  const nav = [
    { href: '#hero', label: 'Home' },
    { href: '#sale', label: 'Shop' },
    { href: '#collection', label: 'Collection' },
    { href: '#newest', label: 'New' },
    { href: '#cats', label: 'Categories' },
    { href: '#footer', label: 'Contact' },
  ]

  return (
    <Shell model={model}>
      {/* Announcement */}
      <div className="bg-black px-4 py-2.5 text-center text-[13px] font-medium text-white sm:text-[14px]">
        {announce}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#eee] bg-white">
        <div className={`${A.wide} flex h-11 items-center justify-between text-[13px] text-[#4c4c4c]`}>
          <div className="hidden gap-3 sm:flex">
            {['Facebook', 'Instagram', 'Pinterest'].map((s) => (
              <span key={s} className="hover:text-black">
                {s}
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <button type="button" className="hover:text-black" onClick={() => shop?.openLogin()}>
              Search
            </button>
            <button type="button" className="font-semibold text-black" onClick={() => shop?.openCart()}>
              {shop?.cartCount ?? 0}
            </button>
          </div>
        </div>
        <div className={`${A.wide} flex h-[72px] items-center justify-between gap-4`}>
          <a href="#hero" className="text-[28px] font-bold tracking-tight lowercase text-black sm:text-[32px]">
            {model.logo_url ? (
              <img src={model.logo_url} alt="" className="h-9 w-auto max-w-[160px] object-contain" />
            ) : (
              brand
            )}
          </a>
          <nav className="hidden items-center gap-7 text-[15px] font-medium text-black lg:flex">
            {nav.map((item) => (
              <a key={item.label} href={item.href} className="transition hover:opacity-55">
                {item.label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            className="text-[14px] font-bold text-black lg:hidden"
            onClick={() => shop?.openCart()}
          >
            Cart
          </button>
        </div>
      </header>

      {/* Hero sale */}
      <section id="hero" className="relative min-h-[78vh] overflow-hidden bg-black text-white sm:min-h-[88vh]">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
        <div className={`${A.wide} relative z-10 flex min-h-[78vh] items-center py-16 sm:min-h-[88vh]`}>
          <div className="max-w-xl">
            <div className="flex flex-wrap items-end gap-3">
              <h1 className="text-[42px] font-bold leading-[1.1] sm:text-[56px] lg:text-[64px]">{heroKicker}</h1>
              <span
                className="mb-2 inline-block px-3 py-1 text-[22px] font-bold sm:text-[28px]"
                style={{ background: c.primary || A.primary }}
              >
                {heroBadge}
              </span>
            </div>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/90 sm:text-[18px]">{heroHeadline}</p>
            <div className="mt-8">
              <AvalonButton href="#sale" variant="light">
                {heroCta}
              </AvalonButton>
            </div>
          </div>
        </div>
      </section>

      {/* On Sale */}
      <section id="sale" className="bg-white py-16 sm:py-20">
        <div className={`${A.wide} mb-10 text-center`}>
          <h2 className="text-[32px] font-bold tracking-tight text-black sm:text-[40px]">{saleTitle}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-[#4c4c4c] sm:text-[16px]">{saleBody}</p>
        </div>
        <div className={`${A.wide} grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10`}>
          {saleProducts.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              imageFallback={AVALON_DEMO.products[i % AVALON_DEMO.products.length]!}
              sale
              compareAt={Math.round(p.price * 1.25)}
            />
          ))}
        </div>
      </section>

      {/* New Collection */}
      <section id="collection" className="relative min-h-[62vh] overflow-hidden bg-[#111] text-white sm:min-h-[70vh]">
        <img src={collectionImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/40" />
        <div className={`${A.wide} relative z-10 flex min-h-[62vh] flex-col items-center justify-center py-20 text-center sm:min-h-[70vh]`}>
          <p className="text-[14px] font-semibold uppercase tracking-[0.2em] text-white/85">{collectionKicker}</p>
          <h2 className="mt-2 text-[44px] font-bold leading-none sm:text-[64px] lg:text-[72px]">{collectionTitle}</h2>
          <div className="mt-8">
            <AvalonButton href="#newest" variant="light">
              {collectionCta}
            </AvalonButton>
          </div>
        </div>
      </section>

      {/* Newest Products */}
      <section id="newest" className="bg-white py-16 sm:py-20">
        <div className={`${A.wide} mb-10 text-center`}>
          <h2 className="text-[32px] font-bold tracking-tight text-black sm:text-[40px]">{newestTitle}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-[#4c4c4c] sm:text-[16px]">{newestBody}</p>
        </div>
        <div className={`${A.wide} grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8`}>
          {newestProducts.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              imageFallback={AVALON_DEMO.products[(i + 3) % AVALON_DEMO.products.length]!}
            />
          ))}
        </div>
      </section>

      {/* On Sale Collection banner */}
      <section className="relative min-h-[55vh] overflow-hidden bg-[#111] text-white sm:min-h-[62vh]">
        <img src={saleBannerImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <div className={`${A.wide} relative z-10 flex min-h-[55vh] flex-col items-center justify-center py-16 text-center sm:min-h-[62vh]`}>
          <p className="text-[14px] font-semibold uppercase tracking-[0.2em] text-white/85">{saleBannerKicker}</p>
          <h2 className="mt-2 text-[44px] font-bold leading-none sm:text-[64px]">{saleBannerTitle}</h2>
          <div className="mt-8">
            <AvalonButton href="#sale" variant="light">
              {saleBannerCta}
            </AvalonButton>
          </div>
        </div>
      </section>

      {/* Shop by Categories */}
      <section id="cats" className="bg-white py-16 sm:py-20">
        <div className={`${A.wide} mb-10 text-center`}>
          <h2 className="text-[32px] font-bold tracking-tight text-black sm:text-[40px]">{catsTitle}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-[#4c4c4c] sm:text-[16px]">{catsBody}</p>
        </div>
        <div className={`${A.wide} grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6`}>
          {categoryItems.map((cat) => (
            <a key={cat.key} href="#newest" className="group text-center">
              <div className="aspect-square overflow-hidden bg-[#f5f5f5]">
                <img
                  src={cat.image}
                  alt=""
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <div className="mt-3 text-[15px] font-bold text-black group-hover:underline">{cat.label}</div>
            </a>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="border-y border-[#eee] bg-[#f5f5f5] py-12 sm:py-14">
        <div className={`${A.wide} grid gap-8 sm:grid-cols-2 lg:grid-cols-4`}>
          {trusts.map((t) => (
            <div key={t.title} className="text-center sm:text-left">
              <div className="text-[16px] font-bold text-black">{t.title}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#4c4c4c]">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="bg-white text-black">
        <div className={`${A.wide} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4`}>
          <div>
            <div className="text-[16px] font-bold">Company</div>
            <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-[#4c4c4c]">{companyBody}</p>
            <a href="#cats" className="mt-3 inline-block text-[14px] font-bold underline underline-offset-4">
              {companyCta}
            </a>
            <div className="mt-5 space-y-1 text-[14px] text-[#4c4c4c]">
              {model.contact_phone ? <div>{model.contact_phone}</div> : <div>+391 (0)35 2568 4593</div>}
              {model.contact_email ? (
                <a href={`mailto:${model.contact_email}`} className="hover:text-black">
                  {model.contact_email}
                </a>
              ) : (
                <div>hello@domain.com</div>
              )}
            </div>
          </div>
          <div>
            <div className="text-[16px] font-bold">{footerCol1.title}</div>
            <FooterLinkList
              links={footerCol1.links}
              className="mt-4 space-y-2 text-[14px] text-[#4c4c4c]"
              itemClassName="transition hover:text-black"
            />
          </div>
          <div>
            <div className="text-[16px] font-bold">{footerCol2.title}</div>
            <FooterLinkList
              links={footerCol2.links}
              className="mt-4 space-y-2 text-[14px] text-[#4c4c4c]"
              itemClassName="transition hover:text-black"
            />
          </div>
          <div>
            <div className="text-[16px] font-bold">{footerCol3.title}</div>
            <FooterLinkList
              links={footerCol3.links}
              className="mt-4 space-y-2 text-[14px] text-[#4c4c4c]"
              itemClassName="transition hover:text-black"
            />
          </div>
        </div>
        <div className={`${A.wide} flex flex-col gap-3 border-t border-[#eee] py-5 text-[13px] text-[#4c4c4c] sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            © {new Date().getFullYear()} {brand}
          </div>
          <FooterLinkList links={footerLegal} inline className="flex flex-wrap gap-4" itemClassName="hover:text-black" />
        </div>
      </footer>
    </Shell>
  )
}
