import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import { logMasterForm } from '../api/activity'
import type { ApiOk, GlAccount } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { useI18n, type MsgKey } from '../i18n'
import { useAccess } from '../access'

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const

export default function GlAccounts() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(50)
  const [items, setItems] = useState<GlAccount[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<(typeof ACCOUNT_TYPES)[number]>('asset')
  const [editing, setEditing] = useState<GlAccount | null>(null)
  const [viewing, setViewing] = useState<GlAccount | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')

  const typeOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      ...ACCOUNT_TYPES.map((type) => ({ value: type, label: typeLabel(t, type) })),
    ],
    [t],
  )

  async function load() {
    try {
      const { data } = await api.get<ApiOk<GlAccount[]>>('/gl-accounts', {
        params: {
          search: list.search || undefined,
          status: list.status,
          account_type: typeFilter !== 'all' ? typeFilter : undefined,
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
    const handle = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage, typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditing(null)
    setCode('')
    setName('')
    setAccountType('asset')
    setError('')
    setOpen(true)
    logMasterForm('glaccount', 'create')
  }

  function openEdit(item: GlAccount) {
    setEditing(item)
    setCode(item.code)
    setName(item.name)
    setAccountType(item.account_type as (typeof ACCOUNT_TYPES)[number])
    setError('')
    setOpen(true)
    logMasterForm('glaccount', 'edit', item.code)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { code, name, account_type: accountType }
      if (editing) await api.put(`/gl-accounts/${editing.id}`, payload)
      else await api.post('/gl-accounts', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: GlAccount) {
    if (item.is_system) return
    const ok = await feedback.confirm({
      title: t('glAccountDeleteTitle'),
      message: t('deleteConfirm', { name: item.code }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/gl-accounts/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  const canEdit = can('glaccounts', 'edit')
  const canCreate = can('glaccounts', 'create')
  const canDelete = can('glaccounts', 'delete')

  return (
    <div>
      <PageHeader
        eyebrow={t('appMaster')}
        title={t('glAccountsTitle')}
        subtitle={t('glAccountsSubtitle')}
        actions={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('glAccountAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('glAccountSearch')}
        extra={
          <select className="field !mt-0 w-auto min-w-[10rem]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="glass overflow-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('glAccountCode')}</th>
              <th className="px-4 py-3">{t('name')}</th>
              <th className="px-4 py-3">{t('glAccountType')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">{item.code}</td>
                <td className="px-4 py-3">
                  <MasterNameButton label={item.name} onClick={() => setViewing(item)} />
                </td>
                <td className="px-4 py-3">{typeLabel(t, item.account_type)}</td>
                <td className="px-4 py-3">{item.is_active ? t('active') : t('inactive')}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {canEdit ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => openEdit(item)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {canDelete && !item.is_system ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void remove(item)}>
                        {t('delete')}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal open={open} title={editing ? t('glAccountEdit') : t('glAccountAdd')} onClose={() => setOpen(false)} onSubmit={onSubmit} saving={saving} error={error}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-muted">
            {t('glAccountCode')}
            <input className="field" value={code} onChange={(e) => setCode(e.target.value)} required disabled={Boolean(editing?.is_system)} />
          </label>
          <label className="text-sm text-muted">
            {t('glAccountType')}
            <select className="field" value={accountType} onChange={(e) => setAccountType(e.target.value as (typeof ACCOUNT_TYPES)[number])}>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(t, type)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted sm:col-span-2">
            {t('name')}
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </div>
      </MasterModal>

      <MasterViewModal open={Boolean(viewing)} title={t('viewRecord')} onClose={() => setViewing(null)}>
        <ViewField label={t('glAccountCode')} value={viewing?.code} />
        <ViewField label={t('name')} value={viewing?.name} />
        <ViewField label={t('glAccountType')} value={viewing ? typeLabel(t, viewing.account_type) : undefined} />
        <ViewField label={t('status')} value={viewing?.is_active ? t('active') : t('inactive')} />
      </MasterViewModal>
    </div>
  )
}

function typeLabel(t: (key: MsgKey) => string, type: string) {
  const map: Record<string, MsgKey> = {
    asset: 'glAccountTypeAsset',
    liability: 'glAccountTypeLiability',
    equity: 'glAccountTypeEquity',
    revenue: 'glAccountTypeRevenue',
    expense: 'glAccountTypeExpense',
  }
  return t(map[type] ?? 'glAccountTypeAsset')
}
