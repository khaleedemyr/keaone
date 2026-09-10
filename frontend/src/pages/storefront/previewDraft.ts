import type { StorefrontBankAccount, StorefrontShipping, StorefrontSiteKind, StorefrontStockMode, StorefrontThemeContent } from './types'
import type { StorefrontBlock } from './lib/storefrontBlocks'

export const STOREFRONT_PREVIEW_KEY = 'kea_storefront_preview_draft'

export const STOREFRONT_PREVIEW_BANNER =
  'Mode preview — uji tampilan & checkout. Ini bukan situs publik final.'

export type StorefrontPreviewDraft = {
  site_kind: StorefrontSiteKind
  template_key: string
  title: string
  tagline: string
  about: string
  status: string
  stock_mode: StorefrontStockMode
  bank_accounts: StorefrontBankAccount[]
  shipping?: StorefrontShipping | null
  logo_url?: string | null
  theme_content?: StorefrontThemeContent
  home_blocks?: StorefrontBlock[]
  contact_email?: string | null
  contact_phone?: string | null
  contact_address?: string | null
  brand_colors?: {
    primary?: string
    accent?: string
    background?: string
    text?: string
  }
}

export function writeStorefrontPreviewDraft(draft: StorefrontPreviewDraft) {
  localStorage.setItem(STOREFRONT_PREVIEW_KEY, JSON.stringify({ ...draft, saved_at: Date.now() }))
}

export function readStorefrontPreviewDraft(): StorefrontPreviewDraft | null {
  try {
    const raw = localStorage.getItem(STOREFRONT_PREVIEW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StorefrontPreviewDraft & { saved_at?: number }
    if (parsed.saved_at && Date.now() - parsed.saved_at > 30 * 60 * 1000) {
      localStorage.removeItem(STOREFRONT_PREVIEW_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function openStorefrontPreview(draft: StorefrontPreviewDraft) {
  writeStorefrontPreviewDraft(draft)
  window.open('/storefront/preview', '_blank', 'noopener,noreferrer')
}
