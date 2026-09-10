import { formatRupiah } from '../../lib/money'
import { DocHeader, DocItemsTable, DocTh, MetaField } from './purchaseDocShared'

export type InvoiceDetailViewData = {
  number: string
  status: string
  vendor_ref?: string | null
  invoice_date?: string | null
  due_date?: string | null
  note?: string | null
  subtotal?: number
  tax?: number
  tax_percent?: number
  total?: number
  withholding_tax?: number
  amount_payable?: number
  amount_paid?: number
  amount_due?: number
  payment_status?: string | null
  match_status?: string | null
  confirmed_at?: string | null
  created_at?: string | null
  user?: { name: string } | null
  supplier?: { name: string } | null
  purchase_order?: { number: string } | null
  goods_receipt?: { number: string } | null
  items?: Array<{
    id?: number
    name_snapshot?: string | null
    product?: { name?: string; sku?: string | null } | null
    qty: number
    unit?: string | null
    unit_cost?: number
    discount?: number
    total?: number
  }>
}

export function InvoiceDetailView({
  doc,
  locale,
  t,
  statusLabel,
  matchStatusLabel,
  paymentStatusLabel,
}: {
  doc: InvoiceDetailViewData
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  statusLabel: string
  matchStatusLabel?: string
  paymentStatusLabel?: string
}) {
  return (
    <div className="font-sans text-sm leading-relaxed text-fg">
      <DocHeader
        docLabel={t('procurementInvoiceTitle')}
        number={doc.number}
        status={doc.status}
        statusLabel={statusLabel}
        createdAt={doc.created_at}
        createdAtLabel={t('purchaseCreatedAt')}
        locale={locale}
      />

      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetaField label={t('purchaseCreatedBy')} value={doc.user?.name ?? '—'} />
        <MetaField label={t('navSuppliers')} value={doc.supplier?.name ?? '—'} />
        <MetaField label={t('procurementInvoiceVendorRef')} value={doc.vendor_ref?.trim() ? doc.vendor_ref : '—'} />
        <MetaField label={t('purchasePoTitle')} value={doc.purchase_order?.number ?? '—'} />
        <MetaField label={t('purchaseGrTitle')} value={doc.goods_receipt?.number ?? '—'} />
        <MetaField label={t('procurementInvoiceDate')} value={doc.invoice_date ?? '—'} />
        <MetaField label={t('procurementInvoiceDueDate')} value={doc.due_date ?? '—'} />
        {matchStatusLabel ? <MetaField label={t('procurementMatchStatus')} value={matchStatusLabel} /> : null}
        {paymentStatusLabel ? <MetaField label={t('procurementInvoicePaymentStatus')} value={paymentStatusLabel} /> : null}
        <MetaField label={t('purchaseNote')} value={doc.note?.trim() ? doc.note : '—'} />
      </dl>

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
        {(doc.items ?? []).map((item, index) => {
          const name = item.name_snapshot || item.product?.name || '—'
          const sku = item.product?.sku
          return (
            <tr key={item.id ?? `${name}-${index}`} className="border-b border-line/70 last:border-0">
              <td className="px-3 py-2.5 align-top">
                <div className="font-medium text-fg">{name}</div>
                {sku ? <div className="text-xs text-muted">{sku}</div> : null}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.qty}</td>
              <td className="px-3 py-2.5 text-muted">{item.unit ?? '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(item.unit_cost ?? 0, locale)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(item.discount ?? 0, locale)}</td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatRupiah(item.total ?? 0, locale)}</td>
            </tr>
          )
        })}
      </DocItemsTable>

      <dl className="mt-4 flex flex-col items-end gap-1 text-sm">
        <div className="flex min-w-[240px] justify-between gap-6">
          <dt className="text-muted">{t('purchaseSubtotal')}</dt>
          <dd className="tabular-nums">{formatRupiah(doc.subtotal ?? 0, locale)}</dd>
        </div>
        {(doc.tax ?? 0) > 0 ? (
          <div className="flex min-w-[240px] justify-between gap-6">
            <dt className="text-muted">
              {t('purchaseTax')}
              {doc.tax_percent ? ` (${doc.tax_percent}%)` : ''}
            </dt>
            <dd className="tabular-nums">{formatRupiah(doc.tax ?? 0, locale)}</dd>
          </div>
        ) : null}
        {(doc.withholding_tax ?? 0) > 0 ? (
          <div className="flex min-w-[240px] justify-between gap-6">
            <dt className="text-muted">{t('procurementInvoiceWithholding')}</dt>
            <dd className="tabular-nums">{formatRupiah(doc.withholding_tax ?? 0, locale)}</dd>
          </div>
        ) : null}
        <div className="flex min-w-[240px] justify-between gap-6 border-t border-line pt-2 font-semibold">
          <dt>{t('purchaseTotal')}</dt>
          <dd className="tabular-nums">{formatRupiah(doc.total ?? 0, locale)}</dd>
        </div>
        {(doc.amount_paid ?? 0) > 0 || (doc.amount_due ?? 0) > 0 ? (
          <>
            <div className="flex min-w-[240px] justify-between gap-6">
              <dt className="text-muted">{t('procurementPaymentStatusPaid')}</dt>
              <dd className="tabular-nums">{formatRupiah(doc.amount_paid ?? 0, locale)}</dd>
            </div>
            <div className="flex min-w-[240px] justify-between gap-6">
              <dt className="text-muted">{t('procurementPaymentDue')}</dt>
              <dd className="tabular-nums">{formatRupiah(doc.amount_due ?? 0, locale)}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  )
}
