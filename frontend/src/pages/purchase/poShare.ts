import { api } from '../../api/client'
import type { ApiOk } from '../../types'

export function poPublicUrl(shareToken: string) {
  if (typeof window === 'undefined') return `/po/${shareToken}`
  return `${window.location.origin}/po/${shareToken}`
}

export function poWhatsAppUrl(phone: string | null | undefined, message: string) {
  const digits = (phone ?? '').replace(/\D/g, '')
  const target = digits ? digits : ''
  const text = encodeURIComponent(message)
  return target ? `https://wa.me/${target}?text=${text}` : `https://wa.me/?text=${text}`
}

export async function ensurePoShareToken(poId: number, existing?: string | null) {
  if (existing) return existing
  const { data } = await api.post<ApiOk<{ share_token: string }>>(`/purchase-orders/${poId}/share`)
  return data.data.share_token
}
