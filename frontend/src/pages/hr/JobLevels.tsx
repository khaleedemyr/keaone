import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, JobLevel } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { useI18n } from '../../i18n'
import { useAccess } from '../../access'

export default function JobLevels() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<JobLevel[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [rank, setRank] = useState('0')
  const [sortOrder, setSortOrder] = useState('0')
  const [editing, setEditing] = useState<JobLevel | null>(null)
  const [viewing, setViewing] = useState<JobLevel | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<JobLevel[]>>('/job-levels', {
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

  function openCreate() {
    setEditing(null)
    setName('')
    setCode('')
    setRank('0')
    setSortOrder('0')
    setError('')
    setOpen(true)
    logMasterForm('joblevel', 'create')
  }

  function openEdit(item: JobLevel) {
    setEditing(item)
    setName(item.name)
    setCode(item.code ?? '')
    setRank(String(item.rank ?? 0))
    setSortOrder(String(item.sort_order ?? 0))
    setError('')
    setOpen(true)
    logMasterForm('joblevel', 'edit', item.name)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name,
        code: code || null,
        rank: Number(rank) || 0,
        sort_order: Number(sortOrder) || 0,
      }
      if (editing) await api.put(`/job-levels/${editing.id}`, payload)
      else await api.post('/job-levels', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: JobLevel) {
    const ok = await feedback.confirm({
      title: t('deleteJobLevelTitle'),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/job-levels/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: JobLevel) {
    try {
      await api.put(`/job-levels/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const canEdit = can('joblevels', 'edit')
  const canDelete = can('joblevels', 'delete')
  const showActions = canEdit || canDelete

  return (
    <div>
      <PageHeader
        eyebrow={t('appHr')}
        title={t('navJobLevels')}
        subtitle={t('jobLevelsSubtitle')}
        action={
          can('joblevels', 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('addJobLevel')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('searchJobLevel')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('code')}</th>
              <th className="px-4 py-3 font-medium">{t('rank')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              {showActions ? <th className="px-4 py-3 font-medium"></th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3">
                  <MasterNameButton onClick={() => setViewing(item)}>{item.name}</MasterNameButton>
                </td>
                <td className="px-4 py-3 text-muted">{item.code ?? '-'}</td>
                <td className="px-4 py-3 text-muted">{item.rank}</td>
                <td className="px-4 py-3">
                  <span className={item.is_active ? 'text-mint' : 'text-rose-300'}>
                    {item.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                {showActions ? (
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <button type="button" className="mr-3 text-mint" onClick={() => openEdit(item)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {item.is_active && canDelete ? (
                      <button type="button" className="text-rose-300" onClick={() => void remove(item)}>
                        {t('delete')}
                      </button>
                    ) : null}
                    {!item.is_active && canEdit ? (
                      <button type="button" className="text-mint" onClick={() => void activate(item)}>
                        {t('activate')}
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={showActions ? 5 : 4}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t('editJobLevel') : t('newJobLevel')}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      >
        <label className="text-sm text-muted">
          {t('name')}
          <input required className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          {t('code')}
          <input className="field" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          {t('rank')}
          <input type="number" min={0} className="field" value={rank} onChange={(e) => setRank(e.target.value)} />
          <span className="mt-1 block text-xs">{t('jobLevelRankHint')}</span>
        </label>
        <label className="text-sm text-muted">
          {t('sortOrder')}
          <input
            type="number"
            min={0}
            className="field"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </label>
      </MasterModal>

      <MasterViewModal
        open={Boolean(viewing)}
        title={t('viewRecord')}
        onClose={() => setViewing(null)}
        onEdit={
          viewing && canEdit
            ? () => {
                const item = viewing
                setViewing(null)
                openEdit(item)
              }
            : undefined
        }
      >
        <ViewField label={t('name')} value={viewing?.name} />
        <ViewField label={t('code')} value={viewing?.code} />
        <ViewField label={t('rank')} value={viewing?.rank} />
        <ViewField label={t('sortOrder')} value={viewing?.sort_order} />
        <ViewField label={t('status')} value={viewing?.is_active ? t('active') : t('inactive')} />
      </MasterViewModal>
    </div>
  )
}
