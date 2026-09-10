/**
 * Detect whether the current browser host should render a published storefront
 * instead of the Keaone marketing / ERP shell.
 */
export function isTenantStorefrontHost(hostname = window.location.hostname): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false

  const raw = String(import.meta.env.VITE_APP_HOSTS || 'keaone.id,www.keaone.id,app.keaone.id,sites.keaone.id')
  const appHosts = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  return !appHosts.some((ah) => h === ah || h.endsWith(`.${ah}`))
}

export function resolveStorefrontHost(fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim().toLowerCase()
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search)
  const q = params.get('host')
  if (q && q.trim()) return q.trim().toLowerCase()
  return window.location.hostname.toLowerCase()
}
