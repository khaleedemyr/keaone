import { formatDateTime, formatRupiah } from '../lib/money'
import type { PosSettlement } from '../types'
import { useI18n, type MsgKey } from '../i18n'

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${strong ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function payLabel(method: string, t: (key: MsgKey) => string) {
  if (method === 'cash') return t('cash')
  if (method === 'transfer') return t('transfer')
  if (method === 'qris') return t('qris')
  return method
}

export function SettlementPaper({ data }: { data: PosSettlement }) {
  const { t, locale } = useI18n()
  const methods = (['cash', 'transfer', 'qris'] as const).filter((method) => data.payment_methods[method].amount > 0 || data.payment_methods[method].count > 0)

  return (
    <div id="receipt" className="receipt-paper" style={{ width: `${data.receipt_width}mm` }}>
      {data.company.logo ? (
        <div className="receipt-logo-wrap is-center">
          <img src={data.company.logo} alt="" className="receipt-logo is-md" />
        </div>
      ) : null}
      <div className="text-center text-[16px] font-bold leading-5">{data.company.name || '—'}</div>
      {data.outlet?.name ? <div className="text-center text-[11px] leading-4">{data.outlet.name}</div> : null}
      <div className="my-1.5 border-t border-dashed border-slate-400" />
      <div className="text-center text-[13px] font-bold">{t('posSettlementTitle')}</div>
      <div className="text-center text-[11px] leading-4">{formatDateTime(data.from, locale)} — {formatDateTime(data.to, locale)}</div>
      <div className="my-1.5 border-t border-dashed border-slate-400" />
      <div className="space-y-0.5 text-[13px] leading-5">
        <Row label={t('cashier')} value={data.cashier ?? '—'} />
        <Row label={t('posSettlementPrinted')} value={formatDateTime(data.printed_at, locale)} />
        {data.first_sale_at ? <Row label={t('posSettlementFirst')} value={formatDateTime(data.first_sale_at, locale)} /> : null}
        {data.last_sale_at ? <Row label={t('posSettlementLast')} value={formatDateTime(data.last_sale_at, locale)} /> : null}
      </div>
      <div className="my-1.5 border-t border-dashed border-slate-400" />
      <div className="space-y-0.5 text-[13px] leading-5">
        <Row label={t('cardTx')} value={String(data.sales_count)} />
        <Row label={t('cardItems')} value={String(data.items_sold)} />
        {data.cancelled_count ? <Row label={t('posSettlementCancelled')} value={String(data.cancelled_count)} /> : null}
        {data.subtotal !== data.revenue ? <Row label={t('receiptSubtotal')} value={formatRupiah(data.subtotal, locale)} /> : null}
        {data.discount ? <Row label={t('receiptDiscount')} value={`-${formatRupiah(data.discount, locale)}`} /> : null}
        {data.tax ? <Row label={t('receiptTax')} value={formatRupiah(data.tax, locale)} /> : null}
        <Row label={t('cardRevenue')} value={formatRupiah(data.revenue, locale)} strong />
        <Row label={t('cardAvg')} value={formatRupiah(data.average_ticket, locale)} />
      </div>
      <div className="my-1.5 border-t border-dashed border-slate-400" />
      <div className="space-y-0.5 text-[13px] leading-5">
        {(methods.length ? methods : (['cash', 'transfer', 'qris'] as const)).map((method) => {
          const row = data.payment_methods[method]
          return <Row key={method} label={`${payLabel(method, t)} (${row.count})`} value={formatRupiah(row.amount, locale)} />
        })}
        {data.change ? <Row label={t('change')} value={formatRupiah(data.change, locale)} /> : null}
        <Row label={t('posSettlementNetCash')} value={formatRupiah(data.cash_net, locale)} strong />
      </div>
      {data.cashiers.length > 1 ? (
        <>
          <div className="my-1.5 border-t border-dashed border-slate-400" />
          <div className="mb-1 text-[11px] font-semibold">{t('posSettlementCashiers')}</div>
          <div className="space-y-0.5 text-[13px] leading-5">
            {data.cashiers.map((row, index) => (
              <Row
                key={`${row.name}-${index}`}
                label={`${row.name} (${row.sales_count})`}
                value={formatRupiah(row.revenue, locale)}
              />
            ))}
          </div>
        </>
      ) : null}
      <div className="my-1.5 border-t border-dashed border-slate-400" />
      <div className="text-center text-[11px] leading-4">{t('posSettlementHint')}</div>
    </div>
  )
}
