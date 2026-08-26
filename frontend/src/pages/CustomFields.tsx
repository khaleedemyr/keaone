import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import type { ApiOk, CustomFieldDefinition, CustomFieldEntity, CustomFieldType } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { useI18n } from '../i18n'
import { useAccess } from '../access'

const ENTITIES: CustomFieldEntity[] = ['product', 'customer', 'supplier']
const TYPES: CustomFieldType[] = ['text', 'textarea', 'number', 'boolean', 'date', 'select']

export default function CustomFields() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<CustomFieldDefinition[]>([])
  const [entityFilter, setEntityFilter] = useState<CustomFieldEntity | ''>('')
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null)
  const [viewing, setViewing] = useState<CustomFieldDefinition | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [entity, setEntity] = useState<CustomFieldEntity>('product')
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [type, setType] = useState<CustomFieldType>('text')
  const [optionsText, setOptionsText] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [sortOrder, setSortOrder] = useState('0')

  async function load() {
    try {
      const { data } = await api.get<ApiOk<CustomFieldDefinition[]>>('/custom-fields', {
        params: {
          search: list.search || undefined,
          status: list.status,
          entity: entityFilter || undefined,
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
  }, [list.search, list.status, list.page, list.perPage, entityFilter])

  function openCreate() {
    setEditing(null)
    setEntity('product')
    setLabel('')
    setKey('')
    setType('text')
    setOptionsText('')
    setIsRequired(false)
    setSortOrder('0')
    setError('')
    setOpen(true)
  }

  function openEdit(item: CustomFieldDefinition) {
    setEditing(item)
    setEntity(item.entity)
    setLabel(item.label)
    setKey(item.key)
    setType(item.type)
    setOptionsText((item.options ?? []).join('\n'))
    setIsRequired(item.is_required)
    setSortOrder(String(item.sort_order ?? 0))
    setError('')
    setOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        entity,
        label,
        key: key.trim() || undefined,
        type,
        options:
          type === 'select'
            ? optionsText
                .split('\n')
                .map((row) => row.trim())
                .filter(Boolean)
            : null,
        is_required: isRequired,
        sort_order: Number(sortOrder || 0),
      }
      if (editing) await api.put(`/custom-fields/${editing.id}`, payload)
      else await api.post('/custom-fields', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: CustomFieldDefinition) {
    const ok = await feedback.confirm({
      title: t('deleteCustomFieldTitle'),
      message: t('deleteConfirm', { name: item.label }),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/custom-fields/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: CustomFieldDefinition) {
    try {
      await api.put(`/custom-fields/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const canEdit = can('customfields', 'edit')
  const canCreate = can('customfields', 'create')
  const canDelete = can('customfields', 'delete')
  const showActions = canEdit || canDelete

  function entityLabel(value: CustomFieldEntity) {
    if (value === 'product') return t('customFieldEntityProduct')
    if (value === 'customer') return t('customFieldEntityCustomer')
    return t('customFieldEntitySupplier')
  }

  function typeLabel(value: CustomFieldType) {
    return t(`customFieldType_${value}` as 'customFieldType_text')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('navCustomFields')}
        subtitle={t('customFieldsSubtitle')}
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('addCustomField')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('searchCustomField')}
        extra={
          <select
            className="field py-2 text-sm"
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value as CustomFieldEntity | '')
              list.setPage(1)
            }}
          >
            <option value="">{t('filterAll')}</option>
            {ENTITIES.map((item) => (
              <option key={item} value={item}>
                {entityLabel(item)}
              </option>
            ))}
          </select>
        }
      />

      <div className="glass overflow-hidden rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-fill text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('customFieldEntity')}</th>
              <th className="px-4 py-3 font-medium">{t('customFieldType')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              {showActions ? <th className="px-4 py-3 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3">
                  <MasterNameButton onClick={() => setViewing(item)}>{item.label}</MasterNameButton>
                  <div className="font-mono text-xs text-muted">{item.key}</div>
                </td>
                <td className="px-4 py-3 text-muted">{entityLabel(item.entity)}</td>
                <td className="px-4 py-3 text-muted">{typeLabel(item.type)}</td>
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
        title={editing ? t('editCustomField') : t('newCustomField')}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
      >
        <label className="text-sm text-muted">
          {t('customFieldEntity')}
          <select
            className="field"
            value={entity}
            disabled={Boolean(editing)}
            onChange={(e) => setEntity(e.target.value as CustomFieldEntity)}
          >
            {ENTITIES.map((item) => (
              <option key={item} value={item}>
                {entityLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          {t('name')}
          <input required className="field" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          {t('customFieldKey')}
          <input
            className="field font-mono"
            value={key}
            disabled={Boolean(editing)}
            placeholder={t('customFieldKeyHint')}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          />
        </label>
        <label className="text-sm text-muted">
          {t('customFieldType')}
          <select className="field" value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {typeLabel(item)}
              </option>
            ))}
          </select>
        </label>
        {type === 'select' ? (
          <label className="text-sm text-muted">
            {t('customFieldOptions')}
            <textarea
              required
              className="field min-h-28"
              value={optionsText}
              placeholder={t('customFieldOptionsHint')}
              onChange={(e) => setOptionsText(e.target.value)}
            />
          </label>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
            {t('customFieldRequired')}
          </label>
          <label className="text-sm text-muted">
            {t('customFieldSort')}
            <input
              type="number"
              min={0}
              className="field"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
        </div>
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
        <ViewField label={t('name')} value={viewing?.label} />
        <ViewField label={t('customFieldKey')} value={viewing?.key} />
        <ViewField label={t('customFieldEntity')} value={viewing ? entityLabel(viewing.entity) : ''} />
        <ViewField label={t('customFieldType')} value={viewing ? typeLabel(viewing.type) : ''} />
        <ViewField label={t('customFieldRequired')} value={viewing?.is_required ? t('active') : t('inactive')} />
        {viewing?.type === 'select' ? (
          <ViewField label={t('customFieldOptions')} value={(viewing.options ?? []).join(', ')} />
        ) : null}
      </MasterViewModal>
    </div>
  )
}
