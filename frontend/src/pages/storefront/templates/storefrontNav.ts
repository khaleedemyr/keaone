import type { MouseEvent } from 'react'
import { useEffect, useRef, useState, type RefObject } from 'react'

/** Common cross-template section aliases (stale nav after template switch). */
const SECTION_ALIASES: Record<string, string[]> = {
  home: ['home', 'top', 'hero'],
  top: ['top', 'home', 'hero'],
  hero: ['hero', 'home', 'top'],
  about: ['about', 'home', 'features', 'hero'],
  awards: ['awards', 'cases', 'skills', 'team'],
  gallery: ['gallery', 'works', 'projects', 'portfolio'],
  services: ['services', 'practice', 'features', 'departments'],
  practice: ['practice', 'services', 'features'],
  projects: ['projects', 'works', 'gallery', 'portfolio'],
  works: ['works', 'projects', 'gallery', 'portfolio'],
  portfolio: ['portfolio', 'works', 'projects', 'gallery'],
  team: ['team', 'attorneys', 'doctors'],
  attorneys: ['attorneys', 'team'],
  doctors: ['doctors', 'team'],
  features: ['features', 'services', 'about'],
  pricing: ['pricing', 'plans'],
  plans: ['plans', 'pricing'],
  faq: ['faq'],
  news: ['news'],
  contact: ['contact', 'contacts', 'kontak'],
  contacts: ['contacts', 'contact', 'kontak'],
  kontak: ['kontak', 'contact', 'contacts'],
  appointment: ['appointment', 'quote', 'contact', 'kontak'],
  quote: ['quote', 'appointment', 'contact'],
  cases: ['cases', 'awards', 'projects'],
  departments: ['departments', 'services', 'practice'],
  skills: ['skills', 'awards', 'services'],
  // Shop templates
  drop: ['drop', 'shop', 'categories', 'newin'],
  categories: ['categories', 'cats', 'shop', 'shopcat', 'drop'],
  cats: ['cats', 'categories', 'shopcat'],
  bestsellers: ['bestsellers', 'trending', 'products'],
  stories: ['stories', 'collections', 'about'],
  newin: ['newin', 'newest', 'arrivals', 'drop'],
  newest: ['newest', 'newin', 'arrivals'],
  women: ['women', 'shopcat', 'categories', 'collections'],
  men: ['men', 'shopcat', 'categories', 'collections'],
  shopcat: ['shopcat', 'categories', 'cats', 'collections'],
  collections: ['collections', 'stories', 'shopcat'],
  campaign: ['campaign', 'sale', 'deals'],
  sale: ['sale', 'deals', 'campaign'],
  collection: ['collection', 'collections', 'shop'],
  products: ['products', 'shop', 'bestsellers'],
  reviews: ['reviews', 'trust'],
  consult: ['consult', 'kontak', 'contact', 'appointment'],
  deals: ['deals', 'sale', 'bestsellers'],
  arrivals: ['arrivals', 'newin', 'newest'],
  trending: ['trending', 'bestsellers', 'products'],
  story: ['story', 'about', 'stories'],
  shop: ['shop', 'categories', 'drop', 'products'],
  footer: ['footer', 'contact', 'kontak'],
}

export function sectionIdCandidates(id: string): string[] {
  const key = id.trim().toLowerCase()
  if (!key) return []
  const aliased = SECTION_ALIASES[key]
  if (aliased?.length) return aliased
  return [key]
}

export function findStorefrontSection(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  for (const candidate of sectionIdCandidates(id)) {
    const el = document.getElementById(candidate)
    if (el) return el
  }
  return null
}

