import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Party, Product } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import { buildProductOptions } from './purchaseLineUtils'
import { useSupplierSelect } from './useSupplierSelect'

type ContractItemRow = {
  id?: number
  product_id: number
  product_name?: string
  sku?: string
  qty_contracted: number
  qty_released?: number
  qty_remaining?: number
  unit_cost: number
  note?: string | null
}

type ContractRow = {
  id: number
  number: string
  title: string
  status: string
  supplier_id: number
  supplier?: { id: number; name: string }
  period_start?: string | null
  period_end?: string | null
  total_value: number
  note?: string | null
  items: ContractItemRow[]
}

type ItemDraft = { product_id: string; qty: string; unit_cost: string; note: string }
const EMPTY_ITEM: ItemDraft = { product_id: '', qty: '', unit_cost: '', note: '' }

function uuid() {
  return crypto.randomUUID()
}

function statusLabel(t: (k: MsgKey) => string, status: string) {
  const map: Record<string, MsgKey> = {
    draft: 'procurementContractStatusDraft',
    active: 'procurementContractStatusActive',
    closed: 'procurementContractStatusClosed',
    cancelled: 'procurementContractStatusCancelled',
  }
  return t(map[status] ?? 'procurementContractStatusDraft')
}

export default function ContractDocs() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'all')
  const enabled = me?.settings?.procurement_contract_enabled === true

  const [rows, setRows] = useState<ContractRow[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const { options: supplierOptions } = useSupplierSelect(suppliers)
  const productOptions = useMemo(() => buildProductOptions(products), [products])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<ContractRow | null>(null)
  const [editing, setEditing] = useState<ContractRow | null>(null)
  const [title, setTitle] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [note, setNote] = useState('')
  const [itemDrafts, setItemDrafts] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = can('procurementcontracts', 'create')
  const canEdit = can('procurementcontracts', 'edit')
  const canDelete = can('procurementcontracts', 'delete')

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('procurementContractStatusDraft') },
      { value: 'active', label: t('procurementContractStatusActive') },
      { value: 'closed', label: t('procurementContractStatusClosed') },
    ],
    [t],
  )

  async function loadMeta() {
    try {
      const [supRes, prodRes] = await Promise.all([
        api.get<ApiOk<Party[]>>('/contacts', { params: { type: 'supplier', status: 'active', per_page: 200 } }),
        api.get<ApiOk<Product[]>>('/products', { params: { for_purchase: 1, status: 'active', per_page: 200 } }),
      ])
      setSuppliers(supRes.data.data ?? [])
      setProducts(prodRes.data.data ?? [])
    } catch {
      setSuppliers([])
      setProducts([])
    }
  }

  async function loadRows() {
    if (!enabled) return
    try {
      const { data } = await api.get<ApiOk<ContractRow[]>>('/procurement-contracts', {
        params: {
          page: list.page,
          per_page: list.perPage,
          search: list.search || undefined,
          status: list.status !== 'all' ? list.status : undefined,
        },
      })
      setRows(data.data ?? [])
      list.applyMeta(data.meta, data.data?.length ?? 0)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void loadMeta()
  }, [])

  useEffect(() => {
    void loadRows()
  }, [enabled, list.page, list.perPage, list.search, list.status])

  function resetForm(row?: ContractRow | null) {
    setEditing(row ?? null)
    setTitle(row?.title ?? '')
    setSupplierId(row ? String(row.supplier_id) : '')
    setPeriodStart(row?.period_start ?? '')
    setPeriodEnd(row?.period_end ?? '')
    setNote(row?.note ?? '')
    setItemDrafts(
      row?.items?.length
        ? row.items.map((item) => ({
            product_id: String(item.product_id),
            qty: String(item.qty_contracted),
            unit_cost: String(item.unit_cost),
            note: item.note ?? '',
          }))
        : [{ ...EMPTY_ITEM }],
    )
    setError('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const items = itemDrafts
        .filter((row) => row.product_id && row.qty)
        .map((row) => ({
          product_id: Number(row.product_id),
          qty: Number(row.qty),
          unit_cost: Number(row.unit_cost || 0),
          note: row.note || undefined,
        }))
      const payload = {
        title,
        supplier_id: Number(supplierId),
        period_start: periodStart || undefined,
        period_end: periodEnd || undefined,
        note: note || undefined,
        items,
      }
      if (editing) {
        await api.put(`/procurement-contracts/${editing.id}`, payload)
        feedback.success(t('saved'))
      } else {
        await api.post('/procurement-contracts', { ...payload, client_uuid: uuid() })
        feedback.success(t('created'))
      }
      setOpen(false)
      await loadRows()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(path: string, okMsg: MsgKey) {
    try {
      const { data } = await api.post<ApiOk<ContractRow>>(path)
      feedback.success(t(okMsg))
      if (viewing) setViewing(data.data)
      await loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('actionFailed')))
    }
  }

  async function releasePo() {
    if (!viewing) return
    try {
      const items = viewing.items
        .filter((row) => (row.qty_remaining ?? 0) > 0)
        .map((row) => ({ contract_item_id: row.id!, qty: row.qty_remaining ?? 0 }))
      if (items.length === 0) return
      await api.post(`/procurement-contracts/${viewing.id}/release-po`, { client_uuid: uuid(), items })
      feedback.success(t('procurementContractReleasePoOk'))
      const detail = await api.get<ApiOk<ContractRow>>(`/procurement-contracts/${viewing.id}`)
      setViewing(detail.data.data)
      await loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('actionFailed')))
    }
  }

  if (!enabled) {
    return (
      <div>
        <PageHeader title={t('procurementContractTitle')} />
        <p className="text-sm text-muted">{t('procurementContractDisabled')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('procurementContractTitle')}
        action={
          canCreate ? (
            <button type="button" className="btn btn-primary" onClick={() => { resetForm(null); setOpen(true) }}>
              {t('procurementContractAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        search={list.search}
        onSearch={list.filters.onSearch}
        status={list.status}
        onStatus={list.filters.onStatus}
        statusOptions={statusOptions}
        searchPlaceholder={t('search')}
        perPage={list.perPage}
        onPerPage={list.filters.onPerPage}
      />

      <div className="card mt-4 overflow-x-auto">
        <table className="master-table w-full">
          <thead>
            <tr>
              <th>{t('number')}</th>
              <th>{t('title')}</th>
              <th>{t('supplier')}</th>
              <th>{t('status')}</th>
              <th>{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <MasterNameButton onClick={() => setViewing(row)}>{row.number}</MasterNameButton>
                </td>
                <td>{row.title}</td>
                <td>{row.supplier?.name ?? '—'}</td>
                <td>{statusLabel(t, row.status)}</td>
                <td>{formatRupiah(row.total_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t('procurementContractEdit') : t('procurementContractAdd')}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        saving={saving}
        error={error}
        size="xl"
      >
        <div className="space-y-4">
          <label className="field-block">
            <span>{t('title')}</span>
            <input className="field !mt-0" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field-block">
            <span>{t('supplier')}</span>
            <SearchSelect
              className="!mt-0"
              value={supplierId}
              onChange={setSupplierId}
              options={supplierOptions}
              placeholder={t('purchaseSelectSupplier')}
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-block">
              <span>{t('procurementContractPeriodStart')}</span>
              <input type="date" className="field !mt-0" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </label>
            <label className="field-block">
              <span>{t('procurementContractPeriodEnd')}</span>
              <input type="date" className="field !mt-0" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </label>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg">{t('purchaseItems')}</span>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setItemDrafts([...itemDrafts, { ...EMPTY_ITEM }])}>
                {t('procurementContractAddLine')}
              </button>
            </div>
            <div className="space-y-3">
              {itemDrafts.map((row, idx) => (
                <div key={idx} className="rounded-xl border border-line p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">
                      {t('purchaseItems')} {idx + 1}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={itemDrafts.length <= 1}
                      onClick={() => setItemDrafts(itemDrafts.filter((_, i) => i !== idx))}
                    >
                      {t('delete')}
                    </button>
                  </div>
                  <label className="field-block mb-3">
                    <span>{t('product')}</span>
                    <SearchSelect
                      className="!mt-0"
                      value={row.product_id}
                      onChange={(value) => {
                        const next = [...itemDrafts]
                        next[idx] = { ...next[idx], product_id: value }
                        setItemDrafts(next)
                      }}
                      options={productOptions}
                      placeholder={t('purchasePickProduct')}
                      allowEmpty
                      emptyLabel={t('purchasePickProduct')}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="field-block mb-0">
                      <span>{t('stockQty')}</span>
                      <input
                        className="field !mt-0 tabular-nums"
                        type="number"
                        min={0}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...itemDrafts]
                          next[idx] = { ...next[idx], qty: e.target.value }
                          setItemDrafts(next)
                        }}
                      />
                    </label>
                    <label className="field-block mb-0">
                      <span>{t('purchaseUnitCost')}</span>
                      <input
                        className="field !mt-0 tabular-nums"
                        type="number"
                        min={0}
                        value={row.unit_cost}
                        onChange={(e) => {
                          const next = [...itemDrafts]
                          next[idx] = { ...next[idx], unit_cost: e.target.value }
                          setItemDrafts(next)
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MasterModal>

      <MasterViewModal open={Boolean(viewing)} title={viewing?.number ?? ''} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="space-y-4">
            <ViewField label={t('title')} value={viewing.title} />
            <ViewField label={t('status')} value={statusLabel(t, viewing.status)} />
            <ViewField label={t('supplier')} value={viewing.supplier?.name ?? '—'} />
            <ViewField label={t('total')} value={formatRupiah(viewing.total_value)} />
            <div>
              <p className="text-xs text-muted">{t('items')}</p>
              <ul className="mt-1 space-y-1 text-sm">
                {viewing.items.map((item) => (
                  <li key={item.id}>{item.product_name} — {item.qty_contracted} ({t('procurementContractRemaining')}: {item.qty_remaining ?? 0})</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && viewing.status === 'draft' ? (
                <button type="button" className="btn btn-primary" onClick={() => void runAction(`/procurement-contracts/${viewing.id}/activate`, 'procurementContractActivated')}>{t('activate')}</button>
              ) : null}
              {canEdit && viewing.status === 'active' ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => void releasePo()}>{t('procurementContractReleasePo')}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => void runAction(`/procurement-contracts/${viewing.id}/close`, 'procurementContractClosed')}>{t('close')}</button>
                </>
              ) : null}
              {canEdit && viewing.status === 'draft' ? (
                <button type="button" className="btn btn-ghost" onClick={() => { resetForm(viewing); setOpen(true); setViewing(null) }}>{t('edit')}</button>
              ) : null}
              {canDelete && viewing.status === 'draft' ? (
                <button type="button" className="btn btn-danger" onClick={async () => {
                  await api.delete(`/procurement-contracts/${viewing.id}`)
                  setViewing(null)
                  await loadRows()
                }}>{t('delete')}</button>
              ) : null}
            </div>
          </div>
        ) : null}
      </MasterViewModal>
    </div>
  )
}
