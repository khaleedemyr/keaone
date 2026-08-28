import type { ReactNode } from 'react'
import { formatRupiah } from '../../lib/money'
import { DocHeader, DocItemsTable, DocTh, MetaField } from './purchaseDocShared'

export type PrDetailViewData = {
  number: string
  status: string
  needed_at?: string | null
  note?: string | null
  created_at?: string | null
  user?: { name: string } | null
  approver?: { name: string } | null
  approved_at?: string | null
  warehouse?: { name: string } | null
  outlet?: { name: string } | null
  approvals?: Array<{
    id: number
    level: number
    user?: { name: string } | null
    status: string
    acted_at?: string | null
    is_current?: boolean
  }>
  items?: Array<{
    id?: number
    name_snapshot?: string | null
    product?: { name?: string; sku?: string | null } | null
    qty: number
    unit?: string | null
    suggested_unit_cost?: number
    note?: string | null
  }>
}

function approvalStatusLabel(
  status: string,
  t: (key: string, params?: Record<string, string>) => string,
) {
  const map: Record<string, string> = {
    pending: t('purchaseStatusSubmitted'),
    approved: t('purchaseStatusApproved'),
    rejected: t('purchaseStatusRejected'),
  }
  return map[status] ?? status
}

export function PrDetailView({
  pr,
  locale,
  t,
  statusLabel,
  actions,
  shareHint,
  subtitle,
}: {
  pr: PrDetailViewData
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  statusLabel: string
  actions?: ReactNode
  shareHint?: ReactNode
  subtitle?: string
}) {
  const approvals = [...(pr.approvals ?? [])].sort((a, b) => a.level - b.level)

  return (
    <div className="font-sans text-sm leading-relaxed text-fg">
      <DocHeader
        docLabel={t('purchasePrTitle')}
        number={pr.number}
        status={pr.status}
        statusLabel={statusLabel}
        createdAt={pr.created_at}
        createdAtLabel={t('createdAt')}
        locale={locale}
        subtitle={subtitle}
      />

      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetaField label={t('purchaseCreatedBy')} value={pr.user?.name ?? '—'} />
        <MetaField label={t('navWarehouses')} value={pr.warehouse?.name ?? '—'} />
        {pr.outlet?.name ? <MetaField label={t('navOutlets')} value={pr.outlet.name} /> : null}
        <MetaField label={t('purchaseNeededAt')} value={pr.needed_at ?? '—'} />
        <MetaField label={t('purchaseNote')} value={pr.note?.trim() ? pr.note : '—'} />
        {pr.approver?.name ? (
          <MetaField label={t('purchaseApprovedBy')} value={pr.approver.name} />
        ) : null}
      </dl>

      {actions ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-line py-3">{actions}</div>
      ) : null}
      {shareHint ? <div className="mt-3">{shareHint}</div> : null}

      {approvals.length > 0 ? (
        <div className="mt-5 rounded-lg border border-line bg-fill/20 p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('purchaseApprovers')}</h4>
          <ul className="mt-3 space-y-2">
            {approvals.map((step) => (
              <li
                key={step.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className="font-medium text-fg">
                  {t('purchaseApprovalLevel', { n: String(step.level) })} · {step.user?.name ?? '—'}
                </span>
                <span className="text-xs text-muted">{approvalStatusLabel(step.status, t)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
        {(pr.items ?? []).map((item, index) => {
          const name = item.name_snapshot || item.product?.name || '—'
          const sku = item.product?.sku
          const refCost = item.suggested_unit_cost ?? 0
          return (
            <tr key={item.id ?? `${name}-${index}`} className="border-b border-line/70 last:border-0">
              <td className="px-3 py-2.5 align-top">
                <div className="font-medium text-fg">{name}</div>
                {sku ? <div className="text-xs text-muted">{sku}</div> : null}
                {item.note ? <div className="text-xs text-muted">{item.note}</div> : null}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.qty}</td>
              <td className="px-3 py-2.5 text-muted">{item.unit ?? '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                {refCost > 0 ? formatRupiah(refCost, locale) : '—'}
              </td>
            </tr>
          )
        })}
      </DocItemsTable>
    </div>
  )
}
