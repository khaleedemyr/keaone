import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Product, Warehouse } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterModal, MasterViewModal, MasterNameButton } from '../../components/MasterModal'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { SearchSelect } from '../../components/SearchSelect'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import { inventoryDocUuid } from './inventoryDocUtils'
import { InventoryFormSection, InventoryLineTable, TransferDetailView } from './InventoryDocViews'
import { InventoryScanBar } from '../../components/InventoryScanBar'
import { buildTrackableProductOptions } from '../../lib/productScan'
import { baseUnitLabel, inventoryUnitOptions, unitFactor } from './inventoryUnitUtils'
import type { ProductUnitLevel } from '../../types'
import { DocTh } from '../purchase/purchaseDocShared'

type LineDraft = {
  key: string
  product_id: number
  name: string
  /** Qty expressed in the selected unit level. */
  qty: number
  unit_level: ProductUnitLevel
}

function emptyLine(): LineDraft {
  return { key: inventoryDocUuid(), product_id: 0, name: '', qty: 1, unit_level: 'small' }
}

type TransferRow = {
  id: number
  number: string
  status: string
  note?: string | null
  created_at?: string | null
  user?: { name?: string } | null
  void_reason?: string | null
  from_warehouse_id: number
  to_warehouse_id: number
  from_warehouse?: { id: number; name: string } | null
  to_warehouse?: { id: number; name: string } | null
  items?: Array<{
    product_id: number
    name_snapshot: string
    qty: number
    qty_input?: number
    unit?: string | null
    unit_level?: ProductUnitLevel | null
    factor_to_base?: number
    base_unit?: string | null
  }>
}

