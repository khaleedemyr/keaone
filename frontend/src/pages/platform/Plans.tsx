import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Modules, Plan } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { formatRupiah } from '../../lib/money'
import { useI18n } from '../../i18n'
import { usePlatformAccess } from '../../platform/access'
import { DEFAULT_MODULES, MODULE_KEYS, MODULE_LABELS } from '../../lib/modules'

const empty = {
  slug: '',
  name: '',
  price_monthly: '149000',
  price_yearly: '1490000',
  trial_days: '14',
  max_users: '3',
  max_outlets: '1',
  is_default: false,
  is_active: true,
}

export default function PlatformPlans() {
  const { t, locale } = useI18n()
  const { canManage } = usePlatformAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<Plan[]>([])
  const [form, setForm] = useState(empty)
  const [modules, setModules] = useState<Modules>({ ...DEFAULT_MODULES })
  const [editing, setEditing] = useState<Plan | null>(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      const { data } = await api.get<ApiOk<Plan[]>>('/platform/plans', {
        params: {
          search: list.search || undefined,
          status: list.status,
          page: list.page,
          per_page: list.perPage,
        },
      })
      setItems(data.data)
      list.applyMeta(data.meta, data.data.length)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage])

  function resetForm() {
    setEditing(null)
    setForm(empty)
    setModules({ ...DEFAULT_MODULES })
    setError('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const payload = {
      slug: form.slug,
      name: form.name,
      price_monthly: Number(form.price_monthly),
      price_yearly: Number(form.price_yearly),
      trial_days: Number(form.trial_days),
      max_users: form.max_users ? Number(form.max_users) : null,
      max_outlets: form.max_outlets ? Number(form.max_outlets) : null,
      is_default: form.is_default,
      is_active: form.is_active,
      modules,
    }
    try {
      if (editing) await api.put(`/platform/plans/${editing.id}`, payload)
      else await api.post('/platform/plans', payload)
      resetForm()
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('platformEyebrow')} title={t('navPlans')} subtitle={t('plansLead')} />
      {canManage ? (
        <form onSubmit={(e) => void onSubmit(e)} className="glass mb-4 grid gap-2 rounded-3xl p-4 sm:grid-cols-2">
          {error ? (
            <div className="sm:col-span-2">
              <FormAlert>{error}</FormAlert>
            </div>
          ) : null}
          <input
            required
            className="field !mt-0"
            placeholder={t('name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            required
            className="field !mt-0"
            placeholder="slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            disabled={Boolean(editing)}
          />
          <input
            required
            className="field !mt-0"
            placeholder={t('priceMonthly')}
            value={form.price_monthly}
            onChange={(e) => setForm({ ...form, price_monthly: e.target.value })}
          />
          <input
            required
            className="field !mt-0"
            placeholder={t('priceYearly')}
            value={form.price_yearly}
            onChange={(e) => setForm({ ...form, price_yearly: e.target.value })}
          />
          <input
            className="field !mt-0"
            placeholder={t('trialDays')}
            value={form.trial_days}
            onChange={(e) => setForm({ ...form, trial_days: e.target.value })}
          />
          <input
            className="field !mt-0"
            placeholder={t('maxUsersHint')}
            value={form.max_users}
            onChange={(e) => setForm({ ...form, max_users: e.target.value })}
          />
          <input
            className="field !mt-0"
            placeholder={t('maxOutletsHint')}
            value={form.max_outlets}
            onChange={(e) => setForm({ ...form, max_outlets: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            />
            {t('defaultPlan')}
          </label>
          <div className="sm:col-span-2 grid gap-2 rounded-2xl border border-line bg-fill/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('navModules')}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULE_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={Boolean(modules[key])}
                    onChange={(e) => setModules((current) => ({ ...current, [key]: e.target.checked }))}
                  />
                  {t(MODULE_LABELS[key])}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">
              {editing ? t('save') : t('addPlan')}
            </button>
            {editing ? (
              <button type="button" className="btn-ghost" onClick={resetForm}>
                {t('cancel')}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <MasterFilters {...list.filters} searchPlaceholder={t('searchPlan')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('monthly')}</th>
              <th className="px-4 py-3 font-medium">{t('yearly')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="px-4 py-3">
                  {item.name}
                  {item.is_default ? <span className="ml-2 text-[10px] uppercase text-mint">{t('defaultPlan')}</span> : null}
                </td>
                <td className="px-4 py-3">{formatRupiah(item.price_monthly, locale)}</td>
                <td className="px-4 py-3">{formatRupiah(item.price_yearly, locale)}</td>
                <td className="px-4 py-3">
                  <span className={item.is_active ? 'text-mint' : 'text-rose-300'}>
                    {item.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="mr-3 text-mint"
                        onClick={() => {
                          setEditing(item)
                          setForm({
                            slug: item.slug,
                            name: item.name,
                            price_monthly: String(item.price_monthly),
                            price_yearly: String(item.price_yearly),
                            trial_days: String(item.trial_days),
                            max_users: item.max_users ? String(item.max_users) : '',
                            max_outlets: item.max_outlets ? String(item.max_outlets) : '',
                            is_default: item.is_default,
                            is_active: item.is_active,
                          })
                          setModules({ ...DEFAULT_MODULES, ...(item.modules ?? {}) })
                          setError('')
                        }}
                      >
                        {t('edit')}
                      </button>
                      {item.is_active ? (
                        <button
                          type="button"
                          className="text-rose-300"
                          onClick={() =>
                            void api
                              .put(`/platform/plans/${item.id}`, { is_active: false })
                              .then(() => load())
                              .then(() => feedback.success(t('deleted')))
                              .catch((err) => feedback.error(apiMessage(err, t('saveFailed'))))
                          }
                        >
                          {t('delete')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-mint"
                          onClick={() =>
                            void api
                              .put(`/platform/plans/${item.id}`, { is_active: true })
                              .then(() => load())
                              .then(() => feedback.success(t('saved')))
                              .catch((err) => feedback.error(apiMessage(err, t('saveFailed'))))
                          }
                        >
                          {t('activate')}
                        </button>
                      )}
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
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
