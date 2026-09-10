import { formatRupiah } from '../../lib/money'
import { DocHeader, DocItemsTable, DocTh, MetaField } from './purchaseDocShared'

export type PaymentBatchDetailViewData = {
  number: string
  status: string
  payment_method?: string | null
  total?: number
  note?: string | null
  paid_at?: string | null
  created_at?: string | null
  user?: { name: string } | null
  items?: Array<{
    id?: number
    amount: number
    vendor_invoice?: {
      number?: string
      vendor_ref?: string | null
      supplier?: { name?: string } | null
      amount_due?: number
      total?: number
    } | null
  }>
}

export function PaymentBatchDetailView({
  doc,
  locale,
  t,
  statusLabel,
  methodLabel,
}: {
  doc: PaymentBatchDetailViewData
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  statusLabel: string
  methodLabel: string
}) {
  return (
    <div className="font-sans text-sm leading-relaxed text-fg">
      <DocHeader
        docLabel={t('procurementPaymentTitle')}
        number={doc.number}
        status={doc.status}
        statusLabel={statusLabel}
        createdAt={doc.created_at}
        createdAtLabel={t('purchaseCreatedAt')}
        locale={locale}
      />

      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetaField label={t('purchaseCreatedBy')} value={doc.user?.name ?? '—'} />
        <MetaField label={t('procurementPaymentMethod')} value={methodLabel || '—'} />
        <MetaField
          label={t('procurementPaymentPay')}
          value={
            doc.paid_at
              ? new Date(doc.paid_at).toLocaleString(locale === 'id' ? 'id-ID' : locale)
              : '—'
          }
        />
        <MetaField label={t('purchaseNote')} value={doc.note?.trim() ? doc.note : '—'} />
      </dl>

      <DocItemsTable
        columns={
          <>
            <DocTh>{t('procurementInvoiceTitle')}</DocTh>
            <DocTh>{t('navSuppliers')}</DocTh>
            <DocTh align="right">{t('procurementPaymentDue')}</DocTh>
            <DocTh align="right">{t('total')}</DocTh>
          </>
        }
      >
        {(doc.items ?? []).map((item, index) => (
          <tr key={item.id ?? index} className="border-b border-line/70 last:border-0">
            <td className="px-3 py-2.5 align-top">
              <div className="font-medium text-fg">{item.vendor_invoice?.number ?? '—'}</div>
              {item.vendor_invoice?.vendor_ref ? (
                <div className="text-xs text-muted">{item.vendor_invoice.vendor_ref}</div>
              ) : null}
            </td>
            <td className="px-3 py-2.5 text-muted">{item.vendor_invoice?.supplier?.name ?? '—'}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {formatRupiah(item.vendor_invoice?.amount_due ?? item.vendor_invoice?.total ?? 0, locale)}
            </td>
            <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatRupiah(item.amount, locale)}</td>
          </tr>
        ))}
      </DocItemsTable>

      <dl className="mt-4 flex flex-col items-end gap-1 text-sm">
        <div className="flex min-w-[220px] justify-between gap-6 border-t border-line pt-2 font-semibold">
          <dt>{t('total')}</dt>
          <dd className="tabular-nums">{formatRupiah(doc.total ?? 0, locale)}</dd>
        </div>
      </dl>
    </div>
  )
}
