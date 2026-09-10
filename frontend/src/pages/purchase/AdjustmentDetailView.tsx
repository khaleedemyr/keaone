import { formatRupiah } from '../../lib/money'
import { DocHeader, DocItemsTable, DocTh, MetaField } from './purchaseDocShared'

export type AdjustmentDetailViewData = {
  number: string
  status: string
  type: string
  reason?: string | null
  note?: string | null
  total?: number
  confirmed_at?: string | null
  created_at?: string | null
  user?: { name: string } | null
  supplier?: { name: string } | null
  goods_receipt?: { number: string } | null
  purchase_order?: { number: string } | null
  items?: Array<{
    id?: number
    name_snapshot?: string | null
    qty: number
    unit_cost_before?: number
    unit_cost_after?: number
    adjustment_amount?: number
  }>
}

export function AdjustmentDetailView({
  doc,
  locale,
  t,
  statusLabel,
  typeLabel,
}: {
  doc: AdjustmentDetailViewData
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  statusLabel: string
  typeLabel: string
}) {
  return (
    <div className="font-sans text-sm leading-relaxed text-fg">
      <DocHeader
        docLabel={t('procurementAdjustmentTitle')}
        number={doc.number}
        status={doc.status}
        statusLabel={statusLabel}
        createdAt={doc.created_at}
        createdAtLabel={t('purchaseCreatedAt')}
        locale={locale}
        subtitle={typeLabel}
      />

      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetaField label={t('purchaseCreatedBy')} value={doc.user?.name ?? '—'} />
        <MetaField label={t('navSuppliers')} value={doc.supplier?.name ?? '—'} />
        <MetaField label={t('purchaseGrTitle')} value={doc.goods_receipt?.number ?? '—'} />
        <MetaField label={t('purchasePoTitle')} value={doc.purchase_order?.number ?? '—'} />
        <MetaField
          label={t('purchaseConfirm')}
          value={
            doc.confirmed_at
              ? new Date(doc.confirmed_at).toLocaleString(locale === 'id' ? 'id-ID' : locale)
              : '—'
          }
        />
        <MetaField label={t('procurementReturnReason')} value={doc.reason?.trim() ? doc.reason : '—'} />
        <MetaField label={t('purchaseNote')} value={doc.note?.trim() ? doc.note : '—'} />
      </dl>

      <DocItemsTable
        columns={
          <>
            <DocTh>{t('product')}</DocTh>
            <DocTh align="right">{t('posColQty')}</DocTh>
            <DocTh align="right">{t('procurementAdjustmentCostBefore')}</DocTh>
            <DocTh align="right">{t('procurementAdjustmentCostAfter')}</DocTh>
            <DocTh align="right">{t('purchaseTotal')}</DocTh>
          </>
        }
      >
        {(doc.items ?? []).map((item, index) => (
          <tr key={item.id ?? index} className="border-b border-line/70 last:border-0">
            <td className="px-3 py-2.5 font-medium text-fg">{item.name_snapshot || '—'}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{item.qty}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(item.unit_cost_before ?? 0, locale)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(item.unit_cost_after ?? 0, locale)}</td>
            <td className="px-3 py-2.5 text-right font-medium tabular-nums">
              {formatRupiah(item.adjustment_amount ?? 0, locale)}
            </td>
          </tr>
        ))}
      </DocItemsTable>

      <dl className="mt-4 flex flex-col items-end gap-1 text-sm">
        <div className="flex min-w-[220px] justify-between gap-6 border-t border-line pt-2 font-semibold">
          <dt>{t('purchaseTotal')}</dt>
          <dd className="tabular-nums">{formatRupiah(doc.total ?? 0, locale)}</dd>
        </div>
      </dl>
    </div>
  )
}
