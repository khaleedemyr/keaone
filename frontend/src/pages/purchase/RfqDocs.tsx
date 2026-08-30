import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Outlet, Party, Product, Warehouse } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { SearchMultiSelect } from '../../components/SearchMultiSelect'
import { PurchaseLineEditor } from './PurchaseLineEditor'
import { ProcurementCostCenterFields } from './ProcurementCostCenterFields'
import {
  buildProductOptions,
  emptyPurchaseLine,
  ensureTrailingEmptyPurchaseLine,
  purchaseLineUuid,
  type PurchaseLineDraft,
} from './purchaseLineUtils'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'

type RfqItemRow = {
  id: number
  product_id: number
  name_snapshot: string
  qty: number
  unit?: string | null
  spec_note?: string | null
  note?: string | null
}

type QuoteItemRow = {
  id?: number
  rfq_item_id: number
  unit_cost?: number
  qty?: number
  lead_days?: number | null
  note?: string | null
}

type QuoteRow = {
  id: number
  number: string
  status: string
  supplier_id: number
  supplier?: { id: number; name: string } | null
  subtotal: number
  total: number
  lead_days?: number | null
  note?: string | null
  items?: QuoteItemRow[]
}

type ComparisonCell = {
  vendor_quote_id: number
  supplier_id: number
  supplier_name?: string
  unit_cost?: number | null
  total?: number | null
  lead_days?: number | null
}

type ComparisonRow = {
  rfq_item_id: number
  name: string
  qty: number
  unit?: string | null
  lowest_unit_cost?: number | null
  cells: ComparisonCell[]
}

type RfqRow = {
  id: number
  number: string
  title: string
  status: string
  due_at?: string | null
  note?: string | null
  outlet?: { id: number; name: string } | null
  department?: { id: number; name: string; code?: string | null } | null
  warehouse?: { id: number; name: string } | null
  user?: { id: number; name: string } | null
  winner_vendor_quote_id?: number | null
  winner_quote?: QuoteRow | null
  has_purchase_requisition?: boolean
  items?: RfqItemRow[]
  suppliers?: Array<{ supplier_id: number; supplier?: { id: number; name: string } | null }>
  quotes?: QuoteRow[]
  comparison?: { quotes: QuoteRow[]; rows: ComparisonRow[] }
  created_at?: string
}

function uuid() {
  return purchaseLineUuid()
}

function statusLabel(t: (k: MsgKey) => string, status: string) {
  const map: Record<string, MsgKey> = {
    draft: 'procurementRfqStatusDraft',
    open: 'procurementRfqStatusOpen',
    closed: 'procurementRfqStatusClosed',
    cancelled: 'procurementRfqStatusCancelled',
    awarded: 'procurementRfqStatusAwarded',
  }
  return t(map[status] ?? 'procurementRfqStatusDraft')
}

function quoteStatusLabel(t: (k: MsgKey) => string, status: string) {
  const map: Record<string, MsgKey> = {
    draft: 'procurementRfqQuoteDraft',
    submitted: 'procurementRfqQuoteSubmitted',
    selected: 'procurementRfqQuoteSelected',
    rejected: 'procurementRfqQuoteRejected',
  }
  return t(map[status] ?? 'procurementRfqQuoteDraft')
}

