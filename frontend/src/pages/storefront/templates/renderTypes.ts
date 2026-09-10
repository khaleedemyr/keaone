import type { StorefrontBankAccount, StorefrontShipping, StorefrontSiteKind, StorefrontThemeContent } from '../types'
import type { StorefrontBlock } from '../lib/storefrontBlocks'

export type StorefrontVariantOption = {
  id: number
  name: string
  sort_order?: number
  extra_price: number
  image_url?: string | null
  is_active?: boolean
}

export type StorefrontVariantAttribute = {
  id: number
  name: string
  sort_order?: number
  show_in_storefront?: boolean
  options: StorefrontVariantOption[]
}

export type StorefrontRenderProduct = {
  id: number
  name: string
  description?: string | null
  price: number
  available_qty?: number | null
  image_url?: string | null
  images?: Array<{ id?: number; url: string; is_primary?: boolean }>
  category_id?: number | null
  product_id?: number
  weight_gram?: number | null
  variant_attributes?: StorefrontVariantAttribute[]
  is_deal?: boolean
  is_new_arrival?: boolean
  is_bestseller?: boolean
  sold_count?: number
  avg_rating?: number
  review_count?: number
}

export type StorefrontRenderNews = {
  id: number | string
  slug?: string
  title: string
  excerpt?: string | null
  body?: string | null
  image_url?: string | null
  tags?: string | null
  day?: string | null
  month?: string | null
  published_at?: string | null
}

export type StorefrontRenderModel = {
  site_kind: StorefrontSiteKind
  template_key: string
  title: string
  tagline: string
  about: string
  logo_url?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  contact_address?: string | null
  bank_accounts?: StorefrontBankAccount[]
  shipping?: StorefrontShipping | null
  brand_colors?: {
    primary?: string
    accent?: string
    background?: string
    text?: string
  }
  theme_content?: StorefrontThemeContent
  home_blocks?: StorefrontBlock[]
  products?: StorefrontRenderProduct[]
  news?: StorefrontRenderNews[]
  preview?: boolean
  /** Public host for live storefront (X-Storefront-Host). */
  host?: string
}
