import type { ReactNode } from 'react'
import { DocHeader, DocItemsTable, DocTh, MetaField } from '../purchase/purchaseDocShared'
import type { MsgKey } from '../../i18n'

type TFn = (key: MsgKey, params?: Record<string, string>) => string

function emptyItems(t: TFn) {
  return (
    <tr>
      <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted">
        {t('stockDetailItems')}: —
      </td>
    </tr>
  )
}

/** Shared chrome for inventory document detail (matches procurement doc style). */
export function InventoryDocShell({
  docLabel,
  number,
  status,
  statusLabel,
  createdAt,
  locale,
  t,
  children,
  meta,
}: {
  docLabel: string
  number: string
  status: string
  statusLabel: string
  createdAt?: string | null
  locale: string
  t: TFn
  meta: ReactNode
  children: ReactNode
}) {
  return (
    <div className="font-sans text-sm leading-relaxed text-fg">
      <DocHeader
        docLabel={docLabel}
        number={number}
        status={status}
        statusLabel={statusLabel}
        createdAt={createdAt}
        createdAtLabel={t('purchaseCreatedAt')}
        locale={locale}
      />
      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{meta}</dl>
      {children}
    </div>
  )
}

export function InventoryFormSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="border-b border-line pb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h3>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function InventoryLineTable({
  columns,
  children,
  footer,
}: {
  columns: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-fill/60">{columns}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {footer ? <div className="border-t border-line bg-fill/30 px-3 py-2">{footer}</div> : null}
    </div>
  )
}

export function TransferDetailView({
  doc,
  locale,
  t,
  statusLabel,
}: {
  doc: {
    number: string
    status: string
    note?: string | null
    created_at?: string | null
    user?: { name?: string } | null
    from_warehouse?: { name?: string } | null
    to_warehouse?: { name?: string } | null
    void_reason?: string | null
    items?: Array<{
      product_id: number
      name_snapshot: string
      qty: number
      qty_input?: number
      unit?: string | null
      sku?: string | null
    }>
  }
  locale: string
  t: TFn
  statusLabel: string
}) {
  const items = doc.items ?? []
  return (
    <InventoryDocShell
      docLabel={t('stockTransfersTitle')}
      number={doc.number}
      status={doc.status}
      statusLabel={statusLabel}
      createdAt={doc.created_at}
      locale={locale}
      t={t}
      meta={
        <>
          <MetaField label={t('purchaseCreatedBy')} value={doc.user?.name ?? '—'} />
          <MetaField label={t('stockTransferFrom')} value={doc.from_warehouse?.name ?? '—'} />
          <MetaField label={t('stockTransferTo')} value={doc.to_warehouse?.name ?? '—'} />
          <MetaField label={t('purchaseNote')} value={doc.note?.trim() ? doc.note : '—'} />
          {doc.void_reason ? <MetaField label={t('stockVoidReasonLabel')} value={doc.void_reason} /> : null}
        </>
      }
    >
      <DocItemsTable
        columns={
          <>
            <DocTh>#</DocTh>
            <DocTh>{t('product')}</DocTh>
            <DocTh align="right">{t('stockQty')}</DocTh>
            <DocTh>{t('unit')}</DocTh>
          </>
        }
      >
        {items.length === 0
          ? emptyItems(t)
          : items.map((item, i) => (
              <tr key={`${item.product_id}-${i}`} className="border-b border-line/70 last:border-0">
                <td className="px-3 py-2.5 tabular-nums text-muted">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-fg">{item.name_snapshot}</div>
                </td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{item.qty_input ?? item.qty}</td>
                <td className="px-3 py-2.5 text-muted">{item.unit ?? '—'}</td>
              </tr>
            ))}
      </DocItemsTable>
    </InventoryDocShell>
  )
}