function hashId(href: string): string {
  return (href || '').trim().replace(/^#/, '').toLowerCase()
}

function navHrefHitsTemplate(href: string, knownIds: Set<string>): boolean {
  const id = hashId(href)
  if (!id) return false
  if (knownIds.has(id)) return true
  return sectionIdCandidates(id).some((c) => knownIds.has(c))
}

function remapNavHref(href: string, knownIds: Set<string>): string {
  const id = hashId(href)
  if (!id) return href.startsWith('#') ? href : `#${href}`
  if (knownIds.has(id)) return `#${id}`
  for (const c of sectionIdCandidates(id)) {
    if (knownIds.has(c)) return `#${c}`
  }
  return href.startsWith('#') ? href : `#${href}`
}

/**
 * If saved nav_links still point at another template’s sections
 * (e.g. Ellipse menu on Prompt), fall back to this template’s defaults.
 */
export function coerceNavForTemplate<T extends { detail?: string; href?: string; name?: string; label?: string }>(
  items: T[],
  fallback: T[],
  knownSectionIds: string[],
): T[] {
  const known = new Set(knownSectionIds.map((s) => s.toLowerCase()))
  if (!items.length) return fallback
  const getHref = (item: T) => item.detail || item.href || '#'
  const hits = items.filter((item) => navHrefHitsTemplate(getHref(item), known)).length
  const needed = Math.max(2, Math.ceil(items.length / 2))
  const dead = items.length - hits
  // Stale cross-template menus usually leave several dead anchors (e.g. #awards on Prompt).
  if (dead >= 2 || hits < needed) return fallback.length ? fallback : items
  return items.map((item) => {
    const href = remapNavHref(getHref(item), known)
    if ('detail' in item) return { ...item, detail: href }
    return { ...item, href }
  })
}

/** Smooth-scroll to an in-page section (works inside overflow preview panes). */
export function scrollToStorefrontSection(href: string): boolean {
  if (typeof document === 'undefined') return false
  const raw = (href || '').trim()
  if (!raw || raw === '#') {
    const top =
      findStorefrontSection('top') || findStorefrontSection('home') || findStorefrontSection('hero')
    if (top) {
      top.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    }
    document.scrollingElement?.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }
  if (!raw.startsWith('#')) return false
  const id = decodeURIComponent(raw.slice(1))
  if (!id) return false
  const el = findStorefrontSection(id)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  try {
    const resolved = el.id ? `#${el.id}` : raw
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${resolved}`)
  } catch {
    /* ignore */
  }
  return true
}

export function isStorefrontHashLink(href?: string | null): boolean {
  if (!href) return false
  const h = href.trim()
  if (!h || h === '#') return true
  if (!h.startsWith('#')) return false
  if (h.startsWith('#http') || h.startsWith('#!')) return false
  return true
}

/** Use on `<a href="#section">` so nav works in Setup/Designer overflow previews. */
export function onStorefrontNavClick(
  e: MouseEvent<HTMLAnchorElement>,
  href: string,
  after?: () => void,
): void {
  if (!isStorefrontHashLink(href)) return
  e.preventDefault()
  scrollToStorefrontSection(href)
  after?.()
}

type ShopNavApi = {
  view: string
  openHome: () => void
  openCatalog?: (opts?: { categoryId?: number | null }) => void
  openCategories?: () => void
  openCart: () => void
  openCheckout: () => void
  openAccount: () => void
  openLogin: () => void
  customer: unknown
}

/** Shop navbar / footer: hash scroll (incl. preview overflow) + cart/account actions. */
export function handleShopNavClick(
  e: MouseEvent<HTMLAnchorElement>,
  item: { href?: string; action?: string },
  shop: ShopNavApi | null | undefined,
  after?: () => void,
): void {
  const action = (item.action || '').toLowerCase()
  if (action === 'cart') {
    e.preventDefault()
    shop?.openCart()
    after?.()
    return
  }
  if (action === 'checkout') {
    e.preventDefault()
    shop?.openCheckout()
    after?.()
    return
  }
  if (action === 'account') {
    e.preventDefault()
    if (shop?.customer) shop.openAccount()
    else shop?.openLogin()
    after?.()
    return
  }
  if (action === 'login') {
    e.preventDefault()
    shop?.openLogin()
    after?.()
    return
  }
  if (action === 'catalog' || action === 'products' || action === 'shop_all') {
    e.preventDefault()
    shop?.openCatalog?.()
    after?.()
    return
  }
  if (action === 'categories') {
    e.preventDefault()
    shop?.openCategories?.()
    after?.()
    return
  }

  const href = (item.href || '#').trim()
  const hrefKey = href.replace(/^#/, '').toLowerCase()
  if (hrefKey === 'catalog' || hrefKey === 'products' || hrefKey === 'shop_all') {
    e.preventDefault()
    shop?.openCatalog?.()
    after?.()
    return
  }
  if (hrefKey === 'all-categories' || hrefKey === 'categories-page') {
    e.preventDefault()
    shop?.openCategories?.()
    after?.()
    return
  }
  if (!isStorefrontHashLink(href)) return
  e.preventDefault()
  const run = () => {
    scrollToStorefrontSection(href)
    after?.()
  }
  if (shop && shop.view !== 'home') {
    shop.openHome()
    window.setTimeout(run, 80)
    return
  }
  run()
}

/** Preview panes don't contain `position:fixed` (zoom/overflow). Use absolute there. */
export function storefrontFixed(preview?: boolean | null): 'fixed' | 'absolute' {
  return preview ? 'absolute' : 'fixed'
}

/** True after scroll past threshold — works inside preview overflow panes too. */
export function useStorefrontScrolled(threshold = 16): [boolean, RefObject<HTMLElement | null>] {
  const ref = useRef<HTMLElement | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    let node: HTMLElement | null = root.parentElement
    let scroller: HTMLElement | Window = window
    while (node) {
      const oy = getComputedStyle(node).overflowY
      if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
        scroller = node
        break
      }
      node = node.parentElement
    }
    const onScroll = () => {
      const y = scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop
      setScrolled(y > threshold)
    }
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [threshold])

  return [scrolled, ref]
}
