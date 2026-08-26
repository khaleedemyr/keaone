import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Outlet } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useI18n } from '../../i18n'
import { useAccess } from '../../access'

export default function AdminOutlets() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<Outlet[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [editing, setEditing] = useState<Outlet | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<Outlet[]>>('/outlets', {
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) await api.put(`/outlets/${editing.id}`, { name, address: address || null })
      else await api.post('/outlets', { name, address: address || null })
      setName('')
      setAddress('')
      setEditing(null)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function makeDefault(item: Outlet) {
    try {
      await api.put(`/outlets/${item.id}`, { is_default: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function remove(item: Outlet) {
    const ok = await feedback.confirm({
      title: t('deleteOutletTitle'),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/outlets/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: Outlet) {
    try {
      await api.put(`/outlets/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('appAdmin')} title={t('navOutlets')} subtitle={t('outletsSubtitle')} />
      {(can('outlets', 'create') || editing) ? (
      <form onSubmit={(e) => void onSubmit(e)} className="mb-4 flex flex-wrap gap-2">
        <input required className="field !mt-0 max-w-xs" placeholder={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field !mt-0 max-w-xs" placeholder={t('address')} value={address} onChange={(e) => setAddress(e.target.value)} />
        <button type="submit" disabled={saving} className="btn-primary">
          {editing ? t('save') : t('addOutlet')}
        </button>
        {editing ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setEditing(null)
              setName('')
              setAddress('')
            }}
          >
            {t('cancel')}
          </button>
        ) : null}
      </form>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}

      <MasterFilters {...list.filters} searchPlaceholder={t('searchOutlet')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('address')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3">
                  <span className="font-medium">{item.name}</span>
                  {item.is_default ? (
                    <span className="ml-2 rounded-full bg-mint/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-mint">
                      {t('defaultOutlet')}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">{item.address ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className={item.is_active !== false ? 'text-mint' : 'text-rose-300'}>
                    {item.is_active !== false ? t('active') : t('inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {!item.is_default && item.is_active !== false && can('outlets', 'edit') ? (
                    <button type="button" className="mr-3 text-xs text-mint" onClick={() => void makeDefault(item)}>
                      {t('setDefault')}
                    </button>
                  ) : null}
                  {can('outlets', 'edit') ? (
                  <button
                    type="button"
                    className="mr-3 text-mint"
                    onClick={() => {
                      setEditing(item)
                      setName(item.name)
                      setAddress(item.address ?? '')
                    }}
                  >
                    {t('edit')}
                  </button>
                  ) : null}
                  {item.is_active !== false && can('outlets', 'delete') ? (
                  <button type="button" className="text-rose-300" onClick={() => void remove(item)}>
                    {t('delete')}
                  </button>
                  ) : null}
                  {item.is_active === false && can('outlets', 'edit') ? (
                  <button type="button" className="text-mint" onClick={() => void activate(item)}>
                    {t('activate')}
                  </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={4}>
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
