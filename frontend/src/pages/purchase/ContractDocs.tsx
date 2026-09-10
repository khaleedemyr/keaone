import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Party, Product, ProductUnitLevel } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import { buildProductOptions, defaultUnitPick, productPurchaseCost, productUnitOptions } from './purchaseLineUtils'
import { useSupplierSelect } from './useSupplierSelect'

type ContractItemRow = {
  id?: number
  product_id: number
  product_name?: string
  sku?: string
  qty_contracted: number
  qty_released?: number
  qty_remaining?: number
  unit?: string | null
  unit_level?: ProductUnitLevel | null
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

type ItemDraft = {
  product_id: string
  qty: string
  unit: string
  unit_level: ProductUnitLevel
  unit_cost: string
  note: string
}
const EMPTY_ITEM: ItemDraft = {
  product_id: '',
  qty: '',
  unit: '',
  unit_level: 'small',
  unit_cost: '',
  note: '',
}

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
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseQtys, setReleaseQtys] = useState<Record<number, string>>({})
  const [releaseError, setReleaseError] = useState('')
  const [releaseSaving, setReleaseSaving] = useState(false)

  const canCreate = can('procurementcontracts', 'create')
  const canEdit = can('procurementcontracts', 'edit')
  const canDelete = can('procurementcontracts', 'delete')

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('procurementContractStatusDraft') },
      { value: 'active', label: t('procurementContractStatusActive') },
      { value: 'closed', label: t('procurementContractStatusClosed') },
      { value: 'cancelled', label: t('procurementContractStatusCancelled') },
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
            unit: item.unit ?? '',
            unit_level: (item.unit_level as ProductUnitLevel) || 'small',
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
          unit: row.unit || undefined,
          unit_level: row.unit_level || 'small',
          unit_cost: Number(row.unit_cost || 0),
          note: row.note || undefined,
        }))
      if (items.length === 0) {
        setError(t('purchaseNeedItems'))
        return
      }
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
        feedback.success(t('saved'))
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

  function openRelease() {
    if (!viewing) return
    const remaining = viewing.items.filter((row) => (row.qty_remaining ?? 0) > 0)
    if (remaining.length === 0) {
      feedback.error(t('procurementContractNoReleaseQty'))
      return
    }
    const qtys: Record<number, string> = {}
    for (const row of remaining) {
      if (row.id != null) qtys[row.id] = String(row.qty_remaining ?? 0)
    }
    setReleaseQtys(qtys)
    setReleaseError('')
    setReleaseOpen(true)
  }

  async function confirmRelease(e: FormEvent) {
    e.preventDefault()
    if (!viewing) return
    setReleaseSaving(true)
    setReleaseError('')
    try {
      const items = viewing.items
        .filter((row) => row.id != null && (row.qty_remaining ?? 0) > 0)
        .map((row) => {
          const qty = Number(releaseQtys[row.id!] ?? 0)
          return { contract_item_id: row.id!, qty, max: row.qty_remaining ?? 0 }
        })
        .filter((row) => row.qty > 0)

      if (items.length === 0) {
        setReleaseError(t('procurementContractNoReleaseQty'))
        return
      }
      const over = items.find((row) => row.qty > row.max)
      if (over) {
        setReleaseError(t('procurementContractReleaseQtyOver'))
        return
      }

      await api.post(`/procurement-contracts/${viewing.id}/release-po`, {
        client_uuid: uuid(),
        items: items.map(({ contract_item_id, qty }) => ({ contract_item_id, qty })),
      })
      feedback.success(t('procurementContractReleasePoOk'))
      setReleaseOpen(false)
      const detail = await api.get<ApiOk<ContractRow>>(`/procurement-contracts/${viewing.id}`)
      setViewing(detail.data.data)
      await loadRows()
    } catch (err) {
      setReleaseError(apiMessage(err, t('actionFailed')))
    } finally {
      setReleaseSaving(false)
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

      <div className="glass mt-4 overflow-x-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('number')}</th>
              <th className="px-4 py-3">{t('title')}</th>
              <th className="px-4 py-3">{t('supplier')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3 text-right">{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">
                  <MasterNameButton onClick={() => setViewing(row)}>{row.number}</MasterNameButton>
                </td>
                <td className="max-w-[16rem] truncate px-4 py-3" title={row.title}>
                  {row.title}
                </td>
                <td className="px-4 py-3 text-muted">{row.supplier?.name ?? '—'}</td>
                <td className="px-4 py-3">{statusLabel(t, row.status)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(row.total_value)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
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
                        const product = products.find((p) => String(p.id) === value)
                        const unitPick = product ? defaultUnitPick(product) : { unit: '', unit_level: 'small' as ProductUnitLevel }
                        const next = [...itemDrafts]
                        next[idx] = {
                          ...next[idx],
                          product_id: value,
                          unit: unitPick.unit,
                          unit_level: unitPick.unit_level,
                          unit_cost:
                            next[idx].unit_cost ||
                            (product ? String(productPurchaseCost(product)) : next[idx].unit_cost),
                        }
                        setItemDrafts(next)
                      }}
                      options={productOptions}
                      placeholder={t('purchasePickProduct')}
                      allowEmpty
                      emptyLabel={t('purchasePickProduct')}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="field-block mb-0">
                      <span>{t('stockQty')}</span>
                      <input
                        className="field !mt-0 tabular-nums"
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...itemDrafts]
                          next[idx] = { ...next[idx], qty: e.target.value }
                          setItemDrafts(next)
                        }}
                      />
                    </label>
                    <label className="field-block mb-0">
                      <span>{t('unit')}</span>
                      <select
                        className="field !mt-0"
                        value={row.unit_level}
                        disabled={!row.product_id}
                        onChange={(e) => {
                          const level = e.target.value as ProductUnitLevel
                          const product = products.find((p) => String(p.id) === row.product_id)
                          const picked = productUnitOptions(product).find((o) => o.level === level)
                          const next = [...itemDrafts]
                          next[idx] = {
                            ...next[idx],
                            unit_level: level,
                            unit: picked?.label || next[idx].unit,
                          }
                          setItemDrafts(next)
                        }}
                      >
                        {(() => {
                          const product = products.find((p) => String(p.id) === row.product_id)
                          const options = productUnitOptions(product)
                          const known = options.some((o) => o.level === row.unit_level)
                          return (
                            <>
                              {!known && row.unit_level ? (
                                <option value={row.unit_level}>{row.unit || t('purchaseSelectUnit')}</option>
                              ) : null}
                              {options.map((opt) => (
                                <option key={opt.level} value={opt.level}>
                                  {opt.label}
                                </option>
                              ))}
                            </>
                          )
                        })()}
                      </select>
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
                  <li key={item.id}>
                    {item.product_name} — {item.qty_contracted} {item.unit || ''} (
                    {t('procurementContractRemaining')}: {item.qty_remaining ?? 0})
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && viewing.status === 'draft' ? (
                <button type="button" className="btn btn-primary" onClick={() => void runAction(`/procurement-contracts/${viewing.id}/activate`, 'procurementContractActivated')}>{t('activate')}</button>
              ) : null}
              {canEdit && viewing.status === 'active' ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={openRelease}>{t('procurementContractReleasePo')}</button>
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

      <MasterModal
        open={releaseOpen}
        title={t('procurementContractReleasePo')}
        onClose={() => setReleaseOpen(false)}
        onSubmit={confirmRelease}
        saving={releaseSaving}
        error={releaseError}
        size="lg"
      >
        <p className="mb-4 text-sm text-muted">{t('procurementContractReleaseHint')}</p>
        <div className="space-y-3">
          {(viewing?.items ?? [])
            .filter((item) => (item.qty_remaining ?? 0) > 0)
            .map((item) => (
              <div key={item.id} className="rounded-xl border border-line p-3">
                <div className="mb-2 text-sm font-medium text-fg">
                  {item.product_name}
                  <span className="ml-2 text-xs font-normal text-muted">
                    {t('procurementContractRemaining')}: {item.qty_remaining ?? 0} {item.unit || ''}
                  </span>
                </div>
                <label className="field-block mb-0">
                  <span>{t('procurementContractReleaseQty')}</span>
                  <input
                    className="field !mt-0 tabular-nums"
                    type="number"
                    min={0}
                    max={item.qty_remaining ?? 0}
                    value={releaseQtys[item.id!] ?? ''}
                    onChange={(e) =>
                      setReleaseQtys((prev) => ({ ...prev, [item.id!]: e.target.value }))
                    }
                  />
                </label>
              </div>
            ))}
        </div>
      </MasterModal>
    </div>
  )
}