export default function StockTransfers() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const canCreate = can('stocktransfers', 'create')
  const canEdit = can('stocktransfers', 'edit')
  const canDelete = can('stocktransfers', 'delete')

  const [rows, setRows] = useState<TransferRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<TransferRow | null>(null)
  const [editing, setEditing] = useState<TransferRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'shipped', label: t('stockStatusShipped') },
      { value: 'received', label: t('stockStatusReceived') },
      { value: 'voided', label: t('stockStatusVoided') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ],
    [t],
  )

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    [warehouses],
  )

  const toWarehouseOptions = useMemo(
    () => warehouseOptions.filter((w) => w.value !== fromId),
    [fromId, warehouseOptions],
  )

  const productOptions = useMemo(() => buildTrackableProductOptions(products), [products])

  function hasDuplicateProduct(source: LineDraft[]) {
    const seen = new Set<number>()
    return source.some((line) => {
      if (line.product_id <= 0) return false
      if (seen.has(line.product_id)) return true
      seen.add(line.product_id)
      return false
    })
  }

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<TransferRow[]>>('/stock-transfers', {
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
    void loadRows()
  }, [list.page, list.perPage, list.search, list.status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void Promise.all([
      api.get<ApiOk<Warehouse[]>>('/warehouses', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true }),
      api.get<ApiOk<Product[]>>('/products', { params: { for_select: 1, status: 'active', per_page: 500 }, silent: true }),
    ])
      .then(([wh, prod]) => {
        setWarehouses(wh.data.data ?? [])
        setProducts(prod.data.data ?? [])
      })
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  function applyScannedProduct(product: Product) {
    if (!product.track_stock) return
    const existing = lines.find((line) => line.product_id === product.id)
    if (existing) {
      setLines((prev) =>
        prev.map((line) => (line.product_id === product.id ? { ...line, qty: line.qty + 1 } : line)),
      )
      return
    }
    setLines((prev) => {
      const blankIdx = prev.findIndex((line) => line.product_id === 0)
      const nextLine: LineDraft = {
        ...emptyLine(),
        product_id: product.id,
        name: product.name,
      }
      if (blankIdx >= 0) {
        return prev.map((line, i) => (i === blankIdx ? { ...nextLine, key: line.key } : line))
      }
      return [...prev, nextLine]
    })
  }

  function resetForm() {
    setEditing(null)
    setFromId('')
    setToId('')
    setNote('')
    setLines([emptyLine()])
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm('stocktransfer', 'create')
  }

  async function openView(row: TransferRow) {
    try {
      const { data } = await api.get<ApiOk<TransferRow>>(`/stock-transfers/${row.id}`)
      setViewing(data.data)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function openEdit(row: TransferRow) {
    try {
      const { data } = await api.get<ApiOk<TransferRow>>(`/stock-transfers/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setFromId(String(doc.from_warehouse_id))
      setToId(String(doc.to_warehouse_id))
      setNote(doc.note ?? '')
      setLines(
        (doc.items ?? []).map((item) => ({
          key: inventoryDocUuid(),
          product_id: item.product_id,
          name: item.name_snapshot,
          qty: item.qty_input ?? item.qty,
          unit_level: item.unit_level ?? 'small',
        })),
      )
      setOpen(true)
      logMasterForm('stocktransfer', 'edit', doc.number)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const filled = lines.filter((line) => line.product_id > 0 && line.qty > 0)
    if (!fromId || !toId || filled.length === 0) {
      setError(t('stockNeedLines'))
      return
    }
    if (fromId === toId) {
      setError(t('stockSameWarehouse'))
      return
    }
    if (hasDuplicateProduct(filled)) {
      setError(t('stockDuplicateProduct'))
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      from_warehouse_id: Number(fromId),
      to_warehouse_id: Number(toId),
      note: note || undefined,
      items: filled.map((line) => ({
        product_id: line.product_id,
        qty: line.qty,
        unit_level: line.unit_level,
      })),
    }
    try {
      if (editing) {
        await api.put(`/stock-transfers/${editing.id}`, payload)
      } else {
        await api.post('/stock-transfers', { ...payload, client_uuid: inventoryDocUuid() })
      }
      setOpen(false)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(row: TransferRow, action: 'ship' | 'receive' | 'cancel' | 'void') {
    if (action === 'void') {
      const reason = await feedback.prompt({
        title: t('purchaseActionConfirm'),
        message: t('stockConfirmVoidTransfer').replace('{number}', row.number),
        inputLabel: t('stockVoidReasonLabel'),
        inputPlaceholder: t('stockVoidReasonPlaceholder'),
        confirmLabel: t('stockVoidTransfer'),
        tone: 'danger',
      })
      if (reason === null) return
      setActingId(row.id)
      try {
        await api.post(`/stock-transfers/${row.id}/void`, { reason: reason || undefined })
        feedback.success(t('saved'))
        void loadRows()
      } catch (err) {
        feedback.error(apiMessage(err, t('saveFailed')))
      } finally {
        setActingId(null)
      }
      return
    }

    const confirmKey =
      action === 'ship'
        ? 'stockConfirmShip'
        : action === 'receive'
          ? 'stockConfirmReceive'
          : action === 'cancel'
            ? 'stockConfirmCancelDoc'
            : null
    if (confirmKey) {
      const ok = await feedback.confirm({
        title: t('purchaseActionConfirm'),
        message: t(confirmKey).replace('{number}', row.number),
        confirmLabel: action === 'cancel' ? t('cancel') : action === 'ship' ? t('stockShip') : t('stockReceive'),
        tone: action === 'cancel' ? 'danger' : 'default',
      })
      if (!ok) return
    }
    setActingId(row.id)
    try {
      await api.post(`/stock-transfers/${row.id}/${action}`)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setActingId(null)
    }
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      draft: t('purchaseStatusDraft'),
      shipped: t('stockStatusShipped'),
      received: t('stockStatusReceived'),
      voided: t('stockStatusVoided'),
      cancelled: t('purchaseStatusCancelled'),
    }
    return map[status] ?? status
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appInventory')}
        title={t('stockTransfersTitle')}
        subtitle={t('stockTransfersHint')}
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('purchaseAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('purchaseSearch')} statusOptions={statusOptions} />

      <div className="glass overflow-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('number')}</th>
              <th className="px-4 py-3">{t('stockTransferFrom')}</th>
              <th className="px-4 py-3">{t('stockTransferTo')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {t('stockEmptyTransfers')}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const acting = actingId === row.id
              return (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">
                  <MasterNameButton onClick={() => void openView(row)}>{row.number}</MasterNameButton>
                </td>
                <td className="px-4 py-3">{row.from_warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{row.to_warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{statusLabel(row.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {canEdit && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" disabled={acting} onClick={() => void openEdit(row)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {canEdit && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" disabled={acting} onClick={() => void runAction(row, 'ship')}>
                        {t('stockShip')}
                      </button>
                    ) : null}
                    {canEdit && row.status === 'shipped' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" disabled={acting} onClick={() => void runAction(row, 'receive')}>
                        {t('stockReceive')}
                      </button>
                    ) : null}
                    {canEdit && (row.status === 'shipped' || row.status === 'received') ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" disabled={acting} onClick={() => void runAction(row, 'void')}>
                        {t('stockVoidTransfer')}
                      </button>
                    ) : null}
                    {(canEdit || canDelete) && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" disabled={acting} onClick={() => void runAction(row, 'cancel')}>
                        {t('cancel')}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterViewModal
        open={Boolean(viewing)}
        title={viewing ? `${t('stockTransfersTitle')} · ${viewing.number}` : ''}
        size="2xl"
        documentMode
        onClose={() => setViewing(null)}
        onEdit={
          viewing && canEdit && viewing.status === 'draft'
            ? () => {
                setViewing(null)
                void openEdit(viewing)
              }
            : undefined
        }
      >
        {viewing ? (
          <TransferDetailView doc={viewing} statusLabel={statusLabel(viewing.status)} locale={locale} t={t} />
        ) : null}
      </MasterViewModal>

      <MasterModal
        open={open}
        title={editing ? `${t('edit')} · ${editing.number}` : t('stockTransfersTitle')}
        error={error}
        saving={saving}
        size="xl"
        mobileFullscreen
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
      >
        <InventoryFormSection title={t('stockTransfersTitle')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-muted">
              {t('stockTransferFrom')}
              <SearchSelect
                className="!mt-0"
                value={fromId}
                onChange={(value) => {
                  setFromId(value)
                  if (value === toId) setToId('')
                }}
                options={warehouseOptions}
                placeholder={t('stockTransferFrom')}
                required
              />
            </label>
            <label className="block text-sm text-muted">
              {t('stockTransferTo')}
              <SearchSelect className="!mt-0" value={toId} onChange={setToId} options={toWarehouseOptions} placeholder={t('stockTransferTo')} required />
            </label>
            <label className="block text-sm text-muted sm:col-span-2">
              {t('purchaseNote')}
              <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        </InventoryFormSection>

        <InventoryFormSection title={t('stockDetailItems')} hint={t('stockScanTitle')}>
          <InventoryScanBar
            products={products.filter((p) => p.track_stock)}
            productOptions={productOptions}
            onPick={applyScannedProduct}
          />
          <InventoryLineTable
            columns={
              <>
                <DocTh>{t('product')}</DocTh>
                <DocTh align="right">{t('stockQty')}</DocTh>
                <DocTh>{t('unit')}</DocTh>
                <DocTh>{t('actions')}</DocTh>
              </>
            }
            footer={
              <button
                type="button"
                className="btn-ghost !text-xs"
                onClick={() => {
                  if (hasDuplicateProduct(lines)) {
                    setError(t('stockDuplicateProduct'))
                    return
                  }
                  setLines((prev) => [...prev, emptyLine()])
                }}
              >
                + {t('purchaseAdd')}
              </button>
            }
          >
            {lines.map((line, idx) => {
              const product = products.find((p) => p.id === line.product_id)
              const unitOptions = inventoryUnitOptions(product)
              const factor = unitFactor(product, line.unit_level)
              return (
                <tr key={line.key} className="border-b border-line/70 last:border-0">
                  <td className="px-2 py-2">
                    <SearchSelect
                      className="!mt-0"
                      value={line.product_id ? String(line.product_id) : ''}
                      onChange={(value) => {
                        const picked = products.find((p) => String(p.id) === value)
                        if (picked && lines.some((row, i) => i !== idx && row.product_id === picked.id)) {
                          setError(t('stockDuplicateProduct'))
                          return
                        }
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? {
                                  ...row,
                                  product_id: picked?.id ?? 0,
                                  name: picked?.name ?? '',
                                  unit_level: 'small',
                                }
                              : row,
                          ),
                        )
                      }}
                      options={productOptions}
                      placeholder={t('navProducts')}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="field !mt-0 text-right"
                      type="number"
                      min={1}
                      step={1}
                      value={line.qty}
                      onChange={(e) => {
                        const qty = Math.max(1, Math.trunc(Number.parseInt(e.target.value, 10) || 1))
                        setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty } : row)))
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="field !mt-0"
                      value={line.unit_level}
                      disabled={!line.product_id}
                      onChange={(e) => {
                        const level = e.target.value as ProductUnitLevel
                        setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, unit_level: level } : row)))
                      }}
                    >
                      {line.product_id ? null : <option value="small">{t('purchaseSelectUnit')}</option>}
                      {unitOptions.map((option) => (
                        <option key={option.level} value={option.level}>
                          {option.label}
                          {option.factor_to_base > 1 ? ` (=${option.factor_to_base})` : ''}
                        </option>
                      ))}
                    </select>
                    {factor > 1 ? (
                      <div className="mt-1 text-[11px] text-muted">
                        = {line.qty * factor} {baseUnitLabel(product)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="btn-ghost !px-2 !text-xs"
                      onClick={() => setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))}
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </InventoryLineTable>
        </InventoryFormSection>
      </MasterModal>
    </div>
  )
}