export function OpnameDetailView({
  doc,
  locale,
  t,
  statusLabel,
}: {
  doc: {
    number: string
    status: string
    note?: string | null
    created_at?: string | null
    user?: { name?: string } | null
    warehouse?: { name?: string } | null
    items?: Array<{
      product_id: number
      name_snapshot: string
      book_qty: number
      counted_qty: number
      counted_qty_input?: number
      variance: number
      unit?: string | null
    }>
  }
  locale: string
  t: TFn
  statusLabel: string
}) {
  const items = doc.items ?? []
  return (
    <InventoryDocShell
      docLabel={t('stockOpnamesTitle')}
      number={doc.number}
      status={doc.status}
      statusLabel={statusLabel}
      createdAt={doc.created_at}
      locale={locale}
      t={t}
      meta={
        <>
          <MetaField label={t('purchaseCreatedBy')} value={doc.user?.name ?? '—'} />
          <MetaField label={t('navWarehouses')} value={doc.warehouse?.name ?? '—'} />
          <MetaField label={t('purchaseNote')} value={doc.note?.trim() ? doc.note : '—'} />
        </>
      }
    >
      <DocItemsTable
        columns={
          <>
            <DocTh>#</DocTh>
            <DocTh>{t('product')}</DocTh>
            <DocTh align="right">{t('stockOpnameBookQty')}</DocTh>
            <DocTh align="right">{t('stockOpnameCountedQty')}</DocTh>
            <DocTh align="right">{t('stockOpnameVariance')}</DocTh>
            <DocTh>{t('unit')}</DocTh>
          </>
        }
      >
        {items.length === 0
          ? emptyItems(t)
          : items.map((item, i) => {
              const variance = item.variance ?? (item.counted_qty ?? 0) - (item.book_qty ?? 0)
              const varianceClass =
                variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-muted'
              return (
                <tr key={`${item.product_id}-${i}`} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-2.5 tabular-nums text-muted">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-fg">{item.name_snapshot}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{item.book_qty}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {item.counted_qty_input ?? item.counted_qty}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${varianceClass}`}>
                    {variance > 0 ? `+${variance}` : variance}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{item.unit ?? '—'}</td>
                </tr>
              )
            })}
      </DocItemsTable>
    </InventoryDocShell>
  )
}

export function AdjustmentDetailView({
  doc,
  locale,
  t,
  statusLabel,
  reasonLabel,
  docLabel,
}: {
  doc: {
    number: string
    status: string
    reason: string
    note?: string | null
    created_at?: string | null
    user?: { name?: string } | null
    warehouse?: { name?: string } | null
    items?: Array<{
      product_id: number
      name_snapshot: string
      qty_change: number
      qty_input?: number
      unit?: string | null
    }>
  }
  locale: string
  t: TFn
  statusLabel: string
  reasonLabel: string
  docLabel: string
}) {
  const items = doc.items ?? []
  return (
    <InventoryDocShell
      docLabel={docLabel}
      number={doc.number}
      status={doc.status}
      statusLabel={statusLabel}
      createdAt={doc.created_at}
      locale={locale}
      t={t}
      meta={
        <>
          <MetaField label={t('purchaseCreatedBy')} value={doc.user?.name ?? '—'} />
          <MetaField label={t('navWarehouses')} value={doc.warehouse?.name ?? '—'} />
          <MetaField label={t('stockAdjReason')} value={reasonLabel} />
          <MetaField label={t('purchaseNote')} value={doc.note?.trim() ? doc.note : '—'} />
        </>
      }
    >
      <DocItemsTable
        columns={
          <>
            <DocTh>#</DocTh>
            <DocTh>{t('product')}</DocTh>
            <DocTh align="right">{t('stockQty')}</DocTh>
            <DocTh>{t('unit')}</DocTh>
          </>
        }
      >
        {items.length === 0
          ? emptyItems(t)
          : items.map((item, i) => {
              const qty = item.qty_input ?? item.qty_change
              const qtyClass = qty > 0 ? 'text-emerald-600' : qty < 0 ? 'text-rose-600' : 'text-fg'
              return (
                <tr key={`${item.product_id}-${i}`} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-2.5 tabular-nums text-muted">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-fg">{item.name_snapshot}</td>
                  <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${qtyClass}`}>
                    {qty > 0 ? `+${qty}` : qty}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{item.unit ?? '—'}</td>
                </tr>
              )
            })}
      </DocItemsTable>
    </InventoryDocShell>
  )
}

