import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, PlatformOverview } from '../../types'
import { PageEnter, TiltCard } from '../../components/motion'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { formatRupiah } from '../../lib/money'
import { useI18n } from '../../i18n'

export default function PlatformOverviewPage() {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [data, setData] = useState<PlatformOverview | null>(null)

  useEffect(() => {
    void api
      .get<ApiOk<PlatformOverview>>('/platform/overview')
      .then(({ data: res }) => setData(res.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  return (
    <PageEnter>
      <PageHeader eyebrow={t('platformEyebrow')} title={t('appOverview')} subtitle={t('overviewLead')} />
      {data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label={t('overviewCompanies')} value={String(data.companies)} hint={t('overviewActive') + ': ' + data.active} />
          <Stat label={t('overviewTrial')} value={String(data.trialing)} hint={t('trialing')} />
          <Stat label={t('overviewPastDue')} value={String(data.past_due)} hint={t('pastDue')} />
          <Stat label={t('overviewInvoices')} value={String(data.open_invoices)} hint={t('issued')} />
          <Stat
            label={t('overviewOpenAmount')}
            value={formatRupiah(data.open_amount, locale)}
            hint={t('invoices')}
          />
        </div>
      ) : null}
    </PageEnter>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <TiltCard className="glass rounded-3xl p-5">
      <div className="text-xs uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="font-display mt-2 text-3xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </TiltCard>
  )
}
