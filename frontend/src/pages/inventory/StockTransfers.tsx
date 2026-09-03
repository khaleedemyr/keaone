import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Product, Warehouse } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterModal } from '../../components/MasterModal'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { SearchSelect } from '../../components/SearchSelect'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import { inventoryDocUuid } from './inventoryDocUtils'
import { InventoryScanBar } from '../../components/InventoryScanBar'
import { buildTrackableProductOptions } from '../../lib/productScan'

type LineDraft = { key: string; product_id: number; name: string; qty: number }

type TransferRow = {
  id: number
  number: string
  status: string
  note?: string | null
  from_warehouse_id: number
  to_warehouse_id: number
  from_warehouse?: { id: number; name: string } | null
  to_warehouse?: { id: number; name: string } | null
  items?: Array<{ product_id: number; name_snapshot: string; qty: number }>
}

export default function StockTransfers() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const canCreate = can('stocktransfers', 'create')
  const canEdit = can('stocktransfers', 'edit')

  const [rows, setRows] = useState<TransferRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TransferRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ key: inventoryDocUuid(), product_id: 0, name: '', qty: 1 }])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'shipped', label: t('stockStatusShipped') },
      { value: 'received', label: t('stockStatusReceived') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ],
    [t],
  )

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    [warehouses],
  )

  const productOptions = useMemo(() => buildTrackableProductOptions(products), [products])

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
        key: inventoryDocUuid(),
        product_id: product.id,
        name: product.name,
        qty: 1,
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
    setLines([{ key: inventoryDocUuid(), product_id: 0, name: '', qty: 1 }])
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm('stocktransfer', 'create')
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
          qty: item.qty,
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
    setSaving(true)
    setError('')
    const payload = {
      from_warehouse_id: Number(fromId),
      to_warehouse_id: Number(toId),
      note: note || undefined,
      items: filled.map((line) => ({ product_id: line.product_id, qty: line.qty })),
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

  async function runAction(row: TransferRow, action: 'ship' | 'receive' | 'cancel') {
    const confirmKey =
      action === 'ship' ? 'stockConfirmShip' : action === 'receive' ? 'stockConfirmReceive' : null
    if (confirmKey && !window.confirm(t(confirmKey).replace('{number}', row.number))) return
    try {
      await api.post(`/stock-transfers/${row.id}/${action}`)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      draft: t('purchaseStatusDraft'),
      shipped: t('stockStatusShipped'),
      received: t('stockStatusReceived'),
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
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">{row.number}</td>
                <td className="px-4 py-3">{row.from_warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{row.to_warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{statusLabel(row.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {canEdit && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void openEdit(row)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {canEdit && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'ship')}>
                        {t('stockShip')}
                      </button>
                    ) : null}
                    {canEdit && row.status === 'shipped' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'receive')}>
                        {t('stockReceive')}
                      </button>
                    ) : null}
                    {canEdit && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'cancel')}>
                        {t('cancel')}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t('edit') : t('stockTransfersTitle')}
        error={error}
        saving={saving}
        mobileFullscreen
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
      >
        <label className="block text-sm text-muted">
          {t('stockTransferFrom')}
          <SearchSelect className="!mt-0" value={fromId} onChange={setFromId} options={warehouseOptions} placeholder={t('stockTransferFrom')} required />
        </label>
        <label className="block text-sm text-muted">
          {t('stockTransferTo')}
          <SearchSelect className="!mt-0" value={toId} onChange={setToId} options={warehouseOptions} placeholder={t('stockTransferTo')} required />
        </label>
        <label className="block text-sm text-muted">
          {t('purchaseNote')}
          <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div>
          <div className="mb-1 text-sm text-muted">{t('stockScanTitle')}</div>
          <InventoryScanBar
            products={products.filter((p) => p.track_stock)}
            productOptions={productOptions}
            onPick={applyScannedProduct}
          />
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={line.key} className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_100px_auto]">
              <SearchSelect
                value={line.product_id ? String(line.product_id) : ''}
                onChange={(value) => {
                  const product = products.find((p) => String(p.id) === value)
                  setLines((prev) =>
                    prev.map((row, i) =>
                      i === idx
                        ? { ...row, product_id: product?.id ?? 0, name: product?.name ?? '' }
                        : row,
                    ),
                  )
                }}
                options={productOptions}
                placeholder={t('navProducts')}
              />
              <input
                className="field"
                type="number"
                min={1}
                value={line.qty}
                onChange={(e) => {
                  const qty = Math.max(1, Number(e.target.value) || 1)
                  setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty } : row)))
                }}
              />
              <button
                type="button"
                className="btn-ghost !px-2 !text-xs"
                onClick={() => setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))}
              >
                {t('delete')}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost !text-xs"
            onClick={() => setLines((prev) => [...prev, { key: inventoryDocUuid(), product_id: 0, name: '', qty: 1 }])}
          >
            + {t('purchaseAdd')}
          </button>
        </div>
      </MasterModal>
    </div>
  )
}