export function ProductionDetailView({
  doc,
  locale,
  t,
  statusLabel,
  manufacturing,
}: {
  doc: {
    number: string
    status: string
    product_name: string
    note?: string | null
    created_at?: string | null
    scrap_qty?: number
    lot_code?: string | null
    user?: { name?: string } | null
    warehouse?: { name?: string } | null
    product?: { sku?: string | null; unit?: string | null } | null
    qty: number
    qty_input?: number
    unit?: string | null
    base_unit?: string | null
    factor_to_base?: number
    items?: Array<{
      product_id: number
      name_snapshot: string
      qty_planned: number
      qty_actual?: number | null
      unit?: string | null
    }>
    serials?: Array<{ id: number; serial_number: string; status: string }>
  }
  locale: string
  t: TFn
  statusLabel: string
  manufacturing: boolean
}) {
  const items = doc.items ?? []
  const qtyLabel = `${doc.qty_input ?? doc.qty}${doc.unit ? ` ${doc.unit}` : ''}`
  return (
    <InventoryDocShell
      docLabel={t(manufacturing ? 'stockProductionMfgTitle' : 'stockProductionTitle')}
      number={doc.number}
      status={doc.status}
      statusLabel={statusLabel}
      createdAt={doc.created_at}
      locale={locale}
      t={t}
      meta={
        <>
          <MetaField label={t('purchaseCreatedBy')} value={doc.user?.name ?? '—'} />
          <MetaField label={t('navWarehouses')} value={doc.warehouse?.name ?? '—'} />
          <MetaField
            label={t('stockProductionProduct')}
            value={doc.product?.sku ? `${doc.product_name} (${doc.product.sku})` : doc.product_name}
          />
          <MetaField label={t('stockProductionQty')} value={qtyLabel} />
          {manufacturing ? (
            <>
              <MetaField label={t('stockProductionScrap')} value={String(doc.scrap_qty ?? 0)} />
              <MetaField label={t('stockProductionLot')} value={doc.lot_code?.trim() ? doc.lot_code : '—'} />
            </>
          ) : null}
          <MetaField label={t('purchaseNote')} value={doc.note?.trim() ? doc.note : '—'} />
        </>
      }
    >
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {t('stockProductionBomPreview')}
      </p>
      <DocItemsTable
        columns={
          <>
            <DocTh>#</DocTh>
            <DocTh>{t('product')}</DocTh>
            <DocTh align="right">{t('stockProductionPlanned')}</DocTh>
            {manufacturing ? <DocTh align="right">{t('stockProductionActual')}</DocTh> : null}
            <DocTh>{t('unit')}</DocTh>
          </>
        }
      >
        {items.length === 0
          ? emptyItems(t)
          : items.map((item, i) => (
              <tr key={`${item.product_id}-${i}`} className="border-b border-line/70 last:border-0">
                <td className="px-3 py-2.5 tabular-nums text-muted">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium text-fg">{item.name_snapshot}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{item.qty_planned}</td>
                {manufacturing ? (
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {item.qty_actual ?? item.qty_planned}
                  </td>
                ) : null}
                <td className="px-3 py-2.5 text-muted">{item.unit ?? '—'}</td>
              </tr>
            ))}
      </DocItemsTable>

      {doc.serials && doc.serials.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {t('stockProductionSerials')}
          </p>
          <div className="overflow-hidden rounded-xl border border-line">
            <ul className="divide-y divide-line text-sm">
              {doc.serials.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="font-medium tabular-nums text-fg">{s.serial_number}</span>
                  <span className="text-xs uppercase tracking-wide text-muted">{s.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </InventoryDocShell>
  )
}
