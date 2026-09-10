import type { StorefrontBankAccount, StorefrontShipping, StorefrontSiteKind, StorefrontThemeContent } from '../types'
import type { StorefrontBlock } from '../lib/storefrontBlocks'

export type StorefrontRenderProduct = {
  id: number
  name: string
  description?: string | null
  price: number
  available_qty?: number | null
  image_url?: string | null
  category_id?: number | null
  product_id?: number
  is_deal?: boolean
  is_new_arrival?: boolean
  is_bestseller?: boolean
  sold_count?: number
  avg_rating?: number
  review_count?: number
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
  preview?: boolean
  /** Public host for live storefront (X-Storefront-Host). */
  host?: string
}
