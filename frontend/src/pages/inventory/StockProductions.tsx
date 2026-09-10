import { useEffect, useMemo, useRef, useState } from 'react'
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
import { InventoryFormSection, InventoryLineTable, ProductionDetailView } from './InventoryDocViews'
import { baseUnitLabel, formatUnitQty, inventoryUnitOptions, unitFactor } from './inventoryUnitUtils'
import type { ProductUnitLevel } from '../../types'
import { DocTh } from '../purchase/purchaseDocShared'

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
  created_at?: string | null
  user?: { name?: string } | null
  /** Base-unit qty produced. */
  qty: number
  qty_input?: number
  unit?: string | null
  unit_level?: ProductUnitLevel | null
  factor_to_base?: number
  base_unit?: string | null
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
  const { t, locale } = useI18n()
  const { can, hasModule } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const canCreate = can('stockproduction', 'create')
  const canEdit = can('stockproduction', 'edit')
  const canDelete = can('stockproduction', 'delete')
  const manufacturing = hasModule('work_order')

  const [rows, setRows] = useState<ProductionRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<ProductionRow | null>(null)
  const [editing, setEditing] = useState<ProductionRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)
  const [warehouseId, setWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [unitLevel, setUnitLevel] = useState<ProductUnitLevel>('small')
  const [scrapQty, setScrapQty] = useState('0')
  const [lotCode, setLotCode] = useState('')
  const [trackSerial, setTrackSerial] = useState(false)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<PreviewLine[]>([])
  const [steps, setSteps] = useState<ProductionStep[]>([])
  const [multilevel, setMultilevel] = useState(false)
  const previewSeq = useRef(0)

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

  const outputProduct = useMemo(
    () => products.find((p) => String(p.id) === productId),
    [products, productId],
  )
  const outputFactor = unitFactor(outputProduct, unitLevel)

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    [warehouses],
  )

  const productOptions = useMemo(() => {
    const opts = products
      .filter((p) => p.track_stock && p.has_bom)
      .map((p) => ({
        value: String(p.id),
        label: p.sku ? `${p.name} (${p.sku})` : p.name,
        keywords: [p.sku, p.barcode].filter(Boolean).join(' '),
      }))
    // Keep the document's output product selectable even if list filters exclude it
    if (editing?.product_id && !opts.some((o) => o.value === String(editing.product_id))) {
      const name = editing.product_name || editing.product?.name || `#${editing.product_id}`
      const sku = editing.product?.sku
      opts.unshift({
        value: String(editing.product_id),
        label: sku ? `${name} (${sku})` : name,
        keywords: sku || '',
      })
    }
    return opts
  }, [products, editing])

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
    if (!open || !productId || Number(qty) < 1) {
      if (!editing) {
        setPreview([])
        setMultilevel(false)
      }
      return
    }

    previewSeq.current += 1
    const seq = previewSeq.current
    // Create: clear while loading. Edit: keep items from show() until preview returns
    // (previously `if (editing) setPreview([])` wiped BOM and looked like a crash/empty form).
    if (!editing) {
      setPreview([])
      setMultilevel(false)
    }

    const handle = window.setTimeout(() => {
      void api
        .get<
          ApiOk<{ items: PreviewLine[]; multilevel?: boolean; manufacturing?: boolean; default_steps?: string[] }>
        >('/stock-productions/preview', {
          params: { product_id: Number(productId), qty: Number(qty), unit_level: unitLevel },
          silent: true,
        })
        .then(({ data }) => {
          if (previewSeq.current !== seq) return
          const items = (data.data.items ?? []).map((item) => ({
            ...item,
            qty_actual: item.qty_actual ?? item.qty_planned,
          }))
          setPreview(items)
          setMultilevel(Boolean(data.data.multilevel))
          if (manufacturing && !editing && steps.length === 0) {
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
          if (previewSeq.current !== seq) return
          if (!editing) {
            setPreview([])
            setMultilevel(false)
          }
        })
    }, 200)
    return () => window.clearTimeout(handle)
  }, [open, editing, productId, qty, unitLevel, manufacturing, steps.length])

  function resetForm() {
    setEditing(null)
    setWarehouseId('')
    setProductId('')
    setQty('1')
    setUnitLevel('small')
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

  async function openView(row: ProductionRow) {
    try {
      const { data } = await api.get<ApiOk<ProductionRow>>(`/stock-productions/${row.id}`)
      setViewing(data.data)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function openEdit(row: ProductionRow) {
    try {
      const { data } = await api.get<ApiOk<ProductionRow>>(`/stock-productions/${row.id}`)
      const doc = data.data
      if (!doc?.id) {
        feedback.error(t('loadFailed'))
        return
      }
      const items = (doc.items ?? []).map((item) => ({
        ...item,
        qty_actual: item.qty_actual ?? item.qty_planned,
      }))
      setError('')
      setEditing(doc)
      setWarehouseId(String(doc.warehouse_id ?? ''))
      setProductId(String(doc.product_id ?? ''))
      setQty(String(doc.qty_input ?? doc.qty ?? 1))
      setUnitLevel(doc.unit_level ?? 'small')
      setScrapQty(String(doc.scrap_qty ?? 0))
      setLotCode(doc.lot_code ?? '')
      setTrackSerial(Boolean(doc.track_serial))
      setNote(doc.note ?? '')
      setPreview(items)
      setSteps(doc.steps ?? [])
      setMultilevel(false)
      setOpen(true)
      logMasterForm('stockproduction', 'edit', doc.number)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsedQty = Math.max(1, Math.trunc(Number.parseInt(qty, 10) || 0))
    if (!warehouseId || !productId || parsedQty < 1) {
      setError(t('stockNeedLines'))
      return
    }
    setSaving(true)
    setError('')
    const payload: Record<string, unknown> = {
      warehouse_id: Number(warehouseId),
      product_id: Number(productId),
      qty: parsedQty,
      unit_level: unitLevel,
      note: note || undefined,
    }
    if (manufacturing) {
      payload.scrap_qty = Math.max(0, Math.trunc(Number.parseInt(scrapQty, 10) || 0))
      payload.lot_code = lotCode.trim() || null
      payload.track_serial = trackSerial
      payload.items = preview.map((line) => ({
        product_id: line.product_id,
        qty_actual: Math.max(0, Math.trunc(Number(line.qty_actual ?? line.qty_planned) || 0)),
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
        const input = await feedback.prompt({
          title: t('purchaseActionConfirm'),
          message: t('stockProductionSerialPrompt').replace(
            '{qty}',
            String(Math.max(1, row.qty - (row.scrap_qty ?? 0))),
          ),
          confirmLabel: t('stockConfirm'),
          required: true,
        })
        if (input === null) return
        serials = input
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
        if (serials.length === 0) return
      } else {
        const ok = await feedback.confirm({
          title: t('purchaseActionConfirm'),
          message: t('stockConfirmProduction').replace('{number}', row.number),
          confirmLabel: t('stockConfirm'),
        })
        if (!ok) return
      }
      setActingId(row.id)
      try {
        await api.post(`/stock-productions/${row.id}/confirm`, serials ? { serials } : {})
        feedback.success(t('saved'))
        void loadRows()
      } catch (err) {
        feedback.error(apiMessage(err, t('saveFailed')))
      } finally {
        setActingId(null)
      }
      return
    }

    if (action === 'void') {
      const reason = await feedback.prompt({
        title: t('purchaseActionConfirm'),
        message: t('stockProductionVoidPrompt').replace('{number}', row.number),
        inputLabel: t('stockVoidReasonLabel'),
        inputPlaceholder: t('stockVoidReasonPlaceholder'),
        confirmLabel: t('stockProductionVoid'),
        tone: 'danger',
      })
      if (reason === null) return
      setActingId(row.id)
      try {
        await api.post(`/stock-productions/${row.id}/void`, { reason: reason || undefined })
        feedback.success(t('saved'))
        void loadRows()
      } catch (err) {
        feedback.error(apiMessage(err, t('saveFailed')))
      } finally {
        setActingId(null)
      }
      return
    }

    const ok = await feedback.confirm({
      title: t('purchaseActionConfirm'),
      message: t('stockConfirmCancelDoc').replace('{number}', row.number),
      confirmLabel: t('cancel'),
      tone: 'danger',
    })
    if (!ok) return
    setActingId(row.id)
    try {
      await api.post(`/stock-productions/${row.id}/cancel`)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setActingId(null)
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
      voided: t('stockStatusVoided'),
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
            {rows.map((row) => {
              const acting = actingId === row.id
              return (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">
                  <MasterNameButton onClick={() => void openView(row)}>{row.number}</MasterNameButton>
                </td>
                <td className="px-4 py-3">{row.warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{row.product_name}</td>
                {manufacturing ? <td className="px-4 py-3 text-muted">{row.lot_code || '—'}</td> : null}
                <td className="px-4 py-3 text-right">
                  {formatUnitQty(
                    row.qty_input ?? row.qty,
                    row.unit,
                    row.qty,
                    row.base_unit ?? row.product?.unit,
                    row.factor_to_base ?? 1,
                  )}
                  {(row.scrap_qty ?? 0) > 0 ? (
                    <span className="ml-1 text-xs text-muted">(-{row.scrap_qty} scrap)</span>
                  ) : null}
                </td>
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
                    {canEdit && row.status === 'confirmed' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" disabled={acting} onClick={() => void runAction(row, 'void')}>
                        {t('stockProductionVoid')}
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
        title={viewing ? `${t(manufacturing ? 'stockProductionMfgTitle' : 'stockProductionTitle')} · ${viewing.number}` : ''}
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
          <ProductionDetailView doc={viewing} statusLabel={statusLabel(viewing.status)} locale={locale} t={t} manufacturing={manufacturing} />
        ) : null}
      </MasterViewModal>

      <MasterModal
        open={open}
        title={editing ? `${t('edit')} · ${editing.number}` : t(manufacturing ? 'stockProductionMfgTitle' : 'stockProductionTitle')}
        error={error}
        saving={saving}
        size="xl"
        mobileFullscreen
        onClose={() => {
          setOpen(false)
          resetForm()
        }}
        onSubmit={(e) => void onSubmit(e)}
      >
        <InventoryFormSection title={t(manufacturing ? 'stockProductionMfgTitle' : 'stockProductionTitle')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-muted">
              {t('navWarehouses')}
              <SearchSelect className="!mt-0" value={warehouseId} onChange={setWarehouseId} options={warehouseOptions} placeholder={t('navWarehouses')} required />
            </label>
            <label className="block text-sm text-muted">
              {t('stockProductionProduct')}
              <SearchSelect
                className="!mt-0"
                value={productId}
                onChange={(value) => {
                  setProductId(value)
                  setUnitLevel('small')
                  setPreview([])
                  setMultilevel(false)
                }}
                options={productOptions}
                placeholder={t('stockProductionProduct')}
                required
              />
            </label>
            <label className="block text-sm text-muted">
              {t('stockProductionQty')}
              <input
                className="field"
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value)
                  setPreview([])
                  setMultilevel(false)
                }}
                required
              />
            </label>
            <label className="block text-sm text-muted">
              {t('unit')}
              <select
                className="field"
                value={unitLevel}
                disabled={!productId}
                onChange={(e) => {
                  setUnitLevel(e.target.value as ProductUnitLevel)
                  setPreview([])
                  setMultilevel(false)
                }}
              >
                {productId ? null : <option value="small">{t('purchaseSelectUnit')}</option>}
                {inventoryUnitOptions(outputProduct).map((option) => (
                  <option key={option.level} value={option.level}>
                    {option.label}
                    {option.factor_to_base > 1 ? ` (=${option.factor_to_base})` : ''}
                  </option>
                ))}
              </select>
              {outputFactor > 1 ? (
                <span className="mt-1 block text-[11px] text-muted">
                  = {(Number(qty) || 0) * outputFactor} {baseUnitLabel(outputProduct)}
                </span>
              ) : null}
            </label>
            <label className="block text-sm text-muted sm:col-span-2">
              {t('purchaseNote')}
              <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        </InventoryFormSection>

        {manufacturing ? (
          <InventoryFormSection title={t('stockProductionMfgTitle')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-muted">
                {t('stockProductionScrap')}
                {outputFactor > 1 ? (
                  <span className="ml-1 text-[11px] text-muted">({baseUnitLabel(outputProduct)})</span>
                ) : null}
                <input className="field" type="number" min={0} step={1} value={scrapQty} onChange={(e) => setScrapQty(e.target.value)} />
              </label>
              <label className="block text-sm text-muted">
                {t('stockProductionLot')}
                <input className="field" value={lotCode} onChange={(e) => setLotCode(e.target.value)} placeholder={t('stockProductionLotHint')} />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
                <input type="checkbox" checked={trackSerial} onChange={(e) => setTrackSerial(e.target.checked)} />
                {t('stockProductionTrackSerial')}
              </label>
            </div>
          </InventoryFormSection>
        ) : null}

        {manufacturing ? (
          <InventoryFormSection title={t('stockProductionRouting')}>
            {steps.length === 0 ? (
              <div className="text-xs text-muted">{t('stockProductionRoutingEmpty')}</div>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                {steps.map((step) => (
                  <li key={step.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
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
          </InventoryFormSection>
        ) : null}

        <InventoryFormSection
          title={t('stockProductionBomPreview')}
          hint={multilevel ? t('stockProductionMultilevel') : undefined}
        >
          <InventoryLineTable
            columns={
              <>
                <DocTh>{t('product')}</DocTh>
                <DocTh align="right">{t('stockProductionPlanned')}</DocTh>
                {manufacturing ? <DocTh align="right">{t('stockProductionActual')}</DocTh> : null}
                {manufacturing ? <DocTh align="right">{t('stockOpnameVariance')}</DocTh> : null}
                <DocTh>{t('unit')}</DocTh>
              </>
            }
          >
            {preview.length === 0 ? (
              <tr>
                <td colSpan={manufacturing ? 5 : 3} className="px-3 py-8 text-center text-xs text-muted">
                  {t('stockProductionBomEmpty')}
                </td>
              </tr>
            ) : (
              preview.map((line) => (
                <tr key={line.product_id} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-fg">{line.name_snapshot}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{line.qty_planned}</td>
                  {manufacturing ? (
                    <td className="px-3 py-2.5">
                      <input
                        className="field !mt-0 ml-auto !w-24 text-right"
                        type="number"
                        min={0}
                        step={1}
                        value={line.qty_actual ?? line.qty_planned}
                        onChange={(e) => {
                          const qty_actual = Math.max(0, Math.trunc(Number.parseInt(e.target.value, 10) || 0))
                          setPreview((prev) =>
                            prev.map((row) =>
                              row.product_id === line.product_id
                                ? { ...row, qty_actual, qty_variance: qty_actual - row.qty_planned }
                                : row,
                            ),
                          )
                        }}
                      />
                    </td>
                  ) : null}
                  {manufacturing ? (
                    <td className="px-3 py-2.5 text-right text-xs text-muted">
                      Δ {(line.qty_actual ?? line.qty_planned) - line.qty_planned}
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5 text-muted">{line.unit ?? '—'}</td>
                </tr>
              ))
            )}
          </InventoryLineTable>
        </InventoryFormSection>

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
