import { formatRupiah } from '../../lib/money'
import { DocHeader, DocItemsTable, DocTh, MetaField } from './purchaseDocShared'

export type ReturnDetailViewData = {
  number: string
  status: string
  reason?: string | null
  note?: string | null
  returned_at?: string | null
  created_at?: string | null
  user?: { name: string } | null
  supplier?: { name: string } | null
  warehouse?: { name: string } | null
  goods_receipt?: { number: string } | null
  items?: Array<{
    id?: number
    name_snapshot?: string | null
    product?: { name?: string; sku?: string | null } | null
    qty: number
    unit?: string | null
    unit_cost?: number
  }>
}

export function ReturnDetailView({
  doc,
  locale,
  t,
  statusLabel,
}: {
  doc: ReturnDetailViewData
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  statusLabel: string
}) {
  return (
    <div className="font-sans text-sm leading-relaxed text-fg">
      <DocHeader
        docLabel={t('procurementReturnTitle')}
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
        <MetaField label={t('navWarehouses')} value={doc.warehouse?.name ?? '—'} />
        <MetaField label={t('purchaseGrTitle')} value={doc.goods_receipt?.number ?? '—'} />
        <MetaField
          label={t('procurementReturnConfirm')}
          value={
            doc.returned_at
              ? new Date(doc.returned_at).toLocaleString(locale === 'id' ? 'id-ID' : locale)
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
            <DocTh>{t('unit')}</DocTh>
            <DocTh align="right">{t('purchaseUnitCost')}</DocTh>
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
            </tr>
          )
        })}
      </DocItemsTable>
    </div>
  )
}
