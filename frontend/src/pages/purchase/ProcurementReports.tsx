import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { formatDate, formatRupiah } from '../../lib/money'
import type { ApiOk, ProcurementReport, ProcurementReportKind } from '../../types'
import { PageEnter } from '../../components/motion'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useI18n, type MsgKey } from '../../i18n'

const REPORT_TABS: { kind: ProcurementReportKind; label: MsgKey }[] = [
  { kind: 'spend', label: 'procurementReportSpend' },
  { kind: 'cycle_time', label: 'procurementReportCycleTime' },
  { kind: 'vendor_performance', label: 'procurementReportVendorPerformance' },
  { kind: 'budget_actual', label: 'procurementReportBudgetActual' },
  { kind: 'open_po_aging', label: 'procurementReportOpenPoAging' },
  { kind: 'price_variance', label: 'procurementReportPriceVariance' },
  { kind: 'abc', label: 'procurementReportAbc' },
]

function localIso(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

function share(part: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

export default function ProcurementReports() {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const today = localIso()
  const [kind, setKind] = useState<ProcurementReportKind>('spend')
  const [from, setFrom] = useState(monthStart(today))
  const [to, setTo] = useState(today)
  const [groupBy, setGroupBy] = useState<'supplier' | 'category' | 'department' | 'product'>('supplier')
  const [report, setReport] = useState<ProcurementReport | null>(null)

  const needsDateRange = kind !== 'open_po_aging'
  const spendGroupOptions = kind === 'abc'
    ? (['supplier', 'product'] as const)
    : (['supplier', 'category', 'department'] as const)

  useEffect(() => {
    setReport(null)
    const handle = window.setTimeout(() => {
      void api
        .get<ApiOk<ProcurementReport>>('/procurement/reports', {
          params: {
            kind,
            ...(needsDateRange ? { from, to } : {}),
            ...((kind === 'spend' || kind === 'abc') ? { group_by: groupBy } : {}),
          },
        })
        .then(({ data }) => setReport(data.data))
        .catch((err) => {
          setReport(null)
          feedback.error(apiMessage(err, t('procurementReportFailed')))
        })
    }, 150)
    return () => window.clearTimeout(handle)
  }, [kind, from, to, groupBy, needsDateRange, feedback, t])

  const title = REPORT_TABS.find((tab) => tab.kind === kind)?.label ?? 'procurementReportsTitle'

  const totalSpend = useMemo(() => {
    if (report?.total != null) return report.total
    return report?.rows?.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) ?? 0
  }, [report])

  function applyPreset(preset: 'today' | 'month') {
    const now = localIso()
    if (preset === 'today') {
      setFrom(now)
      setTo(now)
      return
    }
    setFrom(monthStart(now))
    setTo(now)
  }

  return (
    <PageEnter>
      <PageHeader
        eyebrow={t('appProcurement')}
        title={t('procurementReportsTitle')}
        subtitle={t('procurementReportsSubtitle')}
      />

      <div className="mb-4 flex flex-wrap gap-1">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            className={kind === tab.kind ? 'btn btn-primary !px-3 !py-1.5 !text-xs' : 'btn-ghost !px-3 !py-1.5 !text-xs'}
            onClick={() => setKind(tab.kind)}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-fg">{t(title)}</h3>

        {needsDateRange ? (
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">
              {t('salesReportFrom')}
              <input type="date" className="field mt-1 py-2" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              {t('salesReportTo')}
              <input type="date" className="field mt-1 py-2" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button type="button" className="btn-ghost !text-xs" onClick={() => applyPreset('today')}>
              {t('salesReportToday')}
            </button>
            <button type="button" className="btn-ghost !text-xs" onClick={() => applyPreset('month')}>
              {t('salesReportMonth')}
            </button>
          </div>
        ) : null}

        {(kind === 'spend' || kind === 'abc') ? (
          <div className="mb-4 flex flex-wrap gap-1">
            {spendGroupOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={groupBy === option ? 'btn btn-primary !px-3 !py-1.5 !text-xs' : 'btn-ghost !px-3 !py-1.5 !text-xs'}
                onClick={() => setGroupBy(option)}
              >
                {t(
                  option === 'supplier'
                    ? 'procurementReportGroupSupplier'
                    : option === 'category'
                      ? 'procurementReportGroupCategory'
                      : option === 'department'
                        ? 'procurementReportGroupDepartment'
                        : 'procurementReportGroupProduct',
                )}
              </button>
            ))}
          </div>
        ) : null}

        {!report ? (
          <div className="py-8 text-center text-sm text-muted">{t('loading')}</div>
        ) : report.rows?.length === 0 && !report.buckets?.length ? (
          <div className="py-8 text-center text-sm text-muted">{t('emptyList')}</div>
        ) : (
          <>
            {kind === 'spend' || kind === 'abc' ? (
              <p className="mb-3 text-sm text-muted">
                {t('procurementReportTotalSpend')}: <span className="font-semibold tabular-nums text-fg">{formatRupiah(totalSpend, locale)}</span>
                {needsDateRange ? ` · ${formatDate(from, locale)} — ${formatDate(to, locale)}` : null}
              </p>
            ) : null}

            {kind === 'cycle_time' && report.summary ? (
              <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['procurementReportAvgPrToPo', report.summary.avg_pr_to_po_days],
                  ['procurementReportAvgPoToGr', report.summary.avg_po_to_gr_days],
                  ['procurementReportAvgGrToInvoice', report.summary.avg_gr_to_invoice_days],
                  ['procurementReportAvgTotalCycle', report.summary.avg_total_days],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-border/60 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted">{t(label as MsgKey)}</div>
                    <div className="text-lg font-semibold tabular-nums">{value != null ? `${value} ${t('procurementReportDays')}` : '—'}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {kind === 'open_po_aging' && report.buckets ? (
              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                {report.buckets.map((bucket) => (
                  <div key={bucket.label} className="rounded-lg border border-border/60 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted">{bucket.label} {t('procurementReportDays')}</div>
                    <div className="text-lg font-semibold tabular-nums">{bucket.count} PO</div>
                    <div className="text-xs text-muted tabular-nums">{formatRupiah(bucket.total, locale)}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {kind === 'budget_actual' && report.budget ? (
              <p className="mb-3 text-sm text-muted">
                {report.budget.name} · {report.budget.fiscal_year}
                {report.totals ? (
                  <>
                    {' '}
                    · {t('procurementReportAllocated')}: {formatRupiah(report.totals.allocated, locale)}
                    {' '}
                    · {t('procurementReportActual')}: {formatRupiah(report.totals.actual, locale)}
                  </>
                ) : null}
              </p>
            ) : null}

            {kind === 'price_variance' && report.summary ? (
              <p className="mb-3 text-sm text-muted">
                {t('procurementReportVarianceRows')}: {report.summary.row_count}
                {report.summary.avg_variance_percent != null ? ` · ${t('procurementReportAvgVariance')}: ${report.summary.avg_variance_percent}%` : null}
              </p>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    {kind === 'spend' || kind === 'abc' ? (
                      <>
                        {kind === 'abc' ? <th className="px-3 py-2">#</th> : null}
                        <th className="px-3 py-2">{t('name')}</th>
                        <th className="px-3 py-2">{t('procurementReportAmount')}</th>
                        <th className="px-3 py-2">{t('procurementReportShare')}</th>
                        {kind === 'abc' ? (
                          <>
                            <th className="px-3 py-2">{t('procurementReportCumulative')}</th>
                            <th className="px-3 py-2">ABC</th>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {kind === 'cycle_time' ? (
                      <>
                        <th className="px-3 py-2">PO</th>
                        <th className="px-3 py-2">{t('supplier')}</th>
                        <th className="px-3 py-2">PR→PO</th>
                        <th className="px-3 py-2">PO→GR</th>
                        <th className="px-3 py-2">GR→Inv</th>
                        <th className="px-3 py-2">{t('procurementReportTotal')}</th>
                      </>
                    ) : null}
                    {kind === 'vendor_performance' ? (
                      <>
                        <th className="px-3 py-2">{t('supplier')}</th>
                        <th className="px-3 py-2">PO</th>
                        <th className="px-3 py-2">{t('procurementReportOnTime')}</th>
                        <th className="px-3 py-2">{t('procurementReportQuality')}</th>
                        <th className="px-3 py-2">{t('procurementReportOverall')}</th>
                        <th className="px-3 py-2">{t('procurementReportPriceVariance')}</th>
                      </>
                    ) : null}
                    {kind === 'budget_actual' ? (
                      <>
                        <th className="px-3 py-2">{t('navDepartments')}</th>
                        <th className="px-3 py-2">{t('navOutlets')}</th>
                        <th className="px-3 py-2">{t('procurementReportAllocated')}</th>
                        <th className="px-3 py-2">{t('procurementReportCommitted')}</th>
                        <th className="px-3 py-2">{t('procurementReportActual')}</th>
                        <th className="px-3 py-2">{t('procurementReportVariance')}</th>
                      </>
                    ) : null}
                    {kind === 'open_po_aging' ? (
                      <>
                        <th className="px-3 py-2">PO</th>
                        <th className="px-3 py-2">{t('supplier')}</th>
                        <th className="px-3 py-2">{t('procurementReportOrderedAt')}</th>
                        <th className="px-3 py-2">{t('procurementReportAge')}</th>
                        <th className="px-3 py-2">{t('procurementReportAmount')}</th>
                        <th className="px-3 py-2">{t('status')}</th>
                      </>
                    ) : null}
                    {kind === 'price_variance' ? (
                      <>
                        <th className="px-3 py-2">{t('supplier')}</th>
                        <th className="px-3 py-2">{t('product')}</th>
                        <th className="px-3 py-2">PO</th>
                        <th className="px-3 py-2">GR</th>
                        <th className="px-3 py-2">{t('procurementReportVariance')}</th>
                        <th className="px-3 py-2">{t('procurementReportSource')}</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {(report.rows ?? []).map((row, index) => (
                    <tr key={`${kind}-${index}`} className="border-b border-border/60">
                      {kind === 'spend' ? (
                        <>
                          <td className="px-3 py-2">{row.name ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{formatRupiah(row.amount ?? 0, locale)}</td>
                          <td className="px-3 py-2 tabular-nums">{row.share_percent != null ? `${row.share_percent}%` : share(row.amount ?? 0, totalSpend)}</td>
                        </>
                      ) : null}
                      {kind === 'abc' ? (
                        <>
                          <td className="px-3 py-2 tabular-nums">{row.rank}</td>
                          <td className="px-3 py-2">{row.name ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{formatRupiah(row.amount ?? 0, locale)}</td>
                          <td className="px-3 py-2 tabular-nums">{row.share_percent != null ? `${row.share_percent}%` : '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.cumulative_percent != null ? `${row.cumulative_percent}%` : '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${row.class === 'A' ? 'bg-mint/20 text-mint' : row.class === 'B' ? 'bg-amber-500/20 text-amber-400' : 'bg-muted/20 text-muted'}`}>
                              {row.class}
                            </span>
                          </td>
                        </>
                      ) : null}
                      {kind === 'cycle_time' ? (
                        <>
                          <td className="px-3 py-2">{row.po_number ?? '—'}</td>
                          <td className="px-3 py-2">{row.supplier_name ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.pr_to_po_days ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.po_to_gr_days ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.gr_to_invoice_days ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.total_days ?? '—'}</td>
                        </>
                      ) : null}
                      {kind === 'vendor_performance' ? (
                        <>
                          <td className="px-3 py-2">{row.name ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.order_count ?? 0}</td>
                          <td className="px-3 py-2 tabular-nums">{row.on_time_percent != null ? `${row.on_time_percent}%` : '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.quality_score != null ? `${row.quality_score}%` : '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.overall_score != null ? `${row.overall_score}%` : '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.avg_price_variance_percent != null ? `${row.avg_price_variance_percent}%` : '—'}</td>
                        </>
                      ) : null}
                      {kind === 'budget_actual' ? (
                        <>
                          <td className="px-3 py-2">{row.department_name ?? '—'}</td>
                          <td className="px-3 py-2">{row.outlet_name ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{formatRupiah(row.allocated ?? 0, locale)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatRupiah(row.committed ?? 0, locale)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatRupiah(row.actual ?? 0, locale)}</td>
                          <td className={`px-3 py-2 tabular-nums ${(row.variance ?? 0) > 0 ? 'text-danger' : 'text-mint'}`}>
                            {formatRupiah(row.variance ?? 0, locale)}
                          </td>
                        </>
                      ) : null}
                      {kind === 'open_po_aging' ? (
                        <>
                          <td className="px-3 py-2">{row.po_number ?? '—'}</td>
                          <td className="px-3 py-2">{row.supplier_name ?? '—'}</td>
                          <td className="px-3 py-2">{row.ordered_at ? formatDate(row.ordered_at, locale) : '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.age_days ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{formatRupiah(row.total ?? 0, locale)}</td>
                          <td className="px-3 py-2">{row.status ?? '—'}</td>
                        </>
                      ) : null}
                      {kind === 'price_variance' ? (
                        <>
                          <td className="px-3 py-2">{row.supplier_name ?? '—'}</td>
                          <td className="px-3 py-2">{row.product_name ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.po_unit_cost != null ? formatRupiah(row.po_unit_cost, locale) : '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.gr_unit_cost != null ? formatRupiah(row.gr_unit_cost, locale) : '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{row.variance_percent != null ? `${row.variance_percent}%` : '—'}</td>
                          <td className="px-3 py-2">{row.source ?? '—'}</td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {kind === 'spend' && report.trend && report.trend.length > 0 ? (
              <div className="mt-6">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('procurementReportTrend')}</h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {report.trend.map((point) => (
                    <div key={point.period} className="rounded-lg border border-border/60 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted">{point.period}</div>
                      <div className="text-sm font-semibold tabular-nums">{formatRupiah(point.amount, locale)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PageEnter>
  )
}
