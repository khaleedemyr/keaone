import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import type { ApiOk, ChoiceType } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { useI18n } from '../i18n'
import { useAccess } from '../access'

export default function ChoiceTypes() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<ChoiceType[]>([])
  const [name, setName] = useState('')
  const [required, setRequired] = useState(false)
  const [minSelect, setMinSelect] = useState('0')
  const [maxSelect, setMaxSelect] = useState('1')
  const [editing, setEditing] = useState<ChoiceType | null>(null)
  const [viewing, setViewing] = useState<ChoiceType | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<ChoiceType[]>>('/choice-types', {
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
    setRequired(false)
    setMinSelect('0')
    setMaxSelect('1')
    setError('')
    setOpen(true)
  }

  function openEdit(item: ChoiceType) {
    setEditing(item)
    setName(item.name)
    setRequired(item.is_required)
    setMinSelect(String(item.min_select))
    setMaxSelect(String(item.max_select))
    setError('')
    setOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name,
        is_required: required,
        min_select: Number(minSelect || 0),
        max_select: Number(maxSelect || 0),
      }
      if (editing) await api.put(`/choice-types/${editing.id}`, payload)
      else await api.post('/choice-types', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: ChoiceType) {
    const ok = await feedback.confirm({
      title: t('deleteChoiceTypeTitle'),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/choice-types/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: ChoiceType) {
    try {
      await api.put(`/choice-types/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function ruleLabel(item: ChoiceType) {
    const max = item.max_select === 0 ? t('unlimited') : String(item.max_select)
    return item.is_required
      ? `${t('choiceRequired')} · ${item.min_select}–${max}`
      : `${t('choiceOptional')} · ${t('maxSelect')} ${max}`
  }

  const canEdit = can('choicetypes', 'edit')
  const canDelete = can('choicetypes', 'delete')
  const showActions = canEdit || canDelete

  return (
    <div>
      <PageHeader
        eyebrow={t('productsEyebrow')}
        title={t('navChoiceTypes')}
        subtitle={t('choiceTypesSubtitle')}
        action={
          can('choicetypes', 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('addChoiceType')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('searchChoiceType')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('choiceRule')}</th>
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
                <td className="px-4 py-3 text-muted">{ruleLabel(item)}</td>
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
                <td className="px-4 py-8 text-center text-muted" colSpan={showActions ? 4 : 3}>
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
        title={editing ? t('editChoiceType') : t('newChoiceType')}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      >
        <label className="text-sm text-muted">
          {t('name')}
          <input required className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => {
              const next = e.target.checked
              setRequired(next)
              if (next && Number(minSelect || 0) < 1) setMinSelect('1')
            }}
          />
          {t('choiceRequired')}
        </label>
        <label className="text-sm text-muted">
          {t('minSelect')}
          <input
            type="number"
            min={0}
            max={20}
            className="field"
            value={minSelect}
            onChange={(e) => setMinSelect(e.target.value)}
          />
        </label>
        <label className="text-sm text-muted">
          {t('maxSelect')}
          <input
            type="number"
            min={0}
            max={20}
            className="field"
            value={maxSelect}
            onChange={(e) => setMaxSelect(e.target.value)}
          />
          <div className="mt-1 text-xs">{t('maxSelectHint')}</div>
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
        <ViewField label={t('choiceRule')} value={viewing ? ruleLabel(viewing) : undefined} />
        <ViewField label={t('status')} value={viewing?.is_active ? t('active') : t('inactive')} />
      </MasterViewModal>
    </div>
  )
}
