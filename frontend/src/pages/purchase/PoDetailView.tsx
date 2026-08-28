import type { ReactNode } from 'react'
import { formatRupiah } from '../../lib/money'
import { PoTotalsSummary } from './PoTotalsSummary'
import { formatPaymentTermLabel, sumPoItemDiscounts } from './poTotals'
import { DocHeader, DocItemsTable, DocTh, MetaField } from './purchaseDocShared'

export type PoDetailViewData = {
  number: string
  status: string
  expected_at?: string | null
  note?: string | null
  subtotal?: number
  tax_percent?: number
  tax?: number
  total?: number
  payment_term?: string | null
  payment_days?: number | null
  created_at?: string | null
  user?: { name: string } | null
  supplier?: {
    name: string
    phone?: string | null
    is_taxable?: boolean
    tax_percent?: number | null
    payment_term?: string | null
    payment_days?: number | null
  } | null
  warehouse?: { name: string } | null
  items?: Array<{
    id?: number
    name_snapshot?: string | null
    product?: { name?: string; sku?: string | null } | null
    name?: string | null
    sku?: string | null
    qty: number
    unit?: string | null
    unit_cost?: number
    discount?: number
    total?: number
  }>
}

export function PoDetailView({
  po,
  locale,
  t,
  statusLabel,
  qrDataUrl,
  actions,
  shareHint,
  subtitle,
}: {
  po: PoDetailViewData
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  statusLabel: string
  qrDataUrl?: string
  actions?: ReactNode
  shareHint?: ReactNode
  subtitle?: string
}) {
  const topLabel = formatPaymentTermLabel(po.payment_term, po.payment_days, t)

  return (
    <div className="font-sans text-sm leading-relaxed text-fg">
      <DocHeader
        docLabel={t('purchasePoTitle')}
        number={po.number}
        status={po.status}
        statusLabel={statusLabel}
        createdAt={po.created_at}
        createdAtLabel={t('createdAt')}
        locale={locale}
        qrDataUrl={qrDataUrl}
        qrHint={t('purchaseQrHint')}
        subtitle={subtitle}
      />

      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetaField label={t('purchaseCreatedBy')} value={po.user?.name ?? '—'} />
        <MetaField label={t('navSuppliers')} value={po.supplier?.name ?? '—'} />
        <MetaField label={t('navWarehouses')} value={po.warehouse?.name ?? '—'} />
        <MetaField label={t('paymentTerm')} value={topLabel} />
        <MetaField label={t('purchaseExpectedAt')} value={po.expected_at ?? '—'} />
        <MetaField label={t('purchaseNote')} value={po.note?.trim() ? po.note : '—'} />
      </dl>

      {actions ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-line py-3">{actions}</div>
      ) : null}
      {shareHint ? <div className="mt-3">{shareHint}</div> : null}

      <DocItemsTable
        columns={
          <>
            <DocTh>{t('product')}</DocTh>
            <DocTh align="right">{t('posColQty')}</DocTh>
            <DocTh>{t('unit')}</DocTh>
            <DocTh align="right">{t('purchaseUnitCost')}</DocTh>
            <DocTh align="right">{t('purchaseDiscount')}</DocTh>
            <DocTh align="right">{t('purchaseTotal')}</DocTh>
          </>
        }
      >
        {(po.items ?? []).map((item, index) => {
          const name = item.name_snapshot || item.product?.name || item.name || '—'
          const sku = item.product?.sku ?? item.sku
          return (
            <tr key={item.id ?? `${name}-${index}`} className="border-b border-line/70 last:border-0">
              <td className="px-3 py-2.5 align-top">
                <div className="font-medium text-fg">{name}</div>
                {sku ? <div className="text-xs text-muted">{sku}</div> : null}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.qty}</td>
              <td className="px-3 py-2.5 text-muted">{item.unit ?? '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(item.unit_cost ?? 0, locale)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                {(item.discount ?? 0) > 0 ? `-${formatRupiah(item.discount ?? 0, locale)}` : '—'}
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatRupiah(item.total ?? 0, locale)}</td>
            </tr>
          )
        })}
      </DocItemsTable>

      <PoTotalsSummary
        variant="invoice"
        subtotal={po.subtotal ?? 0}
        discountTotal={sumPoItemDiscounts(po.items)}
        supplier={{
          is_taxable: po.supplier?.is_taxable,
          tax_percent: po.tax_percent ?? po.supplier?.tax_percent,
          payment_term: po.payment_term ?? po.supplier?.payment_term,
          payment_days: po.payment_days ?? po.supplier?.payment_days,
        }}
        locale={locale}
        t={t}
      />
    </div>
  )
}
