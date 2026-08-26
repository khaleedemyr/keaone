import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import { formatRupiah } from '../lib/money'
import type { ApiOk, ChoiceOption, ChoiceType } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { useI18n } from '../i18n'
import { useAccess } from '../access'

export default function Choices() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<ChoiceOption[]>([])
  const [types, setTypes] = useState<ChoiceType[]>([])
  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState('')
  const [extraPrice, setExtraPrice] = useState('0')
  const [editing, setEditing] = useState<ChoiceOption | null>(null)
  const [viewing, setViewing] = useState<ChoiceOption | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<ChoiceOption[]>>('/choices', {
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
    void api
      .get<ApiOk<ChoiceType[]>>('/choice-types', { params: { for_select: 1, status: 'all' } })
      .then(({ data }) => setTypes(data.data))
      .catch(() => setTypes([]))
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage])

  function openCreate() {
    setEditing(null)
    setName('')
    setTypeId('')
    setExtraPrice('0')
    setError('')
    setOpen(true)
  }

  function openEdit(item: ChoiceOption) {
    setEditing(item)
    setName(item.name)
    setTypeId(String(item.choice_type_id ?? item.choice_type?.id ?? ''))
    setExtraPrice(String(item.extra_price ?? 0))
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
        choice_type_id: Number(typeId),
        extra_price: Number(extraPrice || 0),
      }
      if (editing) await api.put(`/choices/${editing.id}`, payload)
      else await api.post('/choices', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: ChoiceOption) {
    const ok = await feedback.confirm({
      title: t('deleteChoiceTitle'),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/choices/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: ChoiceOption) {
    try {
      await api.put(`/choices/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const formTypes = types.filter((item) => item.is_active || String(item.id) === typeId)
  const canEdit = can('choices', 'edit')
  const canDelete = can('choices', 'delete')
  const showActions = canEdit || canDelete

  return (
    <div>
      <PageHeader
        eyebrow={t('productsEyebrow')}
        title={t('navChoices')}
        subtitle={t('choicesSubtitle')}
        action={
          can('choices', 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('addChoice')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('searchChoice')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('navChoiceTypes')}</th>
              <th className="px-4 py-3 font-medium">{t('extraPrice')}</th>
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
                <td className="px-4 py-3 text-muted">{item.choice_type?.name ?? '-'}</td>
                <td className="px-4 py-3 text-muted">
                  {item.extra_price > 0 ? `+ ${formatRupiah(item.extra_price, locale)}` : t('extraPriceNone')}
                </td>
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
        title={editing ? t('editChoice') : t('newChoice')}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      >
        <label className="text-sm text-muted">
          {t('navChoiceTypes')}
          <select required className="field" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">{t('selectChoiceType')}</option>
            {formTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.is_active ? item.name : `${item.name} (${t('inactive')})`}
              </option>
            ))}
          </select>
          {formTypes.length === 0 ? <div className="mt-1 text-xs">{t('noChoiceTypes')}</div> : null}
        </label>
        <label className="text-sm text-muted">
          {t('name')}
          <input required className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          {t('extraPrice')}
          <input
            type="number"
            min={0}
            className="field"
            value={extraPrice}
            onChange={(e) => setExtraPrice(e.target.value)}
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
        <ViewField label={t('navChoiceTypes')} value={viewing?.choice_type?.name} />
        <ViewField
          label={t('extraPrice')}
          value={
            viewing
              ? viewing.extra_price > 0
                ? `+ ${formatRupiah(viewing.extra_price, locale)}`
                : t('extraPriceNone')
              : undefined
          }
        />
        <ViewField label={t('status')} value={viewing?.is_active ? t('active') : t('inactive')} />
      </MasterViewModal>
    </div>
  )
}
