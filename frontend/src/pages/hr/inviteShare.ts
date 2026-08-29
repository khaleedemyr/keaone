export function invitePublicUrl(token: string) {
  if (typeof window === 'undefined') return `/invite/${token}`
  return `${window.location.origin}/invite/${token}`
}

export function inviteWhatsAppUrl(message: string) {
  const text = encodeURIComponent(message)
  return `https://wa.me/?text=${text}`
}
