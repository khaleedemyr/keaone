import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import type { ApiOk, Outlet, Warehouse } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { useI18n } from '../i18n'
import { useAccess } from '../access'

export default function Warehouses() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<Warehouse[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [outletId, setOutletId] = useState('')
  const [editing, setEditing] = useState<Warehouse | null>(null)
  const [viewing, setViewing] = useState<Warehouse | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<Warehouse[]>>('/warehouses', {
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
      .get<ApiOk<Outlet[]>>('/outlets', { params: { for_select: 1, status: 'all' } })
      .then(({ data }) => setOutlets(data.data))
      .catch(() => setOutlets([]))
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
    setAddress('')
    setOutletId('')
    setError('')
    setOpen(true)
  }

  function openEdit(item: Warehouse) {
    setEditing(item)
    setName(item.name)
    setAddress(item.address ?? '')
    setOutletId(item.outlet_id ? String(item.outlet_id) : '')
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
        address: address || null,
        outlet_id: outletId ? Number(outletId) : null,
      }
      if (editing) await api.put(`/warehouses/${editing.id}`, payload)
      else await api.post('/warehouses', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function makeDefault(item: Warehouse) {
    try {
      await api.put(`/warehouses/${item.id}`, { is_default: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function remove(item: Warehouse) {
    const ok = await feedback.confirm({
      title: t('deleteWarehouseTitle'),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/warehouses/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: Warehouse) {
    try {
      await api.put(`/warehouses/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const canEdit = can('warehouses', 'edit')
  const canDelete = can('warehouses', 'delete')
  const showActions = canEdit || canDelete

  return (
    <div>
      <PageHeader
        eyebrow={t('productsEyebrow')}
        title={t('navWarehouses')}
        subtitle={t('warehousesSubtitle')}
        action={
          can('warehouses', 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('addWarehouse')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('searchWarehouse')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('navOutlets')}</th>
              <th className="px-4 py-3 font-medium">{t('address')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              {showActions ? <th className="px-4 py-3 font-medium"></th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3">
                  <MasterNameButton onClick={() => setViewing(item)}>{item.name}</MasterNameButton>
                  {item.is_default ? (
                    <span className="ml-2 rounded-full bg-mint/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-mint">
                      {t('defaultWarehouse')}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">{item.outlet?.name ?? '-'}</td>
                <td className="px-4 py-3 text-muted">{item.address ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className={item.is_active ? 'text-mint' : 'text-rose-300'}>
                    {item.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                {showActions ? (
                <td className="px-4 py-3 text-right">
                  {!item.is_default && item.is_active && canEdit ? (
                    <button type="button" className="mr-3 text-xs text-mint" onClick={() => void makeDefault(item)}>
                      {t('setDefault')}
                    </button>
                  ) : null}
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
        title={editing ? t('editWarehouse') : t('newWarehouse')}
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
          {t('navOutlets')}
          <select className="field" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            <option value="">-</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          {t('address')}
          <textarea className="field min-h-20" value={address} onChange={(e) => setAddress(e.target.value)} />
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
        <ViewField label={t('navOutlets')} value={viewing?.outlet?.name} />
        <ViewField label={t('address')} value={viewing?.address} />
        <ViewField label={t('defaultWarehouse')} value={viewing?.is_default ? t('defaultWarehouse') : '-'} />
        <ViewField label={t('status')} value={viewing?.is_active ? t('active') : t('inactive')} />
      </MasterViewModal>
    </div>
  )
}
