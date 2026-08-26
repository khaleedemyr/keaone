import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, apiMessage } from '../../api/client'
import { useAuth } from '../../auth'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useI18n } from '../../i18n'
import type { ApiOk, Plan, PlatformCompany } from '../../types'
import { usePlatformAccess } from '../../platform/access'

export default function PlatformCompanies() {
  const { t } = useI18n()
  const { switchCompany } = useAuth()
  const { canManage } = usePlatformAccess()
  const feedback = useFeedback()
  const navigate = useNavigate()
  const list = useListQuery()
  const [items, setItems] = useState<PlatformCompany[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [companies, planRes] = await Promise.all([
        api.get<ApiOk<PlatformCompany[]>>('/platform/companies', {
          params: {
            search: list.search || undefined,
            status: list.status,
            page: list.page,
            per_page: list.perPage,
          },
        }),
        api.get<ApiOk<Plan[]>>('/platform/plans', { params: { for_select: 1, status: 'all' } }),
      ])
      setItems(companies.data.data)
      list.applyMeta(companies.data.meta, companies.data.data.length)
      setPlans(planRes.data.data)
      setError('')
    } catch (err) {
      setError(apiMessage(err, t('loadFailed')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage])

  async function enter(company: PlatformCompany) {
    try {
      await switchCompany(company.id)
      navigate('/', { replace: true })
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function setStatus(company: PlatformCompany, status: 'active' | 'suspended') {
    const ok = await feedback.confirm({
      title: status === 'suspended' ? t('suspendTitle') : t('activateTitle'),
      message: t('statusConfirm', { name: company.name }),
      confirmLabel: status === 'suspended' ? t('suspend') : t('activate'),
      tone: status === 'suspended' ? 'danger' : 'default',
    })
    if (!ok) return
    try {
      await api.put(`/platform/companies/${company.id}`, { status })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function changePlan(company: PlatformCompany, planId: string) {
    if (!planId) return
    try {
      await api.put(`/platform/companies/${company.id}`, { plan_id: Number(planId), activate_billing: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function issue(company: PlatformCompany) {
    try {
      await api.post(`/platform/companies/${company.id}/invoices`)
      await load()
      feedback.success(t('invoiceIssued'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('platformEyebrow')} title={t('platformTitle')} subtitle={t('platformLead')} />
      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('searchCompany')}
        statusOptions={[
          { value: 'all', label: t('filterAll') },
          { value: 'active', label: t('active') },
          { value: 'suspended', label: t('suspended') },
        ]}
      />
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('navCompany')}</th>
              <th className="px-4 py-3 font-medium">{t('navBilling')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium">{t('members')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? null : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-line hover:bg-fill">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted">{item.business_type_name ?? item.business_type}</div>
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        className="field !mt-0 !py-1.5 !text-xs"
                        value={item.billing?.plan?.id ?? ''}
                        onChange={(e) => void changePlan(item, e.target.value)}
                      >
                        <option value="">{t('currentPlan')}</option>
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm">{item.billing?.plan?.name ?? '-'}</div>
                    )}
                    <div className="mt-1 text-[11px] text-muted">
                      {item.billing?.status === 'trialing'
                        ? t('trialing')
                        : item.billing?.status === 'past_due'
                          ? t('pastDue')
                          : item.billing?.status === 'active'
                            ? t('active')
                            : item.billing?.status ?? '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={item.status === 'active' ? 'text-mint' : 'text-rose-300'}>
                      {item.status === 'active' ? t('active') : t('suspended')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.users_count} · {item.outlets_count} {t('navOutlets').toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="mr-3 text-mint" onClick={() => void enter(item)}>
                      {t('enterTenant')}
                    </button>
                    {canManage ? (
                      <>
                        <button type="button" className="mr-3 text-xs text-muted" onClick={() => void issue(item)}>
                          {t('issueInvoice')}
                        </button>
                        {item.status === 'active' ? (
                          <button type="button" className="text-rose-300" onClick={() => void setStatus(item, 'suspended')}>
                            {t('suspend')}
                          </button>
                        ) : (
                          <button type="button" className="text-mint" onClick={() => void setStatus(item, 'active')}>
                            {t('activate')}
                          </button>
                        )}
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
            {!loading && items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={5}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />
    </div>
  )
}
