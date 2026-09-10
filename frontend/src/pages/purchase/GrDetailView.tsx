import { formatRupiah } from '../../lib/money'
import { DocHeader, DocItemsTable, DocTh, MetaField } from './purchaseDocShared'

export type GrDetailViewData = {
  number: string
  status: string
  note?: string | null
  subtotal?: number
  tax?: number
  total?: number
  received_at?: string | null
  voided_at?: string | null
  void_reason?: string | null
  created_at?: string | null
  user?: { name: string } | null
  supplier?: { name: string; phone?: string | null } | null
  warehouse?: { name: string } | null
  outlet?: { name: string } | null
  purchase_order?: { number: string; status?: string } | null
  items?: Array<{
    id?: number
    name_snapshot?: string | null
    product?: { name?: string; sku?: string | null } | null
    qty: number
    unit?: string | null
    unit_cost?: number
    total?: number
  }>
}

export function GrDetailView({
  gr,
  locale,
  t,
  statusLabel,
}: {
  gr: GrDetailViewData
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  statusLabel: string
}) {
  return (
    <div className="font-sans text-sm leading-relaxed text-fg">
      <DocHeader
        docLabel={t('purchaseGrTitle')}
        number={gr.number}
        status={gr.status}
        statusLabel={statusLabel}
        createdAt={gr.created_at}
        createdAtLabel={t('purchaseCreatedAt')}
        locale={locale}
      />

      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetaField label={t('purchaseCreatedBy')} value={gr.user?.name ?? '—'} />
        <MetaField label={t('outlet')} value={gr.outlet?.name ?? '—'} />
        <MetaField label={t('navWarehouses')} value={gr.warehouse?.name ?? '—'} />
        <MetaField label={t('navSuppliers')} value={gr.supplier?.name ?? '—'} />
        <MetaField label={t('purchasePoTitle')} value={gr.purchase_order?.number ?? '—'} />
        <MetaField
          label={t('purchaseConfirm')}
          value={
            gr.received_at
              ? new Date(gr.received_at).toLocaleString(locale === 'id' ? 'id-ID' : locale)
              : '—'
          }
        />
        {gr.voided_at ? (
          <MetaField
            label={t('procurementGrVoid')}
            value={`${new Date(gr.voided_at).toLocaleString(locale === 'id' ? 'id-ID' : locale)}${
              gr.void_reason ? ` · ${gr.void_reason}` : ''
            }`}
          />
        ) : null}
        <MetaField label={t('purchaseNote')} value={gr.note?.trim() ? gr.note : '—'} />
      </dl>

      <DocItemsTable
        columns={
          <>
            <DocTh>{t('product')}</DocTh>
            <DocTh align="right">{t('posColQty')}</DocTh>
            <DocTh>{t('unit')}</DocTh>
            <DocTh align="right">{t('purchaseUnitCost')}</DocTh>
            <DocTh align="right">{t('purchaseTotal')}</DocTh>
          </>
        }
      >
        {(gr.items ?? []).map((item, index) => {
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
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatRupiah(item.total ?? 0, locale)}</td>
            </tr>
          )
        })}
      </DocItemsTable>

      <dl className="mt-4 flex flex-col items-end gap-1 text-sm">
        <div className="flex min-w-[220px] justify-between gap-6">
          <dt className="text-muted">{t('purchaseSubtotal')}</dt>
          <dd className="tabular-nums">{formatRupiah(gr.subtotal ?? 0, locale)}</dd>
        </div>
        {(gr.tax ?? 0) > 0 ? (
          <div className="flex min-w-[220px] justify-between gap-6">
            <dt className="text-muted">{t('purchaseTax')}</dt>
            <dd className="tabular-nums">{formatRupiah(gr.tax ?? 0, locale)}</dd>
          </div>
        ) : null}
        <div className="flex min-w-[220px] justify-between gap-6 border-t border-line pt-2 font-semibold">
          <dt>{t('purchaseTotal')}</dt>
          <dd className="tabular-nums">{formatRupiah(gr.total ?? 0, locale)}</dd>
        </div>
      </dl>
    </div>
  )
}
