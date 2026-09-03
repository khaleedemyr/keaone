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

type LineDraft = { key: string; product_id: number; name: string; book_qty: number; counted_qty: number }

type OpnameRow = {
  id: number
  number: string
  status: string
  note?: string | null
  warehouse_id: number
  warehouse?: { id: number; name: string } | null
  items?: Array<{ product_id: number; name_snapshot: string; book_qty: number; counted_qty: number; variance: number }>
}

export default function StockOpnames() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const canCreate = can('stockopnames', 'create')
  const canEdit = can('stockopnames', 'edit')

  const [rows, setRows] = useState<OpnameRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OpnameRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [warehouseId, setWarehouseId] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: inventoryDocUuid(), product_id: 0, name: '', book_qty: 0, counted_qty: 0 },
  ])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'confirmed', label: t('purchaseStatusConfirmed') },
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
      const { data } = await api.get<ApiOk<OpnameRow[]>>('/stock-opnames', {
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

  async function fetchBookQty(productId: number, whId: string): Promise<number> {
    if (!productId || !whId) return 0
    try {
      const { data } = await api.get<ApiOk<{ qty: number }>>('/stock/movements', {
        params: { product_id: productId, warehouse_id: whId, per_page: 1 },
        silent: true,
      })
      return Number(data.data?.qty ?? 0)
    } catch {
      return 0
    }
  }

  async function applyScannedProduct(product: Product) {
    if (!product.track_stock) return
    const existing = lines.find((line) => line.product_id === product.id)
    if (existing) {
      setLines((prev) =>
        prev.map((line) =>
          line.product_id === product.id ? { ...line, counted_qty: line.counted_qty + 1 } : line,
        ),
      )
      return
    }
    const book = await fetchBookQty(product.id, warehouseId)
    setLines((prev) => {
      const blankIdx = prev.findIndex((line) => line.product_id === 0)
      const nextLine: LineDraft = {
        key: inventoryDocUuid(),
        product_id: product.id,
        name: product.name,
        book_qty: book,
        counted_qty: Math.max(book, 1),
      }
      if (blankIdx >= 0) {
        return prev.map((line, i) => (i === blankIdx ? { ...nextLine, key: line.key } : line))
      }
      return [...prev, nextLine]
    })
  }

  function resetForm() {
    setEditing(null)
    setWarehouseId('')
    setNote('')
    setLines([{ key: inventoryDocUuid(), product_id: 0, name: '', book_qty: 0, counted_qty: 0 }])
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm('stockopname', 'create')
  }

  async function openEdit(row: OpnameRow) {
    try {
      const { data } = await api.get<ApiOk<OpnameRow>>(`/stock-opnames/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setWarehouseId(String(doc.warehouse_id))
      setNote(doc.note ?? '')
      setLines(
        (doc.items ?? []).map((item) => ({
          key: inventoryDocUuid(),
          product_id: item.product_id,
          name: item.name_snapshot,
          book_qty: item.book_qty,
          counted_qty: item.counted_qty,
        })),
      )
      setOpen(true)
      logMasterForm('stockopname', 'edit', doc.number)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const filled = lines.filter((line) => line.product_id > 0)
    if (!warehouseId || filled.length === 0) {
      setError(t('stockNeedLines'))
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      warehouse_id: Number(warehouseId),
      note: note || undefined,
      items: filled.map((line) => ({
        product_id: line.product_id,
        book_qty: line.book_qty,
        counted_qty: line.counted_qty,
      })),
    }
    try {
      if (editing) {
        await api.put(`/stock-opnames/${editing.id}`, payload)
      } else {
        await api.post('/stock-opnames', { ...payload, client_uuid: inventoryDocUuid() })
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

  async function runAction(row: OpnameRow, action: 'confirm' | 'cancel') {
    if (action === 'confirm' && !window.confirm(t('stockConfirmOpname').replace('{number}', row.number))) return
    try {
      await api.post(`/stock-opnames/${row.id}/${action}`)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      draft: t('purchaseStatusDraft'),
      confirmed: t('purchaseStatusConfirmed'),
      cancelled: t('purchaseStatusCancelled'),
    }
    return map[status] ?? status
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appInventory')}
        title={t('stockOpnamesTitle')}
        subtitle={t('stockOpnamesHint')}
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
              <th className="px-4 py-3">{t('navWarehouses')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  {t('stockEmptyOpnames')}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">{row.number}</td>
                <td className="px-4 py-3">{row.warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{statusLabel(row.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {canEdit && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void openEdit(row)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {canEdit && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'confirm')}>
                        {t('stockConfirm')}
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
        title={editing ? t('edit') : t('stockOpnamesTitle')}
        error={error}
        saving={saving}
        mobileFullscreen
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
      >
        <label className="block text-sm text-muted">
          {t('navWarehouses')}
          <SearchSelect className="!mt-0" value={warehouseId} onChange={setWarehouseId} options={warehouseOptions} placeholder={t('navWarehouses')} required />
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
            disabled={!warehouseId}
            onPick={(product) => void applyScannedProduct(product)}
          />
          {!warehouseId ? <p className="mt-1 text-xs text-muted">{t('stockScanNeedWarehouse')}</p> : null}
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={line.key} className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_90px_90px_auto]">
              <SearchSelect
                value={line.product_id ? String(line.product_id) : ''}
                onChange={(value) => {
                  const product = products.find((p) => String(p.id) === value)
                  void (async () => {
                    const book = product ? await fetchBookQty(product.id, warehouseId) : 0
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === idx
                          ? {
                              ...row,
                              product_id: product?.id ?? 0,
                              name: product?.name ?? '',
                              book_qty: book,
                              counted_qty: book,
                            }
                          : row,
                      ),
                    )
                  })()
                }}
                options={productOptions}
                placeholder={t('navProducts')}
              />
              <input className="field" type="number" value={line.book_qty} readOnly title={t('stockOpnameBookQty')} />
              <input
                className="field"
                type="number"
                min={0}
                data-line={line.key}
                data-col="counted"
                value={line.counted_qty}
                title={t('stockOpnameCountedQty')}
                onChange={(e) => {
                  const counted_qty = Math.max(0, Number(e.target.value) || 0)
                  setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, counted_qty } : row)))
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
            onClick={() =>
              setLines((prev) => [...prev, { key: inventoryDocUuid(), product_id: 0, name: '', book_qty: 0, counted_qty: 0 }])
            }
          >
            + {t('purchaseAdd')}
          </button>
        </div>
      </MasterModal>
    </div>
  )
}
