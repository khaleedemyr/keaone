import { formatRupiah } from '../../lib/money'
import { calcPoTotals, formatPaymentTermLabel, type SupplierTaxProfile } from './poTotals'

function TotalRow({
  label,
  value,
  strong,
  accent,
}: {
  label: string
  value: string
  strong?: boolean
  accent?: 'discount'
}) {
  return (
    <div className={`flex items-baseline justify-between gap-6 ${strong ? 'border-t border-line pt-2' : ''}`}>
      <span className={strong ? 'text-sm font-semibold text-fg' : 'text-sm text-muted'}>{label}</span>
      <span
        className={`tabular-nums ${strong ? 'text-base font-bold text-fg' : accent === 'discount' ? 'text-sm font-medium text-rose-500' : 'text-sm font-medium text-fg'}`}
      >
        {value}
      </span>
    </div>
  )
}

export function PoTotalsSummary({
  subtotal,
  discountTotal = 0,
  supplier,
  locale,
  t,
  variant = 'default',
}: {
  subtotal: number
  discountTotal?: number
  supplier?: SupplierTaxProfile | null
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  variant?: 'default' | 'invoice'
}) {
  const totals = calcPoTotals(subtotal, supplier, { discountTotal })
  const top = formatPaymentTermLabel(totals.paymentTerm, totals.paymentDays, t)

  if (variant === 'invoice') {
    return (
      <div className="mt-5 flex justify-end">
        <div className="w-full max-w-sm space-y-1.5 rounded-lg border border-line bg-fill/20 p-4 font-sans">
          {supplier ? (
            <div className="mb-3 space-y-1 border-b border-line pb-3 text-xs text-muted">
              <div className="flex justify-between gap-4">
                <span>{t('paymentTerm')}</span>
                <span className="font-medium text-fg">{top}</span>
              </div>
              {totals.taxPercent > 0 ? (
                <div className="flex justify-between gap-4">
                  <span>{t('purchaseTax')}</span>
                  <span className="font-medium text-fg">
                    {totals.taxPercent}% ({formatRupiah(totals.tax, locale)})
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
          {totals.discountTotal > 0 ? (
            <>
              <TotalRow label={t('purchaseGrossSubtotal')} value={formatRupiah(totals.grossSubtotal, locale)} />
              <TotalRow
                label={t('purchaseTotalDiscount')}
                value={`-${formatRupiah(totals.discountTotal, locale)}`}
                accent="discount"
              />
            </>
          ) : null}
          <TotalRow label={t('purchaseSubtotal')} value={formatRupiah(totals.subtotal, locale)} />
          {totals.tax > 0 ? (
            <TotalRow
              label={`${t('purchaseTax')}${totals.taxPercent > 0 ? ` (${totals.taxPercent}%)` : ''}`}
              value={formatRupiah(totals.tax, locale)}
            />
          ) : null}
          <TotalRow label={t('purchaseGrandTotal')} value={formatRupiah(totals.total, locale)} strong />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-fill/20 p-3 font-sans space-y-2">
      {supplier ? (
        <div className="grid gap-1 text-xs text-muted sm:grid-cols-2">
          <div>
            {t('paymentTerm')}: <span className="font-medium text-fg">{top}</span>
          </div>
          {totals.taxPercent > 0 ? (
            <div>
              {t('purchaseTax')}:{' '}
              <span className="font-medium text-fg">
                {totals.taxPercent}% ({formatRupiah(totals.tax, locale)})
              </span>
            </div>
          ) : (
            <div>
              {t('purchaseTax')}: <span className="text-fg">—</span>
            </div>
          )}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line pt-2 text-sm">
        {totals.discountTotal > 0 ? (
          <>
            <div>
              <span className="text-muted">{t('purchaseGrossSubtotal')}: </span>
              <span className="font-medium tabular-nums text-fg">{formatRupiah(totals.grossSubtotal, locale)}</span>
            </div>
            <div>
              <span className="text-muted">{t('purchaseTotalDiscount')}: </span>
              <span className="font-medium tabular-nums text-rose-500">-{formatRupiah(totals.discountTotal, locale)}</span>
            </div>
          </>
        ) : null}
        <div>
          <span className="text-muted">{t('purchaseSubtotal')}: </span>
          <span className="font-medium tabular-nums text-fg">{formatRupiah(totals.subtotal, locale)}</span>
        </div>
        {totals.tax > 0 ? (
          <div>
            <span className="text-muted">{t('purchaseTax')}: </span>
            <span className="font-medium tabular-nums text-fg">{formatRupiah(totals.tax, locale)}</span>
          </div>
        ) : null}
        <div>
          <span className="text-muted">{t('purchaseGrandTotal')}: </span>
          <span className="font-bold tabular-nums text-fg">{formatRupiah(totals.total, locale)}</span>
        </div>
      </div>
    </div>
  )
}
