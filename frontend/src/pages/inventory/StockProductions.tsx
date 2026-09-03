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

type PreviewLine = {
  product_id: number
  name_snapshot: string
  qty_planned: number
  qty_actual?: number | null
  qty_variance?: number
  unit?: string | null
}

type ProductionStep = {
  id: number
  sort_order: number
  name: string
  status: string
  done_at?: string | null
  note?: string | null
}

type ProductionSerial = {
  id: number
  serial_number: string
  lot_code?: string | null
  status: string
}

type ProductionRow = {
  id: number
  number: string
  status: string
  qty: number
  scrap_qty?: number
  lot_code?: string | null
  track_serial?: boolean
  note?: string | null
  manufacturing?: boolean
  warehouse_id: number
  warehouse?: { id: number; name: string } | null
  product_id: number
  product_name: string
  product?: { id: number; name: string; sku?: string | null; unit?: string | null } | null
  items?: PreviewLine[]
  steps?: ProductionStep[]
  serials?: ProductionSerial[]
}

export default function StockProductions() {
  const { t } = useI18n()
  const { can, hasModule } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const canCreate = can('stockproduction', 'create')
  const canEdit = can('stockproduction', 'edit')
  const manufacturing = hasModule('work_order')

  const [rows, setRows] = useState<ProductionRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductionRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [warehouseId, setWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [scrapQty, setScrapQty] = useState('0')
  const [lotCode, setLotCode] = useState('')
  const [trackSerial, setTrackSerial] = useState(false)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<PreviewLine[]>([])
  const [steps, setSteps] = useState<ProductionStep[]>([])
  const [multilevel, setMultilevel] = useState(false)

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'confirmed', label: t('purchaseStatusConfirmed') },
      { value: 'voided', label: t('purchaseStatusVoided') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ],
    [t],
  )

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    [warehouses],
  )

  const productOptions = useMemo(
    () =>
      products
        .filter((p) => p.track_stock && p.has_bom)
        .map((p) => ({
          value: String(p.id),
          label: p.sku ? `${p.name} (${p.sku})` : p.name,
          keywords: [p.sku, p.barcode].filter(Boolean).join(' '),
        })),
    [products],
  )

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<ProductionRow[]>>('/stock-productions', {
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

  useEffect(() => {
    if (!open || editing || !productId || Number(qty) < 1) {
      if (!open) {
        setPreview([])
        setMultilevel(false)
      }
      return
    }
    const handle = window.setTimeout(() => {
      void api
        .get<
          ApiOk<{ items: PreviewLine[]; multilevel?: boolean; manufacturing?: boolean; default_steps?: string[] }>
        >('/stock-productions/preview', {
          params: { product_id: Number(productId), qty: Number(qty) },
          silent: true,
        })
        .then(({ data }) => {
          const items = (data.data.items ?? []).map((item) => ({
            ...item,
            qty_actual: item.qty_actual ?? item.qty_planned,
          }))
          setPreview(items)
          setMultilevel(Boolean(data.data.multilevel))
          if (manufacturing && steps.length === 0) {
            setSteps(
              (data.data.default_steps ?? []).map((name, i) => ({
                id: -(i + 1),
                sort_order: i,
                name,
                status: 'pending',
              })),
            )
          }
        })
        .catch(() => {
          setPreview([])
          setMultilevel(false)
        })
    }, 200)
    return () => window.clearTimeout(handle)
  }, [open, editing, productId, qty, manufacturing, steps.length])

  function resetForm() {
    setEditing(null)
    setWarehouseId('')
    setProductId('')
    setQty('1')
    setScrapQty('0')
    setLotCode('')
    setTrackSerial(false)
    setNote('')
    setPreview([])
    setSteps([])
    setMultilevel(false)
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm('stockproduction', 'create')
  }

  async function openEdit(row: ProductionRow) {
    try {
      const { data } = await api.get<ApiOk<ProductionRow>>(`/stock-productions/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setWarehouseId(String(doc.warehouse_id))
      setProductId(String(doc.product_id))
      setQty(String(doc.qty))
      setScrapQty(String(doc.scrap_qty ?? 0))
      setLotCode(doc.lot_code ?? '')
      setTrackSerial(Boolean(doc.track_serial))
      setNote(doc.note ?? '')
      setPreview(
        (doc.items ?? []).map((item) => ({
          ...item,
          qty_actual: item.qty_actual ?? item.qty_planned,
        })),
      )
      setSteps(doc.steps ?? [])
      setOpen(true)
      logMasterForm('stockproduction', 'edit', doc.number)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!warehouseId || !productId || Number(qty) < 1) {
      setError(t('stockNeedLines'))
      return
    }
    setSaving(true)
    setError('')
    const payload: Record<string, unknown> = {
      warehouse_id: Number(warehouseId),
      product_id: Number(productId),
      qty: Number(qty),
      note: note || undefined,
    }
    if (manufacturing) {
      payload.scrap_qty = Number(scrapQty) || 0
      payload.lot_code = lotCode.trim() || null
      payload.track_serial = trackSerial
      payload.items = preview.map((line) => ({
        product_id: line.product_id,
        qty_actual: Number(line.qty_actual ?? line.qty_planned) || 0,
      }))
      payload.steps = steps.map((step, i) => ({
        name: step.name,
        sort_order: step.sort_order ?? i,
        status: step.status,
        note: step.note,
      }))
    }
    try {
      if (editing) {
        await api.put(`/stock-productions/${editing.id}`, payload)
      } else {
        await api.post('/stock-productions', { ...payload, client_uuid: inventoryDocUuid() })
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

  async function runAction(row: ProductionRow, action: 'confirm' | 'cancel' | 'void') {
    if (action === 'confirm') {
      let serials: string[] | undefined
      if (manufacturing && row.track_serial) {
        const input = window.prompt(
          t('stockProductionSerialPrompt').replace('{qty}', String(Math.max(1, row.qty - (row.scrap_qty ?? 0)))),
        )
        if (input === null) return
        serials = input
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      } else if (!window.confirm(t('stockConfirmProduction').replace('{number}', row.number))) {
        return
      }
      try {
        await api.post(`/stock-productions/${row.id}/confirm`, serials ? { serials } : {})
        feedback.success(t('saved'))
        void loadRows()
      } catch (err) {
        feedback.error(apiMessage(err, t('saveFailed')))
      }
      return
    }

    if (action === 'void') {
      const reason = window.prompt(t('stockProductionVoidPrompt').replace('{number}', row.number))
      if (reason === null) return
      try {
        await api.post(`/stock-productions/${row.id}/void`, { reason: reason || undefined })
        feedback.success(t('saved'))
        void loadRows()
      } catch (err) {
        feedback.error(apiMessage(err, t('saveFailed')))
      }
      return
    }

    try {
      await api.post(`/stock-productions/${row.id}/cancel`)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function completeStep(stepId: number) {
    if (!editing || stepId < 1) return
    try {
      const { data } = await api.post<ApiOk<ProductionRow>>(
        `/stock-productions/${editing.id}/steps/${stepId}/complete`,
      )
      setEditing(data.data)
      setSteps(data.data.steps ?? [])
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
      voided: t('purchaseStatusVoided'),
      cancelled: t('purchaseStatusCancelled'),
    }
    return map[status] ?? status
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appInventory')}
        title={t(manufacturing ? 'stockProductionMfgTitle' : 'stockProductionTitle')}
        subtitle={t(manufacturing ? 'stockProductionMfgHint' : 'stockProductionHint')}
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
              <th className="px-4 py-3">{t('product')}</th>
              {manufacturing ? <th className="px-4 py-3">{t('stockProductionLot')}</th> : null}
              <th className="px-4 py-3 text-right">{t('stockQty')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={manufacturing ? 7 : 6} className="px-4 py-8 text-center text-muted">
                  {t('stockEmptyProductions')}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">{row.number}</td>
                <td className="px-4 py-3">{row.warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{row.product_name}</td>
                {manufacturing ? <td className="px-4 py-3 text-muted">{row.lot_code || '—'}</td> : null}
                <td className="px-4 py-3 text-right">
                  {row.qty}
                  {(row.scrap_qty ?? 0) > 0 ? (
                    <span className="ml-1 text-xs text-muted">(-{row.scrap_qty} scrap)</span>
                  ) : null}
                </td>
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
                    {canEdit && row.status === 'confirmed' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'void')}>
                        {t('stockProductionVoid')}
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
        title={editing ? t('edit') : t(manufacturing ? 'stockProductionMfgTitle' : 'stockProductionTitle')}
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
          {t('stockProductionProduct')}
          <SearchSelect
            className="!mt-0"
            value={productId}
            onChange={setProductId}
            options={productOptions}
            placeholder={t('stockProductionProduct')}
            required
          />
        </label>
        <label className="block text-sm text-muted">
          {t('stockProductionQty')}
          <input className="field" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} required />
        </label>
        {manufacturing ? (
          <>
            <label className="block text-sm text-muted">
              {t('stockProductionScrap')}
              <input className="field" type="number" min={0} value={scrapQty} onChange={(e) => setScrapQty(e.target.value)} />
            </label>
            <label className="block text-sm text-muted">
              {t('stockProductionLot')}
              <input className="field" value={lotCode} onChange={(e) => setLotCode(e.target.value)} placeholder={t('stockProductionLotHint')} />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={trackSerial} onChange={(e) => setTrackSerial(e.target.checked)} />
              {t('stockProductionTrackSerial')}
            </label>
          </>
        ) : null}
        <label className="block text-sm text-muted">
          {t('purchaseNote')}
          <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {manufacturing ? (
          <div className="rounded-2xl border border-line p-3">
            <div className="mb-2 text-sm font-medium text-fg">{t('stockProductionRouting')}</div>
            {steps.length === 0 ? (
              <div className="text-xs text-muted">{t('stockProductionRoutingEmpty')}</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {steps.map((step) => (
                  <li key={step.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {step.sort_order + 1}. {step.name}
                      <span className="ml-2 text-xs text-muted">
                        {step.status === 'done' ? t('stockProductionStepDone') : t('stockProductionStepPending')}
                      </span>
                    </span>
                    {editing && canEdit && editing.status === 'draft' && step.status !== 'done' && step.id > 0 ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void completeStep(step.id)}>
                        {t('stockProductionStepComplete')}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="rounded-2xl border border-line p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-fg">{t('stockProductionBomPreview')}</div>
            {multilevel ? <span className="text-xs text-mint">{t('stockProductionMultilevel')}</span> : null}
          </div>
          {preview.length === 0 ? (
            <div className="text-xs text-muted">{t('stockProductionBomEmpty')}</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {preview.map((line) => (
                <li key={line.product_id} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <span>
                    {line.name_snapshot}
                    <span className="ml-2 text-xs text-muted">
                      {t('stockProductionPlanned')}: {line.qty_planned} {line.unit ?? ''}
                    </span>
                  </span>
                  {manufacturing ? (
                    <label className="text-xs text-muted">
                      {t('stockProductionActual')}
                      <input
                        className="field !mt-0 !w-24"
                        type="number"
                        min={0}
                        value={line.qty_actual ?? line.qty_planned}
                        onChange={(e) => {
                          const qty_actual = Math.max(0, Number(e.target.value) || 0)
                          setPreview((prev) =>
                            prev.map((row) =>
                              row.product_id === line.product_id
                                ? { ...row, qty_actual, qty_variance: qty_actual - row.qty_planned }
                                : row,
                            ),
                          )
                        }}
                      />
                    </label>
                  ) : (
                    <span className="text-muted">
                      {line.qty_planned} {line.unit ?? ''}
                    </span>
                  )}
                  {manufacturing ? (
                    <span className="text-xs text-muted">
                      Δ {(line.qty_actual ?? line.qty_planned) - line.qty_planned}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {editing?.serials && editing.serials.length > 0 ? (
          <div className="rounded-2xl border border-line p-3 text-sm">
            <div className="mb-2 font-medium text-fg">{t('stockProductionSerials')}</div>
            <ul className="space-y-1 text-muted">
              {editing.serials.map((s) => (
                <li key={s.id}>
                  {s.serial_number} · {s.status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </MasterModal>
    </div>
  )
}
