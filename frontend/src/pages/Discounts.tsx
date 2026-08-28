import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import { logMasterForm } from '../api/activity'
import { formatRupiah } from '../lib/money'
import { formatDiscountValue } from '../lib/discountCalc'
import type { ApiOk, Discount } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { useI18n } from '../i18n'
import { useAccess } from '../access'

export default function Discounts() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<Discount[]>([])
  const [name, setName] = useState('')
  const [valueType, setValueType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState('10')
  const [scope, setScope] = useState<'item' | 'sale'>('sale')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [minSubtotal, setMinSubtotal] = useState('')
  const [editing, setEditing] = useState<Discount | null>(null)
  const [viewing, setViewing] = useState<Discount | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<Discount[]>>('/discounts', {
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
    setValueType('percent')
    setValue('10')
    setScope('sale')
    setMaxDiscount('')
    setMinSubtotal('')
    setError('')
    setOpen(true)
    logMasterForm('discount', 'create')
  }

  function openEdit(item: Discount) {
    setEditing(item)
    setName(item.name)
    setValueType(item.value_type)
    setValue(String(item.value))
    setScope(item.scope)
    setMaxDiscount(item.max_discount ? String(item.max_discount) : '')
    setMinSubtotal(item.min_subtotal ? String(item.min_subtotal) : '')
    setError('')
    setOpen(true)
    logMasterForm('discount', 'edit', item.name)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name,
        value_type: valueType,
        value: Number(value),
        scope,
        max_discount: maxDiscount ? Number(maxDiscount) : null,
        min_subtotal: minSubtotal ? Number(minSubtotal) : null,
      }
      if (editing) await api.put(`/discounts/${editing.id}`, payload)
      else await api.post('/discounts', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: Discount) {
    const ok = await feedback.confirm({
      title: t('deleteDiscountTitle'),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/discounts/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: Discount) {
    try {
      await api.put(`/discounts/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const canEdit = can('discounts', 'edit')
  const canDelete = can('discounts', 'delete')
  const showActions = canEdit || canDelete

  return (
    <div>
      <PageHeader
        eyebrow={t('productsEyebrow')}
        title={t('navDiscounts')}
        subtitle={t('discountsSubtitle')}
        action={
          can('discounts', 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('addDiscount')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('searchDiscount')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('discountValue')}</th>
              <th className="px-4 py-3 font-medium">{t('discountScope')}</th>
              <th className="px-4 py-3 font-medium">{t('discountMinSubtotal')}</th>
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
                <td className="px-4 py-3 tabular-nums">
                  {formatDiscountValue(item, (amount) => formatRupiah(amount, locale))}
                  {item.max_discount ? (
                    <div className="text-xs text-muted">
                      {t('discountMax')}: {formatRupiah(item.max_discount, locale)}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">
                  {item.scope === 'item' ? t('discountScopeItem') : t('discountScopeSale')}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {item.min_subtotal ? formatRupiah(item.min_subtotal, locale) : '—'}
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
                <td className="px-4 py-8 text-center text-muted" colSpan={showActions ? 6 : 5}>
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
        title={editing ? t('editDiscount') : t('newDiscount')}
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
          {t('discountValueType')}
          <select className="field" value={valueType} onChange={(e) => setValueType(e.target.value as 'percent' | 'fixed')}>
            <option value="percent">{t('discountTypePercent')}</option>
            <option value="fixed">{t('discountTypeFixed')}</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          {valueType === 'percent' ? t('discountPercentValue') : t('discountFixedValue')}
          <input
            required
            type="number"
            min={1}
            max={valueType === 'percent' ? 100 : undefined}
            className="field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label className="text-sm text-muted">
          {t('discountScope')}
          <select className="field" value={scope} onChange={(e) => setScope(e.target.value as 'item' | 'sale')}>
            <option value="sale">{t('discountScopeSale')}</option>
            <option value="item">{t('discountScopeItem')}</option>
          </select>
        </label>
        {valueType === 'percent' ? (
          <label className="text-sm text-muted">
            {t('discountMax')}
            <input type="number" min={0} className="field" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
          </label>
        ) : null}
        <label className="text-sm text-muted">
          {t('discountMinSubtotal')}
          <input type="number" min={0} className="field" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} />
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
        <ViewField
          label={t('discountValue')}
          value={viewing ? formatDiscountValue(viewing, (amount) => formatRupiah(amount, locale)) : undefined}
        />
        <ViewField
          label={t('discountScope')}
          value={viewing ? (viewing.scope === 'item' ? t('discountScopeItem') : t('discountScopeSale')) : undefined}
        />
        <ViewField
          label={t('discountMinSubtotal')}
          value={viewing?.min_subtotal ? formatRupiah(viewing.min_subtotal, locale) : '—'}
        />
        <ViewField label={t('status')} value={viewing?.is_active ? t('active') : t('inactive')} />
      </MasterViewModal>
    </div>
  )
}
