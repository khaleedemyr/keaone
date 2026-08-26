export function formatRupiah(value: number, locale = 'id-ID'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(value: string | null, locale = 'id-ID'): string {
  if (!value) return '-'
  const raw = value.includes('T') ? value : `${value}T00:00:00`
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(raw))
}

export function formatDateTime(value: string | null, locale = 'id-ID'): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
