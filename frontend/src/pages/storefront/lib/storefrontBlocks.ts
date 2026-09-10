export type StorefrontBlockType =
  | 'hero'
  | 'carousel'
  | 'gallery'
  | 'rich_text'
  | 'product_grid'
  | 'category_split'
  | 'banner'
  | 'contact'
  | 'spacer'

export type StorefrontCarouselSlide = {
  image: string
  title?: string
  subtitle?: string
}

export type StorefrontCategoryItem = {
  category_id: number
  label?: string
  image?: string | null
}

export type StorefrontBlockProps = {
  image?: string | null
  headline?: string
  subheadline?: string
  cta?: string
  kicker_left?: string
  kicker_right?: string
  style?: string
  slides?: StorefrontCarouselSlide[]
  images?: string[]
  title?: string
  body?: string
  limit?: number
  /** @deprecated use items */
  left_image?: string | null
  left_label?: string
  right_image?: string | null
  right_label?: string
  items?: StorefrontCategoryItem[]
  size?: 'sm' | 'md' | 'lg'
}

export type StorefrontBlock = {
  id: string
  type: StorefrontBlockType
  visible: boolean
  props: StorefrontBlockProps
}

export type StorefrontBlockTypeMeta = {
  type: StorefrontBlockType
  label: string
  description?: string
}

const BLOCK_TYPES: StorefrontBlockType[] = [
  'hero',
  'carousel',
  'gallery',
  'rich_text',
  'product_grid',
  'category_split',
  'banner',
  'contact',
  'spacer',
]

export function isStorefrontBlockType(value: string): value is StorefrontBlockType {
  return (BLOCK_TYPES as string[]).includes(value)
}

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function defaultPropsFor(type: StorefrontBlockType): StorefrontBlockProps {
  switch (type) {
    case 'hero':
      return { image: null, headline: '', subheadline: '', cta: '', kicker_left: '', kicker_right: '', style: 'standard' }
    case 'carousel':
      return { slides: [] }
    case 'gallery':
      return { images: [], title: '', body: '', cta: '' }
    case 'rich_text':
      return { title: '', body: '' }
    case 'product_grid':
      return { title: '', body: '', limit: 8 }
    case 'category_split':
      return { title: '', items: [] }
    case 'banner':
      return { image: null, title: '', body: '', kicker_left: '', kicker_right: '', style: 'collection' }
    case 'contact':
      return {}
    case 'spacer':
      return { size: 'md' }
  }
}

export function newStorefrontBlock(type: StorefrontBlockType, props: Partial<StorefrontBlockProps> = {}): StorefrontBlock {
  return {
    id: uid(),
    type,
    visible: true,
    props: { ...defaultPropsFor(type), ...props },
  }
}

export function normalizeStorefrontBlocks(raw: unknown): StorefrontBlock[] {
  if (!Array.isArray(raw)) return []
  const out: StorefrontBlock[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const type = typeof item.type === 'string' ? item.type : ''
    if (!isStorefrontBlockType(type)) continue
    const propsRaw =
      item.props && typeof item.props === 'object'
        ? (item.props as StorefrontBlockProps)
        : (Object.fromEntries(
            Object.entries(item).filter(([k]) => !['id', 'type', 'visible', 'props'].includes(k)),
          ) as StorefrontBlockProps)
    out.push({
      id: typeof item.id === 'string' && item.id ? item.id : uid(),
      type,
      visible: item.visible === undefined ? true : Boolean(item.visible),
      props: { ...defaultPropsFor(type), ...propsRaw },
    })
    if (out.length >= 40) break
  }
  return out
}

export function blockTypeLabel(type: StorefrontBlockType): string {
  switch (type) {
    case 'hero':
      return 'Hero'
    case 'carousel':
      return 'Carousel'
    case 'gallery':
      return 'Galeri'
    case 'rich_text':
      return 'Teks'
    case 'product_grid':
      return 'Produk'
    case 'category_split':
      return 'Kategori produk'
    case 'banner':
      return 'Banner'
    case 'contact':
      return 'Kontak'
    case 'spacer':
      return 'Spacer'
  }
}
