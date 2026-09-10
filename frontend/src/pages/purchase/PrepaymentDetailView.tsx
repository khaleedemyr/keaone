import { formatRupiah } from '../../lib/money'
import { DocHeader, DocItemsTable, DocTh, MetaField } from './purchaseDocShared'

export type PrepaymentDetailViewData = {
  number: string
  status: string
  amount?: number
  amount_applied?: number
  amount_balance?: number
  payment_method?: string | null
  note?: string | null
  paid_at?: string | null
  created_at?: string | null
  user?: { name: string } | null
  supplier?: { name: string } | null
  purchase_order?: { number: string } | null
  applications?: Array<{
    id?: number
    amount: number
    applied_at?: string | null
    is_planned?: boolean
    vendor_invoice?: { number?: string; vendor_ref?: string | null } | null
  }>
}

export function PrepaymentDetailView({
  doc,
  locale,
  t,
  statusLabel,
  methodLabel,
}: {
  doc: PrepaymentDetailViewData
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  statusLabel: string
  methodLabel: string
}) {
  return (
    <div className="font-sans text-sm leading-relaxed text-fg">
      <DocHeader
        docLabel={t('procurementPrepaymentTitle')}
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
        <MetaField label={t('purchasePoTitle')} value={doc.purchase_order?.number ?? '—'} />
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

      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-3 text-sm">
        <MetaField label={t('total')} value={formatRupiah(doc.amount ?? 0, locale)} />
        <MetaField label={t('procurementPrepaymentApplied')} value={formatRupiah(doc.amount_applied ?? 0, locale)} />
        <MetaField label={t('procurementPrepaymentBalance')} value={formatRupiah(doc.amount_balance ?? 0, locale)} />
      </dl>

      {(doc.applications ?? []).length > 0 ? (
        <DocItemsTable
          columns={
            <>
              <DocTh>{t('procurementInvoiceTitle')}</DocTh>
              <DocTh>{t('status')}</DocTh>
              <DocTh align="right">{t('total')}</DocTh>
            </>
          }
        >
          {(doc.applications ?? []).map((row, index) => (
            <tr key={row.id ?? index} className="border-b border-line/70 last:border-0">
              <td className="px-3 py-2.5 align-top">
                <div className="font-medium text-fg">{row.vendor_invoice?.number ?? '—'}</div>
                {row.vendor_invoice?.vendor_ref ? (
                  <div className="text-xs text-muted">{row.vendor_invoice.vendor_ref}</div>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-muted">
                {row.is_planned || !row.applied_at
                  ? t('purchaseStatusDraft')
                  : new Date(row.applied_at).toLocaleString(locale === 'id' ? 'id-ID' : locale)}
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatRupiah(row.amount, locale)}</td>
            </tr>
          ))}
        </DocItemsTable>
      ) : null}
    </div>
  )
}
