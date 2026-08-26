import { useEffect, useState } from 'react'
import { api, apiMessage } from '../api/client'
import { formatRupiah } from '../lib/money'
import type { ApiOk, TodayReport } from '../types'
import { PageEnter, TiltCard } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { useI18n } from '../i18n'

export default function Dashboard() {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [report, setReport] = useState<TodayReport | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void api
      .get<ApiOk<TodayReport>>('/reports/today')
      .then(({ data }) => {
        setReport(data.data)
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        feedback.error(apiMessage(err, t('loadFailed')))
      })
  }, [feedback, t])

  if (!report) {
    return (
      <PageEnter>
        <PageHeader eyebrow={t('dashEyebrow')} title={t('dashTitle')} subtitle={t('dashSubtitle')} />
        <div className="text-muted">{failed ? t('loadFailed') : null}</div>
      </PageEnter>
    )
  }

  const maxPay = Math.max(
    report.payment_methods.cash,
    report.payment_methods.transfer,
    report.payment_methods.qris,
    1,
  )

  const cards = [
    { label: t('cardTx'), value: String(report.sales_count), hint: t('cardTxHint'), tone: 'from-mint/20' },
    { label: t('cardRevenue'), value: formatRupiah(report.revenue, locale), hint: t('cardRevenueHint'), tone: 'from-violet/20' },
    { label: t('cardItems'), value: String(report.items_sold), hint: t('cardItemsHint'), tone: 'from-cyan-400/20' },
    { label: t('cardAvg'), value: formatRupiah(report.average_ticket, locale), hint: t('cardAvgHint'), tone: 'from-gold/20' },
  ]

  const methods = [
    { id: 'cash' as const, label: t('cash') },
    { id: 'transfer' as const, label: t('transfer') },
    { id: 'qris' as const, label: t('qris') },
  ]

  return (
    <PageEnter>
      <PageHeader
        eyebrow={t('dashEyebrow')}
        title={t('dashTitle')}
        subtitle={`${t('dashSubtitle')} ${report.date}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <TiltCard key={card.label}>
            <div className={`glass relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 ${card.tone} to-transparent`}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{card.label}</div>
              <div className="mt-3 font-display text-2xl font-bold text-fg">{card.value}</div>
              <div className="mt-2 text-xs text-muted">{card.hint}</div>
            </div>
          </TiltCard>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass rounded-3xl p-5">
          <div className="mb-4 text-sm font-medium text-fg">{t('paymentFlow')}</div>
          {methods.map((method) => {
            const value = report.payment_methods[method.id]
            const width = Math.round((value / maxPay) * 100)
            return (
              <div key={method.id} className="mb-4">
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span className="uppercase tracking-wider">{method.label}</span>
                  <span>{formatRupiah(value, locale)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-fill">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mint to-violet transition-all duration-700"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <TiltCard>
          <div className="glass flex h-full flex-col justify-between rounded-3xl p-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-mint/80">{t('cashIn')}</div>
              <div className="mt-2 font-display text-3xl font-bold">{formatRupiah(report.paid, locale)}</div>
            </div>
            <p className="text-sm text-muted">{t('cashInHint')}</p>
          </div>
        </TiltCard>
      </div>
    </PageEnter>
  )
}