export default function RfqDocs() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'all')
  const rfqEnabled = me?.settings?.procurement_rfq_enabled === true
  const costCenterEnabled = me?.settings?.procurement_cost_center_enabled !== false

  const [rows, setRows] = useState<RfqRow[]>([])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<RfqRow | null>(null)
  const [editing, setEditing] = useState<RfqRow | null>(null)
  const [quoteSupplierId, setQuoteSupplierId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [note, setNote] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [outletId, setOutletId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [lines, setLines] = useState<PurchaseLineDraft[]>([emptyPurchaseLine()])
  const [supplierIds, setSupplierIds] = useState<number[]>([])
  const [quoteItems, setQuoteItems] = useState<Record<number, string>>({})
  const [quoteLeadDays, setQuoteLeadDays] = useState('')
  const [quoteNote, setQuoteNote] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [departments, setDepartments] = useState<Array<{ id: number; name: string; code?: string | null }>>([])
  const [multiOutlet, setMultiOutlet] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)

  const canCreate = can('rfqs', 'create')
  const canEdit = can('rfqs', 'edit')
  const canDelete = can('rfqs', 'delete')
  const canCreatePr = can('purchaserequisitions', 'create')

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('procurementRfqStatusDraft') },
      { value: 'open', label: t('procurementRfqStatusOpen') },
      { value: 'awarded', label: t('procurementRfqStatusAwarded') },
      { value: 'closed', label: t('procurementRfqStatusClosed') },
      { value: 'cancelled', label: t('procurementRfqStatusCancelled') },
    ],
    [t],
  )

  const productOptions = useMemo(() => buildProductOptions(products), [products])
  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: String(s.id), label: s.name })),
    [suppliers],
  )

  async function loadRefs() {
    try {
      const [p, w, o, d, s] = await Promise.all([
        api.get<ApiOk<Product[]>>('/products', { params: { status: 'active', per_page: 500 }, silent: true }),
        api.get<ApiOk<Warehouse[]>>('/warehouses', { params: { status: 'active', per_page: 100 }, silent: true }),
        api.get<ApiOk<Outlet[]>>('/outlets', { params: { status: 'active', per_page: 100 }, silent: true }),
        api.get<ApiOk<Array<{ id: number; name: string; code?: string | null }>>>('/departments', {
          params: { status: 'active', per_page: 200 },
          silent: true,
        }),
        api.get<ApiOk<Party[]>>('/suppliers', { params: { for_select: 1, status: 'active', per_page: 500 }, silent: true }),
      ])
      setProducts(p.data.data ?? [])
      setWarehouses(w.data.data ?? [])
      setOutlets(o.data.data ?? [])
      setDepartments(d.data.data ?? [])
      setSuppliers(s.data.data ?? [])
      setMultiOutlet((o.data.data ?? []).length > 1)
    } catch {
      /* ignore */
    }
  }

  async function loadRows() {
    if (!rfqEnabled) return
    try {
      const { data } = await api.get<ApiOk<RfqRow[]>>('/rfqs', {
        params: {
          page: list.page,
          per_page: list.perPage,
          status: list.status === 'all' ? undefined : list.status,
          search: list.search || undefined,
        },
      })
      setRows(data.data ?? [])
      list.applyMeta(data.meta, data.data?.length ?? 0)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void loadRefs()
  }, [])

  useEffect(() => {
    if (!rfqEnabled) return
    const handle = window.setTimeout(() => void loadRows(), 200)
    return () => window.clearTimeout(handle)
  }, [list.page, list.perPage, list.status, list.search, rfqEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setTitle('')
    setDueAt('')
    setNote('')
    setWarehouseId('')
    setOutletId('')
    setDepartmentId('')
    setLines([emptyPurchaseLine()])
    setSupplierIds([])
    setError('')
  }

  function openCreate() {
    resetForm()
    setEditing(null)
    logMasterForm('rfq', 'create')
    setOpen(true)
  }

  function openEdit(row: RfqRow) {
    setEditing(row)
    setTitle(row.title)
    setDueAt(row.due_at ?? '')
    setNote(row.note ?? '')
    setWarehouseId(row.warehouse?.id ? String(row.warehouse.id) : '')
    setOutletId(row.outlet?.id ? String(row.outlet.id) : '')
    setDepartmentId(row.department?.id ? String(row.department.id) : '')
    setLines(
      ensureTrailingEmptyPurchaseLine(
        (row.items ?? []).map((item) => ({
          key: uuid(),
          product_id: item.product_id,
          name: item.name_snapshot,
          qty: item.qty,
          unit: item.unit ?? '',
          unit_level: 'small',
          unit_cost: 0,
        })),
      ),
    )
    setSupplierIds((row.suppliers ?? []).map((s) => s.supplier_id))
    setError('')
    logMasterForm('rfq', 'edit', row.number)
    setOpen(true)
  }

  async function openDetail(row: RfqRow) {
    try {
      const { data } = await api.get<ApiOk<RfqRow>>(`/rfqs/${row.id}`)
      setViewing(data.data)
      setQuoteSupplierId(null)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  function buildItemsPayload() {
    return lines
      .filter((line) => line.product_id > 0 && line.qty > 0)
      .map((line) => ({
        product_id: line.product_id,
        qty: line.qty,
        unit: line.unit || undefined,
        unit_level: line.unit_level || undefined,
      }))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        title,
        due_at: dueAt || null,
        note: note || null,
        warehouse_id: warehouseId ? Number(warehouseId) : undefined,
        outlet_id: outletId ? Number(outletId) : undefined,
        department_id: departmentId ? Number(departmentId) : undefined,
        items: buildItemsPayload(),
        supplier_ids: supplierIds,
      }
      if (editing) {
        await api.put(`/rfqs/${editing.id}`, payload)
        feedback.success(t('saved'))
      } else {
        await api.post('/rfqs', { ...payload, client_uuid: uuid() })
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

  async function runAction(path: string, successKey: MsgKey = 'saved') {
    if (!viewing) return
    setActing(true)
    try {
      const { data } = await api.post<ApiOk<RfqRow>>(path)
      setViewing(data.data)
      feedback.success(t(successKey))
      await loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setActing(false)
    }
  }

  function beginQuote(supplierId: number) {
    if (!viewing) return
    const quote = viewing.quotes?.find((q) => q.supplier_id === supplierId)
    const draft: Record<number, string> = {}
    for (const item of viewing.items ?? []) {
      const line = quote?.items?.find((qi) => qi.rfq_item_id === item.id)
      draft[item.id] = line?.unit_cost ? String(line.unit_cost) : ''
    }
    setQuoteItems(draft)
    setQuoteLeadDays(quote?.lead_days ? String(quote.lead_days) : '')
    setQuoteNote(quote?.note ?? '')
    setQuoteSupplierId(supplierId)
  }

  async function saveQuote(e: FormEvent) {
    e.preventDefault()
    if (!viewing || !quoteSupplierId) return
    setSaving(true)
    try {
      const items = (viewing.items ?? []).map((item) => ({
        rfq_item_id: item.id,
        unit_cost: Number(quoteItems[item.id]?.replace(/[^\d]/g, '') || 0),
        qty: item.qty,
      }))
      const { data } = await api.put<ApiOk<QuoteRow>>(`/rfqs/${viewing.id}/quotes/${quoteSupplierId}`, {
        client_uuid: uuid(),
        lead_days: quoteLeadDays ? Number(quoteLeadDays) : null,
        note: quoteNote || null,
        items,
      })
      feedback.success(t('saved'))
      setQuoteSupplierId(null)
      const detail = await api.get<ApiOk<RfqRow>>(`/rfqs/${viewing.id}`)
      setViewing(detail.data.data)
      await loadRows()
      void data
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function submitQuote(quoteId: number) {
    if (!viewing) return
    setActing(true)
    try {
      await api.post(`/rfqs/${viewing.id}/quotes/${quoteId}/submit`)
      feedback.success(t('saved'))
      const detail = await api.get<ApiOk<RfqRow>>(`/rfqs/${viewing.id}`)
      setViewing(detail.data.data)
      await loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setActing(false)
    }
  }

  async function selectWinner(quoteId: number) {
    if (!viewing) return
    setActing(true)
    try {
      const { data } = await api.post<ApiOk<RfqRow>>(`/rfqs/${viewing.id}/select-winner`, {
        vendor_quote_id: quoteId,
      })
      setViewing(data.data)
      feedback.success(t('procurementRfqWinnerSelected'))
      await loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setActing(false)
    }
  }

  async function createPr() {
    if (!viewing) return
    setActing(true)
    try {
      await api.post(`/rfqs/${viewing.id}/create-pr`, { client_uuid: uuid() })
      feedback.success(t('procurementRfqPrCreated'))
      const detail = await api.get<ApiOk<RfqRow>>(`/rfqs/${viewing.id}`)
      setViewing(detail.data.data)
      await loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setActing(false)
    }
  }

  if (!rfqEnabled) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('procurementRfqTitle')} subtitle={t('procurementRfqSubtitle')} />
        <div className="glass rounded-3xl p-6 text-sm text-muted">{t('procurementRfqNotEnabled')}</div>
      </div>
    )
  }

  const comparison = viewing?.comparison
  const submittedQuotes = (viewing?.quotes ?? []).filter((q) =>
    ['submitted', 'selected'].includes(q.status),
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('procurementRfqTitle')}
        subtitle={t('procurementRfqSubtitle')}
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('procurementRfqNew')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('procurementRfqSearch')}
        statusOptions={statusOptions}
      />

      <div className="glass overflow-x-auto rounded-3xl">
        <table className="master-table">
          <thead>
            <tr>
              <th>{t('number')}</th>
              <th>{t('procurementRfqTitleField')}</th>
              <th>{t('status')}</th>
              <th>{t('procurementRfqDueAt')}</th>
              <th>{t('navDepartments')}</th>
              <th>{t('createdAt')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <MasterNameButton onClick={() => void openDetail(row)}>{row.number}</MasterNameButton>
                </td>
                <td>{row.title}</td>
                <td>{statusLabel(t, row.status)}</td>
                <td>{row.due_at ?? '—'}</td>
                <td>{row.department?.name ?? '—'}</td>
                <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted">
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
        title={editing ? t('edit') : t('procurementRfqNew')}
        onClose={() => setOpen(false)}
        error={error}
        saving={saving}
        onSubmit={save}
        wide
      >
        <div className="space-y-4">
          <label className="field-block">
            <span>{t('procurementRfqTitleField')}</span>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field-block">
            <span>{t('procurementRfqDueAt')}</span>
            <input className="field" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </label>
          {costCenterEnabled ? (
            <>
              <ProcurementCostCenterFields
                outlets={outlets}
                departments={departments}
                multiOutlet={multiOutlet}
                outletId={outletId}
                departmentId={departmentId}
                onOutletChange={setOutletId}
                onDepartmentChange={setDepartmentId}
              />
              <label className="field-block">
                <span>{t('navWarehouses')}</span>
                <select className="field" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">{t('procurementCostCenterDefaultOutlet')}</option>
                  {warehouses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <div>
            <div className="mb-2 text-sm font-medium text-fg">{t('items')}</div>
            <PurchaseLineEditor
              lines={lines}
              setLines={setLines}
              products={products}
              productOptions={productOptions}
              needsCost={false}
            />
          </div>
          <label className="field-block">
            <span>{t('procurementRfqInvitedSuppliers')}</span>
            <SearchMultiSelect
              values={supplierIds.map(String)}
              onChange={(next) => setSupplierIds(next.map(Number).filter((id) => Number.isFinite(id) && id > 0))}
              options={supplierOptions}
              placeholder={t('purchaseSelectSupplier')}
              searchPlaceholder={t('searchSupplier')}
            />
          </label>
          <label className="field-block">
            <span>{t('purchaseNote')}</span>
            <textarea className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </MasterModal>

      <MasterViewModal open={Boolean(viewing)} title={viewing?.number ?? ''} onClose={() => setViewing(null)} size="2xl">
        {viewing ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <ViewField label={t('procurementRfqTitleField')} value={viewing.title} />
              <ViewField label={t('status')} value={statusLabel(t, viewing.status)} />
              <ViewField label={t('procurementRfqDueAt')} value={viewing.due_at ?? '—'} />
              <ViewField label={t('navDepartments')} value={viewing.department?.name ?? '—'} />
              <ViewField label={t('navWarehouses')} value={viewing.warehouse?.name ?? '—'} />
              <ViewField label={t('purchaseNote')} value={viewing.note ?? '—'} />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-fg">{t('items')}</h4>
              <div className="overflow-x-auto rounded-2xl border border-line/40">
                <table className="master-table">
                  <thead>
                    <tr>
                      <th>{t('product')}</th>
                      <th>{t('qty')}</th>
                      <th>{t('unit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.items ?? []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.name_snapshot}</td>
                        <td>{item.qty}</td>
                        <td>{item.unit ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-fg">{t('procurementRfqInvitedSuppliers')}</h4>
              <div className="flex flex-wrap gap-2">
                {(viewing.suppliers ?? []).map((row) => (
                  <span key={row.supplier_id} className="rounded-full bg-surface px-3 py-1 text-sm">
                    {row.supplier?.name}
                  </span>
                ))}
              </div>
            </div>

            {viewing.status === 'draft' && canEdit ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={() => openEdit(viewing)}>
                  {t('edit')}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={acting}
                  onClick={() => void runAction(`/rfqs/${viewing.id}/send`)}
                >
                  {t('procurementRfqSend')}
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={acting}
                    onClick={async () => {
                      if (!window.confirm(t('deleteConfirm', { name: viewing.number }))) return
                      await api.delete(`/rfqs/${viewing.id}`)
                      setViewing(null)
                      await loadRows()
                    }}
                  >
                    {t('delete')}
                  </button>
                ) : null}
              </div>
            ) : null}

            {['open', 'awarded'].includes(viewing.status) ? (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-fg">{t('procurementRfqQuotes')}</h4>
                <div className="space-y-2">
                  {(viewing.suppliers ?? []).map((row) => {
                    const quote = viewing.quotes?.find((q) => q.supplier_id === row.supplier_id)
                    return (
                      <div
                        key={row.supplier_id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/40 p-3"
                      >
                        <div>
                          <div className="font-medium text-fg">{row.supplier?.name}</div>
                          <div className="text-xs text-muted">
                            {quote
                              ? `${quoteStatusLabel(t, quote.status)} · ${formatRupiah(quote.total)}`
                              : t('procurementRfqQuoteDraft')}
                          </div>
                        </div>
                        {canEdit && viewing.status === 'open' ? (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn-secondary" onClick={() => beginQuote(row.supplier_id)}>
                              {quote ? t('edit') : t('procurementRfqInputQuote')}
                            </button>
                            {quote && quote.status === 'draft' ? (
                              <button
                                type="button"
                                className="btn-primary"
                                disabled={acting}
                                onClick={() => void submitQuote(quote.id)}
                              >
                                {t('procurementRfqQuoteSubmit')}
                              </button>
                            ) : null}
                            {quote && quote.status === 'submitted' ? (
                              <button
                                type="button"
                                className="btn-primary"
                                disabled={acting}
                                onClick={() => void selectWinner(quote.id)}
                              >
                                {t('procurementRfqSelectWinner')}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>

                {comparison && submittedQuotes.length > 0 ? (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-fg">{t('procurementRfqCompare')}</h4>
                    <div className="overflow-x-auto rounded-2xl border border-line/40">
                      <table className="master-table">
                        <thead>
                          <tr>
                            <th>{t('product')}</th>
                            <th>{t('qty')}</th>
                            {submittedQuotes.map((q) => (
                              <th key={q.id}>{q.supplier?.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(comparison.rows ?? []).map((row) => (
                            <tr key={row.rfq_item_id}>
                              <td>{row.name}</td>
                              <td>
                                {row.qty} {row.unit ?? ''}
                              </td>
                              {submittedQuotes.map((q) => {
                                const cell = row.cells.find((c) => c.vendor_quote_id === q.id)
                                const isLowest =
                                  cell?.unit_cost != null &&
                                  row.lowest_unit_cost != null &&
                                  cell.unit_cost === row.lowest_unit_cost
                                return (
                                  <td key={q.id} className={isLowest ? 'font-semibold text-emerald-600' : undefined}>
                                    {cell?.unit_cost != null ? formatRupiah(cell.unit_cost) : '—'}
                                    {isLowest ? (
                                      <span className="ml-1 text-xs text-emerald-600">({t('procurementRfqLowest')})</span>
                                    ) : null}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                          <tr className="font-semibold">
                            <td colSpan={2}>{t('total')}</td>
                            {submittedQuotes.map((q) => (
                              <td key={q.id}>{formatRupiah(q.total)}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {viewing.winner_quote ? (
                  <div className="rounded-2xl bg-emerald-500/10 p-3 text-sm">
                    {t('procurementRfqWinner')}: {viewing.winner_quote.supplier?.name} (
                    {formatRupiah(viewing.winner_quote.total)})
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {canEdit && viewing.status === 'open' ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={acting}
                      onClick={() => void runAction(`/rfqs/${viewing.id}/cancel`)}
                    >
                      {t('procurementRfqCancel')}
                    </button>
                  ) : null}
                  {canEdit && ['open', 'awarded'].includes(viewing.status) ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={acting}
                      onClick={() => void runAction(`/rfqs/${viewing.id}/close`)}
                    >
                      {t('procurementRfqClose')}
                    </button>
                  ) : null}
                  {canCreatePr &&
                  viewing.winner_vendor_quote_id &&
                  !viewing.has_purchase_requisition &&
                  ['awarded', 'closed'].includes(viewing.status) ? (
                    <button type="button" className="btn-primary" disabled={acting} onClick={() => void createPr()}>
                      {t('procurementRfqCreatePr')}
                    </button>
                  ) : null}
                  {viewing.has_purchase_requisition ? (
                    <span className="self-center text-sm text-muted">{t('procurementRfqHasPr')}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </MasterViewModal>

      <MasterModal
        open={quoteSupplierId != null}
        title={t('procurementRfqInputQuote')}
        onClose={() => setQuoteSupplierId(null)}
        error=""
        saving={saving}
        onSubmit={saveQuote}
      >
        {viewing && quoteSupplierId ? (
          <div className="space-y-4">
            {(viewing.items ?? []).map((item) => (
              <label key={item.id} className="field-block">
                <span>
                  {item.name_snapshot} ({item.qty} {item.unit ?? ''})
                </span>
                <input
                  className="field"
                  inputMode="numeric"
                  value={quoteItems[item.id] ?? ''}
                  onChange={(e) => setQuoteItems((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder={t('procurementRfqUnitCost')}
                />
              </label>
            ))}
            <label className="field-block">
              <span>{t('procurementRfqLeadDays')}</span>
              <input className="field" inputMode="numeric" value={quoteLeadDays} onChange={(e) => setQuoteLeadDays(e.target.value)} />
            </label>
            <label className="field-block">
              <span>{t('purchaseNote')}</span>
              <textarea className="field min-h-16" value={quoteNote} onChange={(e) => setQuoteNote(e.target.value)} />
            </label>
          </div>
        ) : null}
      </MasterModal>
    </div>
  )
}
