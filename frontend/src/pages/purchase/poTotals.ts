import type { Party } from '../../types'

export type SupplierTaxProfile = Pick<
  Party,
  'is_taxable' | 'tax_percent' | 'payment_term' | 'payment_days'
>

export function sumPoItemDiscounts(items?: Array<{ discount?: number | null }>) {
  return (items ?? []).reduce((sum, item) => sum + (item.discount ?? 0), 0)
}

export function calcPoTotals(
  subtotal: number,
  supplier?: SupplierTaxProfile | null,
  options?: { discountTotal?: number },
) {
  const discountTotal = Math.max(0, options?.discountTotal ?? 0)
  const grossSubtotal = subtotal + discountTotal
  const taxPercent =
    supplier?.is_taxable && supplier.tax_percent && supplier.tax_percent > 0
      ? Number(supplier.tax_percent)
      : 0
  const tax = Math.round(subtotal * taxPercent / 100)
  return {
    grossSubtotal,
    discountTotal,
    subtotal,
    taxPercent,
    tax,
    total: subtotal + tax,
    paymentTerm: supplier?.payment_term ?? null,
    paymentDays: supplier?.payment_days ?? null,
  }
}

const TERM_LABELS: Record<string, string> = {
  cash: 'Cash',
  cod: 'COD',
  net7: 'Net 7',
  net14: 'Net 14',
  net30: 'Net 30',
  net45: 'Net 45',
  net60: 'Net 60',
  net90: 'Net 90',
}

export function formatPaymentTermLabel(
  paymentTerm: string | null | undefined,
  paymentDays: number | null | undefined,
  t: (key: string, params?: Record<string, string>) => string,
) {
  const term = (paymentTerm ?? '').trim().toLowerCase()
  if (term && TERM_LABELS[term]) {
    return paymentDays != null && paymentDays > 0
      ? `${TERM_LABELS[term]} (${paymentDays} ${t('days')})`
      : TERM_LABELS[term]
  }
  if (paymentDays != null && paymentDays > 0) {
    return t('paymentTermNet', { n: String(paymentDays) })
  }
  if (term) return paymentTerm!
  return '—'
}
