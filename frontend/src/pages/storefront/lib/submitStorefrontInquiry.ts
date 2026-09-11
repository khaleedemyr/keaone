import { api, apiMessage } from '../../../api/client'
import { resolveStorefrontHost } from './storefrontHost'
import type { ApiOk } from '../../../types'

export type StorefrontInquiryKind = 'contact' | 'quote'

export type StorefrontInquiryPayload = {
  kind?: StorefrontInquiryKind
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
  /** Honeypot — leave empty (do not name the field "website"; browsers autofill it) */
  website?: string
  /**
   * Admin Setup / Designer / /storefront/preview — posts to authenticated
   * `/storefront/inquiries` so messages appear in Kotak masuk (same pattern as preview checkout).
   */
  preview?: boolean
  host?: string | null
}

export type StorefrontInquiryResult = {
  id: number
  kind: StorefrontInquiryKind
  status: string
}

/** Submit contact/quote form to public API, or admin API when previewing. */
export async function submitStorefrontInquiry(
  payload: StorefrontInquiryPayload,
): Promise<StorefrontInquiryResult> {
  const name = payload.name.trim()
  const email = payload.email.trim()
  const message = payload.message.trim()
  if (!name || !email || !message) {
    throw new Error('Name, email, and message are required.')
  }

  const body = {
    kind: payload.kind === 'quote' ? 'quote' : 'contact',
    name,
    email,
    phone: payload.phone?.trim() || null,
    subject: payload.subject?.trim() || null,
    message,
    website: payload.website ?? '',
  }

  // Preview (logged-in ERP): persist via admin API so inbox receives the message.
  if (payload.preview) {
    const { data } = await api.post<ApiOk<StorefrontInquiryResult>>('/storefront/inquiries', body, {
      silent: true,
    })
    return data.data
  }

  const { data } = await api.post<ApiOk<StorefrontInquiryResult>>('/public/storefront/inquiries', body, {
    headers: { 'X-Storefront-Host': resolveStorefrontHost(payload.host) },
    skipAuth: true,
    silent: true,
  })

  return data.data
}

export function inquiryFromForm(form: HTMLFormElement): {
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
  website?: string
} {
  const fd = new FormData(form)
  const get = (key: string) => String(fd.get(key) ?? '').trim()
  return {
    name: get('name'),
    email: get('email'),
    phone: get('phone') || undefined,
    subject: get('subject') || undefined,
    message: get('message'),
    // Prefer obscure honeypot name; keep legacy "website" for older markup.
    website: get('sf_hp') || get('website') || undefined,
  }
}

export function inquiryErrorMessage(err: unknown, fallback = 'Could not send message. Please try again.') {
  return apiMessage(err, fallback)
}
