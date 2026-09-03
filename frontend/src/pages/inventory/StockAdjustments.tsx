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
import { useI18n, type MsgKey } from '../../i18n'
import { inventoryDocUuid } from './inventoryDocUtils'
import { buildTrackableProductOptions } from '../../lib/productScan'

type Reason =
  | 'damage'
  | 'loss'
  | 'sample'
  | 'write_off'
  | 'found'
  | 'other'
  | 'expired'
  | 'overcook'
  | 'complimentary'

type LineDraft = { key: string; product_id: number; name: string; qty_change: number }

type AdjustmentRow = {
  id: number
  number: string
  status: string
  reason: Reason
  note?: string | null
  warehouse_id: number
  warehouse?: { id: number; name: string } | null
  items?: Array<{ product_id: number; name_snapshot: string; qty_change: number }>
}

const ALL_REASONS: { id: Reason; label: MsgKey }[] = [
  { id: 'damage', label: 'stockAdjReasonDamage' },
  { id: 'loss', label: 'stockAdjReasonLoss' },
  { id: 'sample', label: 'stockAdjReasonSample' },
  { id: 'write_off', label: 'stockAdjReasonWriteOff' },
  { id: 'found', label: 'stockAdjReasonFound' },
  { id: 'other', label: 'stockAdjReasonOther' },
  { id: 'expired', label: 'stockAdjReasonExpired' },
  { id: 'overcook', label: 'stockAdjReasonOvercook' },
  { id: 'complimentary', label: 'stockAdjReasonComplimentary' },
]

const WASTE_REASONS: Reason[] = ['expired', 'overcook', 'complimentary', 'damage', 'write_off']

export default function StockAdjustments({ mode = 'all' }: { mode?: 'all' | 'waste' }) {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const menu = mode === 'waste' ? 'stockwaste' : 'stockadjustments'
  const canCreate = can(menu, 'create')
  const canEdit = can(menu, 'edit')
  const reasons = useMemo(
    () => (mode === 'waste' ? ALL_REASONS.filter((r) => WASTE_REASONS.includes(r.id)) : ALL_REASONS),
    [mode],
  )
  const defaultReason: Reason = mode === 'waste' ? 'expired' : 'damage'

  const [rows, setRows] = useState<AdjustmentRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AdjustmentRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [warehouseId, setWarehouseId] = useState('')
  const [reason, setReason] = useState<Reason>(defaultReason)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ key: inventoryDocUuid(), product_id: 0, name: '', qty_change: -1 }])

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
      const { data } = await api.get<ApiOk<AdjustmentRow[]>>('/stock-adjustments', {
        params: {
          page: list.page,
          per_page: list.perPage,
          search: list.search || undefined,
          status: list.status !== 'all' ? list.status : undefined,
          waste_only: mode === 'waste' ? 1 : undefined,
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
  }, [list.page, list.perPage, list.search, list.status, mode]) // eslint-disable-line react-hooks/exhaustive-deps

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

  function resetForm() {
    setEditing(null)
    setWarehouseId('')
    setReason(defaultReason)
    setNote('')
    setLines([{ key: inventoryDocUuid(), product_id: 0, name: '', qty_change: -1 }])
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm(mode === 'waste' ? 'stockwaste' : 'stockadjustment', 'create')
  }

  async function openEdit(row: AdjustmentRow) {
    try {
      const { data } = await api.get<ApiOk<AdjustmentRow>>(`/stock-adjustments/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setWarehouseId(String(doc.warehouse_id))
      setReason(doc.reason)
      setNote(doc.note ?? '')
      setLines(
        (doc.items ?? []).map((item) => ({
          key: inventoryDocUuid(),
          product_id: item.product_id,
          name: item.name_snapshot,
          qty_change: item.qty_change,
        })),
      )
      setOpen(true)
      logMasterForm(mode === 'waste' ? 'stockwaste' : 'stockadjustment', 'edit', doc.number)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const filled = lines
      .filter((line) => line.product_id > 0 && line.qty_change !== 0)
      .map((line) => ({
        ...line,
        qty_change: mode === 'waste' ? -Math.abs(line.qty_change) : line.qty_change,
      }))
    if (!warehouseId || filled.length === 0) {
      setError(t('stockNeedLines'))
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      warehouse_id: Number(warehouseId),
      reason,
      note: note || undefined,
      items: filled.map((line) => ({ product_id: line.product_id, qty_change: line.qty_change })),
    }
    try {
      if (editing) {
        await api.put(`/stock-adjustments/${editing.id}`, payload)
      } else {
        await api.post('/stock-adjustments', { ...payload, client_uuid: inventoryDocUuid() })
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

  async function runAction(row: AdjustmentRow, action: 'confirm' | 'cancel') {
    if (action === 'confirm' && !window.confirm(t('stockConfirmAdjustment').replace('{number}', row.number))) return
    try {
      await api.post(`/stock-adjustments/${row.id}/${action}`)
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

  function reasonLabel(value: string) {
    const found = ALL_REASONS.find((r) => r.id === value)
    return found ? t(found.label) : value
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appInventory')}
        title={t(mode === 'waste' ? 'stockWasteTitle' : 'stockAdjustmentsTitle')}
        subtitle={t(mode === 'waste' ? 'stockWasteHint' : 'stockAdjustmentsHint')}
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
              <th className="px-4 py-3">{t('stockAdjReason')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {t(mode === 'waste' ? 'stockEmptyWaste' : 'stockEmptyAdjustments')}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">{row.number}</td>
                <td className="px-4 py-3">{row.warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{reasonLabel(row.reason)}</td>
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
        title={editing ? t('edit') : t(mode === 'waste' ? 'stockWasteTitle' : 'stockAdjustmentsTitle')}
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
          {t('stockAdjReason')}
          <select className="field" value={reason} onChange={(e) => setReason(e.target.value as Reason)}>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {t(r.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-muted">
          {t('purchaseNote')}
          <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={line.key} className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_120px_auto]">
              <SearchSelect
                value={line.product_id ? String(line.product_id) : ''}
                onChange={(value) => {
                  const product = products.find((p) => String(p.id) === value)
                  setLines((prev) =>
                    prev.map((row, i) =>
                      i === idx ? { ...row, product_id: product?.id ?? 0, name: product?.name ?? '' } : row,
                    ),
                  )
                }}
                options={productOptions}
                placeholder={t('navProducts')}
              />
              <input
                className="field"
                type="number"
                value={mode === 'waste' ? Math.abs(line.qty_change) : line.qty_change}
                title={t('stockAdjQtyChange')}
                onChange={(e) => {
                  const raw = Number(e.target.value) || 0
                  const qty_change = mode === 'waste' ? -Math.abs(raw) : raw
                  setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty_change } : row)))
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
            onClick={() => setLines((prev) => [...prev, { key: inventoryDocUuid(), product_id: 0, name: '', qty_change: -1 }])}
          >
            + {t('purchaseAdd')}
          </button>
        </div>
      </MasterModal>
    </div>
  )
}
