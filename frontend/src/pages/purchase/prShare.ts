import { api } from '../../api/client'
import type { ApiOk } from '../../types'

export function prPublicUrl(shareToken: string) {
  if (typeof window === 'undefined') return `/pr/${shareToken}`
  return `${window.location.origin}/pr/${shareToken}`
}

export function prWhatsAppUrl(message: string) {
  const text = encodeURIComponent(message)
  return `https://wa.me/?text=${text}`
}

export async function ensurePrShareToken(prId: number, existing?: string | null) {
  if (existing) return existing
  const { data } = await api.post<ApiOk<{ share_token: string }>>(`/purchase-requisitions/${prId}/share`)
  return data.data.share_token
}
