import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, apiMessage } from '../api/client'
import { formatDate, formatRupiah } from '../lib/money'
import type { ApiOk, SalesReport, SalesReportKind } from '../types'
import { PageEnter, TiltCard } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { useI18n, type MsgKey } from '../i18n'
import { EngineeringReport } from './EngineeringReport'

const TITLE: Record<SalesReportKind, MsgKey> = {
  summary: 'salesReportSummary',
  products: 'salesReportProducts',
  cashiers: 'salesReportCashiers',
  methods: 'salesReportMethods',
  channels: 'salesReportChannels',
  daily: 'salesReportDaily',
}

function localIso(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function shiftDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return localIso(date)
}

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

function payLabel(method: string, t: (key: MsgKey) => string) {
  if (method === 'cash') return t('cash')
  if (method === 'transfer') return t('transfer')
  if (method === 'qris') return t('qris')
  return method
}

function channelLabel(channel: string, t: (key: MsgKey) => string) {
  return channel === 'pos' || !channel ? t('posChannelPos') : channel
}

function share(part: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

export default function SalesReports({ kind }: { kind: SalesReportKind }) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const today = localIso()
  const [from, setFrom] = useState(monthStart(today))
  const [to, setTo] = useState(today)
  const [report, setReport] = useState<SalesReport | null>(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    setReport(null)
    const handle = window.setTimeout(() => {
      void api
        .get<ApiOk<SalesReport>>('/sales/reports', { params: { kind, from, to } })
        .then(({ data }) => setReport(data.data))
        .catch((err) => {
          setReport(null)
          feedback.error(apiMessage(err, t('salesReportFailed')))
        })
    }, 150)
    return () => window.clearTimeout(handle)
  }, [kind, from, to, feedback, t])

  const title = t(TITLE[kind])
  const methods = report?.payment_methods
  const rows = report?.rows ?? []
  const revenueTotal = useMemo(() => {
    if (kind === 'summary') return report?.revenue ?? 0
    return rows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0)
  }, [kind, report, rows])

  function applyPreset(preset: 'today' | 'week' | 'month') {
    const now = localIso()
    if (preset === 'today') {
      setFrom(now)
      setTo(now)
      return
    }
    if (preset === 'week') {
      setFrom(shiftDays(now, -6))
      setTo(now)
      return
    }
    setFrom(monthStart(now))
    setTo(now)
  }

  return (
    <PageEnter>
      <PageHeader
        eyebrow={t('salesEyebrow')}
        title={title}
        subtitle={`${formatDate(from, locale)} — ${formatDate(to, locale)}`}
        action={
          <button type="button" className="btn-ghost" disabled={!report} onClick={() => setPrinting(true)}>
            {t('print')}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          {t('salesReportFrom')}
          <input type="date" className="field mt-1 py-2" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          {t('salesReportTo')}
          <input type="date" className="field mt-1 py-2" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="btn-ghost py-2 text-xs" onClick={() => applyPreset('today')}>
          {t('salesReportToday')}
        </button>
        <button type="button" className="btn-ghost py-2 text-xs" onClick={() => applyPreset('week')}>
          {t('salesReportWeek')}
        </button>
        <button type="button" className="btn-ghost py-2 text-xs" onClick={() => applyPreset('month')}>
          {t('salesReportMonth')}
        </button>
      </div>

      {!report ? <div className="text-sm text-muted">{t('loadingWork')}</div> : null}

      {report && kind === 'summary' ? (
        <SummaryView report={report} locale={locale} t={t} />
      ) : null}

      {report && kind === 'methods' && methods ? (
        <MethodsView methods={methods} change={report.change ?? 0} cashNet={report.cash_net ?? 0} locale={locale} t={t} />
      ) : null}

      {report && kind === 'products' ? (
        <EngineeringReport
          from={report.from}
          to={report.to}
          categories={report.categories ?? []}
          grandTotal={report.grand_total ?? { qty: 0, discount: 0, revenue: 0 }}
        />
      ) : null}

      {report && kind !== 'summary' && kind !== 'methods' && kind !== 'products' ? (
        <div className="glass overflow-hidden rounded-3xl">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              {kind === 'cashiers' ? (
                <tr>
                  <th className="px-4 py-3 font-medium">{t('cashier')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('cardTx')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('receiptDiscount')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('cardRevenue')}</th>
                </tr>
              ) : null}
              {kind === 'channels' ? (
                <tr>
                  <th className="px-4 py-3 font-medium">{t('posChannel')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('cardTx')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('cardRevenue')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('salesReportShare')}</th>
                </tr>
              ) : null}
              {kind === 'daily' ? (
                <tr>
                  <th className="px-4 py-3 font-medium">{t('time')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('cardTx')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('receiptDiscount')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('receiptTax')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('cardRevenue')}</th>
                </tr>
              ) : null}
            </thead>
            <tbody>
              {kind === 'cashiers'
                ? rows.map((row, index) => (
                    <tr key={`${row.name}-${index}`} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.sales_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(Number(row.discount) || 0, locale)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-mint">{formatRupiah(Number(row.revenue) || 0, locale)}</td>
                    </tr>
                  ))
                : null}
              {kind === 'channels'
                ? rows.map((row) => (
                    <tr key={String(row.channel)} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">{channelLabel(String(row.channel ?? ''), t)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.sales_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-mint">{formatRupiah(Number(row.revenue) || 0, locale)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{share(Number(row.revenue) || 0, revenueTotal)}</td>
                    </tr>
                  ))
                : null}
              {kind === 'daily'
                ? rows.map((row) => (
                    <tr key={String(row.day)} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">{formatDate(String(row.day ?? ''), locale)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.sales_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(Number(row.discount) || 0, locale)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(Number(row.tax) || 0, locale)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-mint">{formatRupiah(Number(row.revenue) || 0, locale)}</td>
                    </tr>
                  ))
                : null}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={5}>
                    {t('salesReportEmpty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {printing && report && typeof document !== 'undefined'
        ? createPortal(
            <div className="receipt-root report-root">
              <button type="button" className="receipt-scrim" aria-label={t('close')} onClick={() => setPrinting(false)} />
              <div className="receipt-dialog">
                <div id="receipt" className="report-sheet">
                  <div className="text-center text-base font-bold">{title}</div>
                  <div className="mb-3 text-center text-xs text-slate-500">
                    {formatDate(report.from, locale)} — {formatDate(report.to, locale)}
                  </div>
                  {kind === 'summary' ? <SummaryPrint report={report} locale={locale} t={t} /> : null}
                  {kind === 'methods' && methods ? (
                    <MethodsPrint methods={methods} change={report.change ?? 0} cashNet={report.cash_net ?? 0} locale={locale} t={t} />
                  ) : null}
                  {kind === 'products' && report.categories ? (
                    <EngineeringPrint categories={report.categories} grandTotal={report.grand_total ?? { qty: 0, discount: 0, revenue: 0 }} locale={locale} t={t} />
                  ) : null}
                  {kind === 'cashiers' ? (
                    <PrintTable
                      headers={[t('cashier'), t('cardTx'), t('receiptDiscount'), t('cardRevenue')]}
                      rows={rows.map((row) => [
                        String(row.name ?? ''),
                        String(row.sales_count ?? 0),
                        formatRupiah(Number(row.discount) || 0, locale),
                        formatRupiah(Number(row.revenue) || 0, locale),
                      ])}
                      empty={t('salesReportEmpty')}
                    />
                  ) : null}
                  {kind === 'channels' ? (
                    <PrintTable
                      headers={[t('posChannel'), t('cardTx'), t('cardRevenue')]}
                      rows={rows.map((row) => [
                        channelLabel(String(row.channel ?? ''), t),
                        String(row.sales_count ?? 0),
                        formatRupiah(Number(row.revenue) || 0, locale),
                      ])}
                      empty={t('salesReportEmpty')}
                    />
                  ) : null}
                  {kind === 'daily' ? (
                    <PrintTable
                      headers={[t('time'), t('cardTx'), t('receiptDiscount'), t('receiptTax'), t('cardRevenue')]}
                      rows={rows.map((row) => [
                        formatDate(String(row.day ?? ''), locale),
                        String(row.sales_count ?? 0),
                        formatRupiah(Number(row.discount) || 0, locale),
                        formatRupiah(Number(row.tax) || 0, locale),
                        formatRupiah(Number(row.revenue) || 0, locale),
                      ])}
                      empty={t('salesReportEmpty')}
                    />
                  ) : null}
                </div>
                <div className="receipt-actions">
                  <button type="button" className="btn-ghost" onClick={() => setPrinting(false)}>
                    {t('close')}
                  </button>
                  <button type="button" className="btn-primary" onClick={() => window.print()}>
                    {t('print')}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </PageEnter>
  )
}

function SummaryView({
  report,
  locale,
  t,
}: {
  report: SalesReport
  locale: string
  t: (key: MsgKey) => string
}) {
  const cards = [
    { label: t('cardTx'), value: String(report.sales_count ?? 0), hint: t('cardTxHint') },
    { label: t('cardRevenue'), value: formatRupiah(report.revenue ?? 0, locale), hint: t('cardRevenueHint') },
    { label: t('cardItems'), value: String(report.items_sold ?? 0), hint: t('cardItemsHint') },
    { label: t('cardAvg'), value: formatRupiah(report.average_ticket ?? 0, locale), hint: t('cardAvgHint') },
  ]
  const methods = report.payment_methods
  const maxPay = Math.max(methods?.cash.amount ?? 0, methods?.transfer.amount ?? 0, methods?.qris.amount ?? 0, 1)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <TiltCard key={card.label}>
            <div className="glass rounded-3xl p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{card.label}</div>
              <div className="mt-3 font-display text-2xl font-bold text-fg">{card.value}</div>
              <div className="mt-2 text-xs text-muted">{card.hint}</div>
            </div>
          </TiltCard>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-3xl p-5">
          <div className="mb-3 text-sm font-medium">{t('paymentFlow')}</div>
          {(['cash', 'transfer', 'qris'] as const).map((method) => {
            const row = methods?.[method]
            const amount = row?.amount ?? 0
            return (
              <div key={method} className="mb-3">
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>
                    {payLabel(method, t)} ({row?.count ?? 0})
                  </span>
                  <span>{formatRupiah(amount, locale)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-fill">
                  <div className="h-full rounded-full bg-gradient-to-r from-mint to-violet" style={{ width: `${Math.round((amount / maxPay) * 100)}%` }} />
                </div>
              </div>
            )
          })}
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-muted">{t('posSettlementNetCash')}</span>
            <span className="font-semibold">{formatRupiah(report.cash_net ?? 0, locale)}</span>
          </div>
          {report.cancelled_count ? (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">{t('posSettlementCancelled')}</span>
              <span>{report.cancelled_count}</span>
            </div>
          ) : null}
        </div>
        <div className="glass rounded-3xl p-5">
          <div className="mb-3 text-sm font-medium">{t('salesReportTopProducts')}</div>
          {(report.top_products ?? []).length === 0 ? <div className="text-sm text-muted">{t('salesReportEmpty')}</div> : null}
          {(report.top_products ?? []).map((row) => (
            <div key={`${row.product_id}-${row.name}`} className="mb-2 flex justify-between gap-3 text-sm">
              <span className="truncate">{row.name}</span>
              <span className="shrink-0 tabular-nums text-mint">{formatRupiah(Number(row.revenue) || 0, locale)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MethodsView({
  methods,
  change,
  cashNet,
  locale,
  t,
}: {
  methods: NonNullable<SalesReport['payment_methods']>
  change: number
  cashNet: number
  locale: string
  t: (key: MsgKey) => string
}) {
  return (
    <div className="glass overflow-hidden rounded-3xl">
      <table className="w-full text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">{t('salesReportMethods')}</th>
            <th className="px-4 py-3 font-medium text-right">{t('cardTx')}</th>
            <th className="px-4 py-3 font-medium text-right">{t('cardRevenue')}</th>
          </tr>
        </thead>
        <tbody>
          {(['cash', 'transfer', 'qris'] as const).map((method) => (
            <tr key={method} className="border-t border-line">
              <td className="px-4 py-3 font-medium">{payLabel(method, t)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{methods[method].count}</td>
              <td className="px-4 py-3 text-right tabular-nums text-mint">{formatRupiah(methods[method].amount, locale)}</td>
            </tr>
          ))}
          <tr className="border-t border-line">
            <td className="px-4 py-3">{t('change')}</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(change, locale)}</td>
          </tr>
          <tr className="border-t border-line font-semibold">
            <td className="px-4 py-3">{t('posSettlementNetCash')}</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-right tabular-nums text-mint">{formatRupiah(cashNet, locale)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function PrintTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={header} className={index === 0 ? 'text-left' : 'text-right'}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className={cellIndex === 0 ? 'text-left' : 'text-right tabular-nums'}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr>
            <td colSpan={headers.length} className="py-4 text-center text-slate-500">
              {empty}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  )
}

function SummaryPrint({
  report,
  locale,
  t,
}: {
  report: SalesReport
  locale: string
  t: (key: MsgKey) => string
}) {
  return (
    <div className="space-y-2 text-[12px]">
      <PrintRow label={t('cardTx')} value={String(report.sales_count ?? 0)} />
      <PrintRow label={t('cardItems')} value={String(report.items_sold ?? 0)} />
      <PrintRow label={t('cardRevenue')} value={formatRupiah(report.revenue ?? 0, locale)} />
      <PrintRow label={t('receiptDiscount')} value={formatRupiah(report.discount ?? 0, locale)} />
      <PrintRow label={t('receiptTax')} value={formatRupiah(report.tax ?? 0, locale)} />
      <PrintRow label={t('cardAvg')} value={formatRupiah(report.average_ticket ?? 0, locale)} />
      <PrintRow label={t('posSettlementCancelled')} value={String(report.cancelled_count ?? 0)} />
      <PrintRow label={t('posSettlementNetCash')} value={formatRupiah(report.cash_net ?? 0, locale)} />
    </div>
  )
}

function MethodsPrint({
  methods,
  change,
  cashNet,
  locale,
  t,
}: {
  methods: NonNullable<SalesReport['payment_methods']>
  change: number
  cashNet: number
  locale: string
  t: (key: MsgKey) => string
}) {
  return (
    <div className="space-y-2 text-[12px]">
      {(['cash', 'transfer', 'qris'] as const).map((method) => (
        <PrintRow
          key={method}
          label={`${payLabel(method, t)} (${methods[method].count})`}
          value={formatRupiah(methods[method].amount, locale)}
        />
      ))}
      <PrintRow label={t('change')} value={formatRupiah(change, locale)} />
      <PrintRow label={t('posSettlementNetCash')} value={formatRupiah(cashNet, locale)} />
    </div>
  )
}

function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function EngineeringPrint({
  categories,
  grandTotal,
  locale,
  t,
}: {
  categories: NonNullable<SalesReport['categories']>
  grandTotal: NonNullable<SalesReport['grand_total']>
  locale: string
  t: (key: MsgKey) => string
}) {
  const rows: string[][] = []
  for (const category of categories) {
    for (const product of category.products) {
      rows.push([
        `${category.category_name} › ${product.name}`,
        String(product.qty),
        formatRupiah(product.discount, locale),
        formatRupiah(product.revenue, locale),
      ])
    }
    rows.push([
      `${t('salesReportEngineeringSubtotal')}: ${category.category_name}`,
      String(category.qty),
      formatRupiah(category.discount, locale),
      formatRupiah(category.revenue, locale),
    ])
  }
  rows.push([
    t('salesReportGrandTotal'),
    String(grandTotal.qty),
    formatRupiah(grandTotal.discount, locale),
    formatRupiah(grandTotal.revenue, locale),
  ])

  return (
    <PrintTable
      headers={[t('category'), t('posColQty'), t('receiptDiscount'), t('cardRevenue')]}
      rows={rows}
      empty={t('salesReportEmpty')}
    />
  )
}
