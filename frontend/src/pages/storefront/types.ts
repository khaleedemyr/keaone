export type StorefrontSiteKind = 'landing' | 'shop'
export type StorefrontStockMode = 'realtime' | 'allocated'

export type StorefrontBankAccount = {
  bank_name: string
  account_name: string
  account_number: string
}

export type StorefrontShipping = {
  enabled: boolean
  configured?: boolean
  origin_id?: number | null
  origin_label?: string | null
  couriers?: string[]
  default_weight_gram?: number
  has_api_key?: boolean
}

export type StorefrontShippingOption = {
  name: string
  code: string
  service: string
  description: string
  cost: number
  etd?: string | null
}

export type StorefrontShippingDestination = {
  id: number
  label: string
}

export type StorefrontTemplate = {
  key: string
  name: string
  kind: string
  description: string
  slots?: StorefrontTemplateSlot[]
}

export type StorefrontTemplateSlotOption = {
  value: string
  label: string
}

export type StorefrontTemplateSlot = {
  key: string
  type: 'image' | 'text' | 'textarea' | 'gallery' | 'carousel' | 'categories' | 'select'
  label: string
  section?: string
  default?: string
  max?: number
  options?: StorefrontTemplateSlotOption[]
}

export type StorefrontCategoryThemeItem = {
  category_id: number
  label?: string
  image?: string | null
}

export type StorefrontCarouselSlide = {
  image: string
  title?: string
  subtitle?: string
}

export type StorefrontThemeContent = {
  hero_image?: string
  hero_image_secondary?: string
  hero_cta?: string
  banner_image?: string
  collection_image?: string
  collection_title?: string
  collection_body?: string
  gallery?: string[]
  carousel?: StorefrontCarouselSlide[]
  categories?: StorefrontCategoryThemeItem[]
  [key: string]: string | string[] | StorefrontCarouselSlide[] | StorefrontCategoryThemeItem[] | undefined
}

export type StorefrontDomainRow = {
  id: number
  host: string
  status: string
  acquisition: string
  ssl_status: string
  is_primary: boolean
  verified_at?: string | null
  dns_instructions?: {
    cname?: string
    a_records?: string[]
    note?: string
    verification_token?: string
    txt_host?: string
    txt_value?: string
  } | null
}

export type StorefrontAdmin = {
  id: number
  site_kind: StorefrontSiteKind
  template_key: string
  status: string
  title?: string | null
  tagline?: string | null
  about?: string | null
  logo_url?: string | null
  outlet_id?: number | null
  warehouse_id?: number | null
  price_channel_id?: number | null
  outlet?: { id: number; name: string } | null
  warehouse?: { id: number; name: string } | null
  price_channel?: { id: number; name: string; code?: string } | null
  contact_email?: string | null
  contact_phone?: string | null
  contact_address?: string | null
  seo_title?: string | null
  seo_description?: string | null
  brand_colors?: {
    primary?: string
    accent?: string
    background?: string
    text?: string
  } | null
  theme_content?: StorefrontThemeContent | null
  home_blocks?: import('./lib/storefrontBlocks').StorefrontBlock[]
  block_types?: import('./lib/storefrontBlocks').StorefrontBlockTypeMeta[]
  template_slots?: StorefrontTemplateSlot[]
  stock_mode: StorefrontStockMode
  bank_accounts?: StorefrontBankAccount[] | null
  shipping?: StorefrontShipping | null
  publish_readiness?: {
    ready: boolean
    site_kind: string
    items: Array<{ key: string; ok: boolean }>
  }
  has_news?: boolean
  domains: StorefrontDomainRow[]
  templates: {
    landing: StorefrontTemplate[]
    shop: StorefrontTemplate[]
  }
  dns_instructions?: {
    cname?: string
    a_records?: string[]
    note?: string
    verification_token?: string
    txt_host?: string
    txt_value?: string
  }
}

export type StorefrontNewsPostRow = {
  id: number
  slug: string
  title: string
  excerpt?: string | null
  body?: string | null
  image_path?: string | null
  image_url?: string | null
  tags?: string | null
  sort_order: number
  is_published: boolean
  published_at?: string | null
  day?: string | null
  month?: string | null
}

export type StorefrontInquiryRow = {
  id: number
  kind: 'contact' | 'quote' | string
  name: string
  email: string
  phone?: string | null
  subject?: string | null
  message: string
  meta?: Record<string, unknown> | null
  status: 'new' | 'read' | 'archived' | string
  read_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type StorefrontHomePage = {
  id: number
  slug: string
  title: string
  kind: string
  is_published: boolean
  blocks: import('./lib/storefrontBlocks').StorefrontBlock[]
  block_types: import('./lib/storefrontBlocks').StorefrontBlockTypeMeta[]
  template_key: string
  site_kind: StorefrontSiteKind
  brand_colors?: StorefrontAdmin['brand_colors']
  title_site?: string | null
  tagline?: string | null
  about?: string | null
  logo_url?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  contact_address?: string | null
  bank_accounts?: StorefrontBankAccount[] | null
  shipping?: StorefrontShipping | null
  theme_content?: StorefrontThemeContent | null
  template_slots?: StorefrontTemplateSlot[]
  stock_mode?: StorefrontStockMode
}

export type StorefrontProductRow = {
  id: number
  product_id: number
  is_visible: boolean
  sort_order: number
  allocated_qty?: number | null
  sold_qty: number
  override_price?: number | null
  is_deal?: boolean
  is_new_arrival?: boolean
  is_bestseller?: boolean
  units_sold?: number
  avg_rating?: number
  review_count?: number
  product?: {
    id: number
    name: string
    sku?: string | null
    sell_price?: number
    description?: string | null
    is_active?: boolean
    track_stock?: boolean
    category_id?: number | null
    image_url?: string | null
    images?: Array<{ id?: number; url?: string | null; is_primary?: boolean }>
    variant_attributes?: import('./templates/renderTypes').StorefrontVariantAttribute[]
    weight_gram?: number | null
  } | null
}

export type StorefrontOrderRow = {
  id: number
  number: string
  status: string
  sale_id?: number | null
  sale?: { id: number; number: string } | null
  customer_name: string
  customer_phone?: string | null
  customer_address?: string | null
  note?: string | null
  subtotal?: number
  shipping_cost?: number
  total: number
  shipping_snapshot?: {
    destination_label?: string | null
    courier?: string
    courier_name?: string
    service?: string
    cost?: number
    etd?: string | null
  } | null
  placed_at?: string | null
  paid_at?: string | null
  items?: Array<{
    id: number
    qty: number
    unit_price: number
    line_total: number
    name_snapshot: string
  }>
}
