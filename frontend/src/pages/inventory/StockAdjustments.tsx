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
import { useI18n, type MsgKey } from '../../i18n'
import { inventoryDocUuid } from './inventoryDocUtils'
import { AdjustmentDetailView, InventoryFormSection, InventoryLineTable } from './InventoryDocViews'
import { buildTrackableProductOptions } from '../../lib/productScan'
import { baseUnitLabel, inventoryUnitOptions, unitFactor } from './inventoryUnitUtils'
import type { ProductUnitLevel } from '../../types'
import { DocTh } from '../purchase/purchaseDocShared'

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

type LineDraft = {
  key: string
  product_id: number
  name: string
  /** Signed qty expressed in the selected unit level. */
  qty_change: number
  unit_level: ProductUnitLevel
}

function emptyLine(): LineDraft {
  return { key: inventoryDocUuid(), product_id: 0, name: '', qty_change: -1, unit_level: 'small' }
}

type AdjustmentRow = {
  id: number
  number: string
  status: string
  reason: Reason
  note?: string | null
  created_at?: string | null
  user?: { name?: string } | null
  warehouse_id: number
  warehouse?: { id: number; name: string } | null
  items?: Array<{
    product_id: number
    name_snapshot: string
    qty_change: number
    qty_input?: number
    unit?: string | null
    unit_level?: ProductUnitLevel | null
    factor_to_base?: number
    base_unit?: string | null
  }>
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
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const menu = mode === 'waste' ? 'stockwaste' : 'stockadjustments'
  const canCreate = can(menu, 'create')
  const canEdit = can(menu, 'edit')
  const canDelete = can(menu, 'delete')
  const reasons = useMemo(
    () => (mode === 'waste' ? ALL_REASONS.filter((r) => WASTE_REASONS.includes(r.id)) : ALL_REASONS),
    [mode],
  )
  const defaultReason: Reason = mode === 'waste' ? 'expired' : 'damage'

  const [rows, setRows] = useState<AdjustmentRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<AdjustmentRow | null>(null)
  const [editing, setEditing] = useState<AdjustmentRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)
  const [warehouseId, setWarehouseId] = useState('')
  const [reason, setReason] = useState<Reason>(defaultReason)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'confirmed', label: t('purchaseStatusConfirmed') },
      { value: 'voided', label: t('stockStatusVoided') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ],
    [t],
  )

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    [warehouses],
  )

  const productOptions = useMemo(() => buildTrackableProductOptions(products), [products])

  function isWasteReason(value = reason) {
    return mode === 'waste' || WASTE_REASONS.includes(value)
  }

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
    setLines([emptyLine()])
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm(mode === 'waste' ? 'stockwaste' : 'stockadjustment', 'create')
  }

  async function openView(row: AdjustmentRow) {
    try {
      const { data } = await api.get<ApiOk<AdjustmentRow>>(`/stock-adjustments/${row.id}`)
      setViewing(data.data)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
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
        (doc.items ?? []).map((item) => {
          const factor = Math.max(1, item.factor_to_base ?? 1)
          const entered = item.qty_input ?? Math.abs(item.qty_change) / factor
          return {
            key: inventoryDocUuid(),
            product_id: item.product_id,
            name: item.name_snapshot,
            qty_change: item.qty_change < 0 ? -entered : entered,
            unit_level: item.unit_level ?? ('small' as ProductUnitLevel),
          }
        }),
      )
      setOpen(true)
      logMasterForm(mode === 'waste' ? 'stockwaste' : 'stockadjustment', 'edit', doc.number)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const waste = isWasteReason()
    const filled = lines
      .filter((line) => line.product_id > 0 && line.qty_change !== 0)
      .map((line) => ({
        ...line,
        qty_change: waste ? -Math.abs(line.qty_change) : line.qty_change,
      }))
    if (!warehouseId || filled.length === 0) {
      setError(t('stockNeedLines'))
      return
    }
    if (hasDuplicateProduct(filled)) {
      setError(t('stockDuplicateProduct'))
      return
    }
    if (waste && lines.some((line) => line.product_id > 0 && line.qty_change > 0)) {
      setError(t('stockWasteQtyMustNegative'))
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      warehouse_id: Number(warehouseId),
      reason,
      note: note || undefined,
      items: filled.map((line) => ({
        product_id: line.product_id,
        qty_change: line.qty_change,
        unit_level: line.unit_level,
      })),
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
    const confirmKey = action === 'confirm' ? 'stockConfirmAdjustment' : 'stockConfirmCancelDoc'
    const ok = await feedback.confirm({
      title: t('purchaseActionConfirm'),
      message: t(confirmKey).replace('{number}', row.number),
      confirmLabel: action === 'confirm' ? t('stockConfirm') : t('cancel'),
      tone: action === 'cancel' ? 'danger' : 'default',
    })
    if (!ok) return
    setActingId(row.id)
    try {
      await api.post(`/stock-adjustments/${row.id}/${action}`)
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
      confirmed: t('purchaseStatusConfirmed'),
      voided: t('stockStatusVoided'),
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
            {rows.map((row) => {
              const acting = actingId === row.id
              return (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">
                  <MasterNameButton onClick={() => void openView(row)}>{row.number}</MasterNameButton>
                </td>
                <td className="px-4 py-3">{row.warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{reasonLabel(row.reason)}</td>
                <td className="px-4 py-3">{statusLabel(row.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {canEdit && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" disabled={acting} onClick={() => void openEdit(row)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {canEdit && row.status === 'draft' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" disabled={acting} onClick={() => void runAction(row, 'confirm')}>
                        {t('stockConfirm')}
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
        title={viewing ? `${t(mode === 'waste' ? 'stockWasteTitle' : 'stockAdjustmentsTitle')} · ${viewing.number}` : ''}
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
          <AdjustmentDetailView
            doc={viewing}
            statusLabel={statusLabel(viewing.status)}
            locale={locale}
            t={t}
            docLabel={t(mode === 'waste' ? 'stockWasteTitle' : 'stockAdjustmentsTitle')}
            reasonLabel={reasonLabel(viewing.reason)}
          />
        ) : null}
      </MasterViewModal>

      <MasterModal
        open={open}
        title={editing ? `${t('edit')} · ${editing.number}` : t(mode === 'waste' ? 'stockWasteTitle' : 'stockAdjustmentsTitle')}
        error={error}
        saving={saving}
        size="xl"
        mobileFullscreen
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
      >
        <InventoryFormSection title={t(mode === 'waste' ? 'stockWasteTitle' : 'stockAdjustmentsTitle')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-muted">
              {t('navWarehouses')}
              <SearchSelect className="!mt-0" value={warehouseId} onChange={setWarehouseId} options={warehouseOptions} placeholder={t('navWarehouses')} required />
            </label>
            <label className="block text-sm text-muted">
              {t('stockAdjReason')}
              <select
                className="field"
                value={reason}
                onChange={(e) => {
                  const nextReason = e.target.value as Reason
                  setReason(nextReason)
                  if (isWasteReason(nextReason)) {
                    setLines((prev) => prev.map((line) => ({ ...line, qty_change: -Math.abs(line.qty_change) })))
                  }
                }}
              >
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {t(r.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-muted sm:col-span-2">
              {t('purchaseNote')}
              <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        </InventoryFormSection>

        <InventoryFormSection title={t('stockDetailItems')}>
          <InventoryLineTable
            columns={
              <>
                <DocTh>{t('product')}</DocTh>
                <DocTh align="right">{t('stockAdjQtyChange')}</DocTh>
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
                      step={1}
                      value={isWasteReason() ? Math.abs(line.qty_change) : line.qty_change}
                      title={t('stockAdjQtyChange')}
                      onChange={(e) => {
                        const raw = Math.trunc(Number.parseInt(e.target.value, 10) || 0)
                        const qty_change = isWasteReason() ? -Math.abs(raw) : raw
                        setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, qty_change } : row)))
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
                        = {(isWasteReason() ? Math.abs(line.qty_change) : line.qty_change) * factor}{' '}
                        {baseUnitLabel(product)}
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
