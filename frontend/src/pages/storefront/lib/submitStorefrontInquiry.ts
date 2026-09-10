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
  /** Honeypot — leave empty */
  website?: string
  preview?: boolean
  host?: string | null
}

export type StorefrontInquiryResult = {
  id: number
  kind: StorefrontInquiryKind
  status: string
}

/** Submit contact/quote form to public storefront API (or fake success in preview). */
export async function submitStorefrontInquiry(
  payload: StorefrontInquiryPayload,
): Promise<StorefrontInquiryResult> {
  const name = payload.name.trim()
  const email = payload.email.trim()
  const message = payload.message.trim()
  if (!name || !email || !message) {
    throw new Error('Name, email, and message are required.')
  }

  if (payload.preview) {
    return { id: 0, kind: payload.kind === 'quote' ? 'quote' : 'contact', status: 'new' }
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
    website: get('website') || undefined,
  }
}

export function inquiryErrorMessage(err: unknown, fallback = 'Could not send message. Please try again.') {
  return apiMessage(err, fallback)
}
