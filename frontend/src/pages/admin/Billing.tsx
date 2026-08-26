import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, BillingInvoice, BillingSnapshot, Plan } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { formatRupiah } from '../../lib/money'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'

export default function AdminBilling() {
  const { t, locale } = useI18n()
  const { refresh } = useAuth()
  const feedback = useFeedback()
  const [billing, setBilling] = useState<BillingSnapshot | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [error, setError] = useState('')
  const [cycle, setCycle] = useState('monthly')

  async function load() {
    try {
      const { data } = await api.get<ApiOk<{ billing: BillingSnapshot; invoices: BillingInvoice[]; plans: Plan[] }>>(
        '/billing',
      )
      setBilling(data.data.billing)
      setInvoices(data.data.invoices)
      setPlans(data.data.plans)
      if (data.data.billing?.billing_cycle) setCycle(data.data.billing.billing_cycle)
      setError('')
    } catch (err) {
      setError(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function choose(plan: Plan) {
    const ok = await feedback.confirm({
      title: t('choosePlanTitle'),
      message: t('choosePlanConfirm', { name: plan.name }),
      confirmLabel: t('choosePlan'),
    })
    if (!ok) return
    try {
      await api.post('/billing/subscribe', { plan_id: plan.id, billing_cycle: cycle })
      await load()
      await refresh()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('appAdmin')} title={t('navBilling')} subtitle={t('billingLead')} />
      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="glass mb-4 max-w-xl rounded-3xl p-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted">{t('currentPlan')}</div>
        <div className="font-display mt-1 text-2xl font-bold">{billing?.plan?.name ?? '-'}</div>
        <div className="mt-1 text-sm text-muted">
          {billingStatus(billing?.status, t)} · {cycleLabel(billing?.billing_cycle, t)}
        </div>
        {billing?.trial_ends_at && billing.status === 'trialing' ? (
          <div className="mt-2 text-sm text-gold">
            {t('trialUntil', { date: new Date(billing.trial_ends_at).toLocaleDateString(locale) })}
          </div>
        ) : null}
        {billing?.current_period_end ? (
          <div className="mt-1 text-xs text-muted">
            {t('periodEnd', { date: new Date(billing.current_period_end).toLocaleDateString(locale) })}
          </div>
        ) : null}
      </div>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className={cycle === 'monthly' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setCycle('monthly')}
        >
          {t('monthly')}
        </button>
        <button
          type="button"
          className={cycle === 'yearly' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setCycle('yearly')}
        >
          {t('yearly')}
        </button>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="glass rounded-3xl p-4">
            <div className="font-display text-lg font-bold">{plan.name}</div>
            <div className="mt-1 text-sm text-mint">
              {formatRupiah(cycle === 'yearly' ? plan.price_yearly : plan.price_monthly, locale)}
              <span className="text-muted">/{cycle === 'yearly' ? t('year') : t('month')}</span>
            </div>
            <div className="mt-2 text-xs text-muted">
              {plan.max_users ? t('maxUsers', { n: String(plan.max_users) }) : t('unlimitedUsers')}
              {' · '}
              {plan.max_outlets ? t('maxOutlets', { n: String(plan.max_outlets) }) : t('unlimitedOutlets')}
            </div>
            <button
              type="button"
              className="btn-ghost mt-3 w-full"
              disabled={billing?.plan?.id === plan.id}
              onClick={() => void choose(plan)}
            >
              {billing?.plan?.id === plan.id ? t('currentPlan') : t('choosePlan')}
            </button>
          </div>
        ))}
      </div>

      <h2 className="mb-2 font-medium">{t('invoices')}</h2>
      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('number')}</th>
              <th className="px-4 py-3 font-medium">{t('total')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium">{t('dueAt')}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={4}>
                  {t('noInvoices')}
                </td>
              </tr>
            ) : (
              invoices.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3">{item.number}</td>
                  <td className="px-4 py-3">{formatRupiah(item.amount, locale)}</td>
                  <td className="px-4 py-3">{invoiceStatus(item.status, t)}</td>
                  <td className="px-4 py-3 text-muted">
                    {item.due_at ? new Date(item.due_at).toLocaleDateString(locale) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function billingStatus(status: string | undefined, t: (key: MsgKey) => string) {
  if (status === 'trialing') return t('trialing')
  if (status === 'active') return t('active')
  if (status === 'past_due') return t('pastDue')
  if (status === 'canceled') return t('canceled')
  return status ?? '-'
}

function cycleLabel(cycle: string | undefined, t: (key: MsgKey) => string) {
  return cycle === 'yearly' ? t('yearly') : t('monthly')
}

function invoiceStatus(status: string, t: (key: MsgKey) => string) {
  if (status === 'issued') return t('issued')
  if (status === 'paid') return t('paid')
  if (status === 'void') return t('void')
  return status
}
