import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Member, Party, Product, ProductUnitLevel } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterModal } from '../../components/MasterModal'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { SearchSelect } from '../../components/SearchSelect'
import { AutocompleteSelect } from '../../components/AutocompleteSelect'
import { approvalRowLabel, buildApproverMemberOptions } from './approverOptions'
import { useSupplierSelect } from './useSupplierSelect'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'
import { PurchaseLineEditor } from './PurchaseLineEditor'
import {
  buildProductOptions,
  emptyPurchaseLine,
  ensureTrailingEmptyPurchaseLine,
  purchaseLineUuid,
  type PurchaseLineDraft,
} from './purchaseLineUtils'
import { formatRupiah } from '../../lib/money'

type InvoiceLineDraft = PurchaseLineDraft & {
  goods_receipt_item_id?: number
  discount?: number
}

type ApprovalDraft = {
  key: string
  user_id: number
  name: string
  position?: string | null
}

type InvoiceRow = {
  id: number
  number: string
  status: string
  match_status?: string | null
  match_exception_open?: number
  vendor_ref?: string | null
  invoice_date?: string | null
  due_date?: string | null
  subtotal?: number
  tax_percent?: number
  tax?: number
  total?: number
  withholding_tax?: number
  amount_payable?: number
  amount_paid?: number
  amount_due?: number
  payment_status?: string
  note?: string | null
  supplier?: { id: number; name: string } | null
  purchase_order?: { id: number; number: string; status?: string } | null
  goods_receipt?: { id: number; number: string; status?: string } | null
  invoice_need_approval?: boolean
  can_approve?: boolean
  approvals?: Array<{
    id: number
    level: number
    user_id: number
    user?: { id: number; name: string; position?: string | null } | null
    status: string
  }>
  items?: Array<{
    id: number
    product_id: number
    name_snapshot: string
    qty: number
    unit?: string | null
    unit_level?: ProductUnitLevel | null
    unit_cost: number
    discount?: number
    purchase_order_item_id?: number | null
    goods_receipt_item_id?: number | null
  }>
}

type GrDoc = {
  id: number
  number: string
  supplier_id?: number
  supplier?: { id: number; name: string } | null
  purchase_order_id?: number | null
  purchase_order?: { id: number; number: string } | null
  items?: Array<{
    id: number
    product_id: number
    name_snapshot: string
    qty: number
    unit?: string | null
    unit_level?: ProductUnitLevel | null
    unit_cost: number
    purchase_order_item_id?: number | null
  }>
}

function uuid() {
  return purchaseLineUuid()
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function VendorInvoiceDocs() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const invoiceEnabled = me?.settings?.vendor_invoice_enabled === true
  const matchEnabled = me?.settings?.procurement_match_enabled === true
  const paymentBatchEnabled = me?.settings?.vendor_payment_batch_enabled === true
  const whtEnabled = me?.settings?.procurement_withholding_tax_enabled === true
  const invoiceNeedApproval = me?.settings?.vendor_invoice_need_approval === true
  const canCreate = can('vendorinvoices', 'create')
  const canEdit = can('vendorinvoices', 'edit')

  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [matchFilter, setMatchFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<InvoiceRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [poOptions, setPoOptions] = useState<Array<{ id: number; number: string; supplier_id?: number | null }>>([])
  const [grOptions, setGrOptions] = useState<Array<{ id: number; number: string; supplier_id?: number | null }>>([])
  const [supplierId, setSupplierId] = useState('')
  const [poId, setPoId] = useState('')
  const [grId, setGrId] = useState('')
  const [vendorRef, setVendorRef] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState('')
  const [taxPercent, setTaxPercent] = useState('11')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<InvoiceLineDraft[]>([emptyPurchaseLine()])
  const [approvers, setApprovers] = useState<ApprovalDraft[]>([])

  const { options: supplierOptions } = useSupplierSelect(suppliers)
  const productOptions = useMemo(() => buildProductOptions(products), [products])
  const memberOptions = useMemo(() => buildApproverMemberOptions(members, approvers.map((a) => a.user_id)), [members, approvers])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'submitted', label: t('purchaseStatusSubmitted') },
      { value: 'approved', label: t('purchaseStatusApproved') },
      { value: 'confirmed', label: t('purchaseStatusConfirmed') },
      { value: 'rejected', label: t('purchaseStatusRejected') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ],
    [t],
  )

  const matchStatusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'pending', label: t('procurementMatchStatusPending') },
      { value: 'matched', label: t('procurementMatchStatusMatched') },
      { value: 'exception', label: t('procurementMatchStatusException') },
    ],
    [t],
  )

  function paymentStatusLabel(status?: string | null) {
    if (status === 'paid') return t('procurementPaymentStatusPaid')
    if (status === 'partial') return t('procurementPaymentStatusPartial')
    if (status === 'unpaid') return t('procurementPaymentStatusUnpaid')
    return '—'
  }

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<InvoiceRow[]>>('/vendor-invoices', {
        params: {
          page: list.page,
          per_page: list.perPage,
          search: list.search || undefined,
          status: list.status !== 'all' ? list.status : undefined,
          match_status: matchFilter !== 'all' ? matchFilter : undefined,
        },
      })
      setRows(data.data ?? [])
      list.applyMeta(data.meta, data.data?.length ?? 0)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    if (!invoiceEnabled) return
    void loadRows()
  }, [list.page, list.perPage, list.search, list.status, matchFilter, invoiceEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!invoiceEnabled) return
    void Promise.all([
      api.get<ApiOk<Product[]>>('/products', { params: { for_select: 1, status: 'active', per_page: 500 }, silent: true }),
      api.get<ApiOk<Party[]>>('/suppliers', { params: { for_select: 1, status: 'active', per_page: 200 }, silent: true }),
      api.get<ApiOk<Member[]>>('/company/members', { params: { per_page: 200 }, silent: true }),
      api.get<ApiOk<Array<{ id: number; number: string; supplier_id?: number | null }>>>('/purchase-orders', {
        params: { status: 'ordered', per_page: 100 },
        silent: true,
      }),
      api.get<ApiOk<Array<{ id: number; number: string; supplier_id?: number | null }>>>('/goods-receipts', {
        params: { status: 'confirmed', per_page: 100 },
        silent: true,
      }),
    ]).then(([productsRes, suppliersRes, membersRes, poRes, grRes]) => {
      setProducts(productsRes.data.data ?? [])
      setSuppliers(suppliersRes.data.data ?? [])
      setMembers(membersRes.data.data ?? [])
      setPoOptions(poRes.data.data ?? [])
      setGrOptions(grRes.data.data ?? [])
    })
  }, [invoiceEnabled])

  function resetForm() {
    setEditing(null)
    setSupplierId('')
    setPoId('')
    setGrId('')
    setVendorRef('')
    setInvoiceDate(todayIso())
    setDueDate('')
    setTaxPercent('11')
    setNote('')
    setLines([emptyPurchaseLine()])
    setApprovers([])
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm('vendorinvoice', 'create')
  }

  async function openEdit(row: InvoiceRow) {
    try {
      const { data } = await api.get<ApiOk<InvoiceRow>>(`/vendor-invoices/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setSupplierId(doc.supplier?.id?.toString() ?? '')
      setPoId(doc.purchase_order?.id?.toString() ?? '')
      setGrId(doc.goods_receipt?.id?.toString() ?? '')
      setVendorRef(doc.vendor_ref ?? '')
      setInvoiceDate(doc.invoice_date ?? todayIso())
      setDueDate(doc.due_date ?? '')
      setTaxPercent(String(doc.tax_percent ?? 11))
      setNote(doc.note ?? '')
      setApprovers(
        (doc.approvals ?? [])
          .slice()
          .sort((a, b) => a.level - b.level)
          .map((step) => ({
            key: uuid(),
            user_id: step.user_id,
            name: step.user?.name ?? `#${step.user_id}`,
            position: step.user?.position ?? null,
          })),
      )
      setLines(
        ensureTrailingEmptyPurchaseLine(
          (doc.items ?? []).map((item) => ({
            key: uuid(),
            product_id: item.product_id,
            name: item.name_snapshot,
            qty: item.qty,
            unit: item.unit ?? '',
            unit_level: (item.unit_level as ProductUnitLevel) || 'small',
            unit_cost: item.unit_cost ?? 0,
            purchase_order_item_id: item.purchase_order_item_id ?? undefined,
            goods_receipt_item_id: item.goods_receipt_item_id ?? undefined,
            discount: item.discount ?? 0,
          })),
        ),
      )
      setOpen(true)
      logMasterForm('vendorinvoice', 'edit', doc.number)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function fillFromGr(id: string) {
    setGrId(id)
    if (!id) return
    try {
      const { data } = await api.get<ApiOk<GrDoc>>(`/goods-receipts/${id}`)
      const doc = data.data
      setGrOptions((current) => (current.some((row) => row.id === doc.id) ? current : [{ id: doc.id, number: doc.number, supplier_id: doc.supplier_id }, ...current]))
      setSupplierId(doc.supplier?.id?.toString() ?? '')
      if (doc.purchase_order_id) {
        setPoId(String(doc.purchase_order_id))
        setPoOptions((current) =>
          doc.purchase_order && !current.some((row) => row.id === doc.purchase_order!.id)
            ? [{ id: doc.purchase_order.id, number: doc.purchase_order.number, supplier_id: doc.supplier_id }, ...current]
            : current,
        )
      }
      setLines(
        ensureTrailingEmptyPurchaseLine(
          (doc.items ?? []).map((item) => ({
            key: uuid(),
            product_id: item.product_id,
            name: item.name_snapshot,
            qty: item.qty,
            unit: item.unit ?? '',
            unit_level: (item.unit_level as ProductUnitLevel) || 'small',
            unit_cost: item.unit_cost ?? 0,
            purchase_order_item_id: item.purchase_order_item_id ?? undefined,
            goods_receipt_item_id: item.id,
          })),
        ),
      )
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function fillFromPo(id: string) {
    setPoId(id)
    if (!id) return
    try {
      const { data } = await api.get<ApiOk<{ id: number; number: string; supplier?: { id: number; name: string } | null; items?: Array<{ id: number; product_id: number; name_snapshot: string; qty: number; qty_remaining?: number; unit?: string; unit_level?: ProductUnitLevel; unit_cost: number }> }>>(
        `/purchase-orders/${id}`,
      )
      const doc = data.data
      setPoOptions((current) => (current.some((row) => row.id === doc.id) ? current : [{ id: doc.id, number: doc.number, supplier_id: doc.supplier?.id }, ...current]))
      setSupplierId(doc.supplier?.id?.toString() ?? '')
      setLines(
        ensureTrailingEmptyPurchaseLine(
          (doc.items ?? [])
            .filter((item) => (item.qty_remaining ?? item.qty) > 0)
            .map((item) => ({
              key: uuid(),
              product_id: item.product_id,
              name: item.name_snapshot,
              qty: item.qty_remaining ?? item.qty,
              unit: item.unit ?? '',
              unit_level: (item.unit_level as ProductUnitLevel) || 'small',
              unit_cost: item.unit_cost ?? 0,
              purchase_order_item_id: item.id,
            })),
        ),
      )
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  function addApprover(userId: string) {
    const id = Number(userId)
    const member = members.find((m) => m.id === id)
    if (!member || approvers.some((a) => a.user_id === id)) return
    setApprovers((current) => [
      ...current,
      { key: uuid(), user_id: member.id, name: member.name, position: member.position?.name ?? null },
    ])
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const filled = lines.filter((line) => line.product_id > 0 && line.qty > 0)
    if (!supplierId || filled.length === 0) {
      setError(t('purchaseNeedItems'))
      return
    }
    if (invoiceNeedApproval && approvers.length === 0) {
      setError(t('purchaseNeedApprovers'))
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      supplier_id: Number(supplierId),
      purchase_order_id: poId ? Number(poId) : null,
      goods_receipt_id: grId ? Number(grId) : null,
      vendor_ref: vendorRef || undefined,
      invoice_date: invoiceDate || undefined,
      due_date: dueDate || undefined,
      tax_percent: Number(taxPercent) || 0,
      note: note || undefined,
      items: filled.map((line) => ({
        product_id: line.product_id,
        qty: line.qty,
        unit_cost: line.unit_cost,
        discount: line.discount ?? 0,
        unit: line.unit || undefined,
        unit_level: line.unit_level || undefined,
        purchase_order_item_id: line.purchase_order_item_id ?? undefined,
        goods_receipt_item_id: line.goods_receipt_item_id ?? undefined,
      })),
      approvals: invoiceNeedApproval ? approvers.map((row) => ({ user_id: row.user_id })) : [],
    }
    try {
      if (editing) {
        await api.put(`/vendor-invoices/${editing.id}`, payload)
      } else {
        await api.post('/vendor-invoices', { ...payload, client_uuid: uuid() })
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

  async function runAction(row: InvoiceRow, action: string, body?: Record<string, unknown>) {
    try {
      await api.post(`/vendor-invoices/${row.id}/${action}`, body)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function statusLabel(status: string) {
    const map: Record<string, MsgKey> = {
      draft: 'purchaseStatusDraft',
      submitted: 'purchaseStatusSubmitted',
      approved: 'purchaseStatusApproved',
      confirmed: 'purchaseStatusConfirmed',
      rejected: 'purchaseStatusRejected',
      cancelled: 'purchaseStatusCancelled',
    }
    return t(map[status] ?? 'purchaseStatusDraft')
  }

  function matchStatusLabel(status?: string | null) {
    if (!status) return '—'
    const map: Record<string, MsgKey> = {
      pending: 'procurementMatchStatusPending',
      matched: 'procurementMatchStatusMatched',
      exception: 'procurementMatchStatusException',
    }
    return t(map[status] ?? 'procurementMatchStatusPending')
  }

  const filteredPoOptions = useMemo(() => {
    if (!supplierId) return poOptions
    return poOptions.filter((row) => !row.supplier_id || row.supplier_id === Number(supplierId))
  }, [poOptions, supplierId])

  const filteredGrOptions = useMemo(() => {
    if (!supplierId) return grOptions
    return grOptions.filter((row) => !row.supplier_id || row.supplier_id === Number(supplierId))
  }, [grOptions, supplierId])

  if (!invoiceEnabled) {
    return (
      <div>
        <PageHeader eyebrow={t('appProcurement')} title={t('procurementInvoiceTitle')} subtitle={t('procurementInvoiceSubtitle')} />
        <p className="text-sm text-muted">{t('procurementInvoiceDisabledHint')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appProcurement')}
        title={t('procurementInvoiceTitle')}
        subtitle={t('procurementInvoiceSubtitle')}
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('procurementInvoiceAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('procurementInvoiceSearch')}
        statusOptions={statusOptions}
        extra={
          matchEnabled ? (
            <select className="field !mt-0 w-auto min-w-[10rem]" value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)}>
              {matchStatusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null
        }
      />

      <div className="glass overflow-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('number')}</th>
              <th className="px-4 py-3">{t('navSuppliers')}</th>
              <th className="px-4 py-3">{t('procurementInvoiceVendorRef')}</th>
              <th className="px-4 py-3">{t('purchaseGrandTotal')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              {matchEnabled ? <th className="px-4 py-3">{t('procurementMatchStatus')}</th> : null}
              {paymentBatchEnabled ? <th className="px-4 py-3">{t('procurementInvoicePaymentStatus')}</th> : null}
              {whtEnabled ? <th className="px-4 py-3">{t('procurementInvoiceWithholding')}</th> : null}
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">{row.number}</td>
                <td className="px-4 py-3">{row.supplier?.name ?? '—'}</td>
                <td className="px-4 py-3">{row.vendor_ref || '—'}</td>
                <td className="px-4 py-3 tabular-nums">{formatRupiah(row.total ?? 0, locale)}</td>
                <td className="px-4 py-3">{statusLabel(row.status)}</td>
                {matchEnabled ? (
                  <td className="px-4 py-3">
                    {matchStatusLabel(row.match_status)}
                    {(row.match_exception_open ?? 0) > 0 ? (
                      <span className="ml-1 text-xs text-rose-500">({row.match_exception_open})</span>
                    ) : null}
                  </td>
                ) : null}
                {paymentBatchEnabled ? (
                  <td className="px-4 py-3">
                    {row.status === 'confirmed' ? paymentStatusLabel(row.payment_status) : '—'}
                    {row.status === 'confirmed' && (row.amount_due ?? 0) > 0 ? (
                      <div className="text-xs text-muted tabular-nums">{formatRupiah(row.amount_due ?? 0, locale)}</div>
                    ) : null}
                  </td>
                ) : null}
                {whtEnabled ? (
                  <td className="px-4 py-3 tabular-nums">
                    {(row.withholding_tax ?? 0) > 0 ? (
                      <>
                        <div>{formatRupiah(row.withholding_tax ?? 0, locale)}</div>
                        <div className="text-xs text-muted">{formatRupiah(row.amount_payable ?? row.total ?? 0, locale)}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {canEdit && ['draft', 'rejected'].includes(row.status) ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void openEdit(row)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {canEdit && ['draft', 'rejected'].includes(row.status) ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'submit')}>
                        {t('purchaseSubmit')}
                      </button>
                    ) : null}
                    {canEdit && row.status === 'submitted' && row.can_approve ? (
                      <>
                        <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'approve')}>
                          {t('purchaseApprove')}
                        </button>
                        <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'reject')}>
                          {t('purchaseReject')}
                        </button>
                      </>
                    ) : null}
                    {canEdit && matchEnabled && ['approved', 'submitted'].includes(row.status) ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'match')}>
                        {t('procurementMatchRun')}
                      </button>
                    ) : null}
                    {canEdit && row.status === 'approved' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'confirm')}>
                        {t('procurementInvoiceConfirm')}
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
        title={editing ? t('procurementInvoiceEdit') : t('procurementInvoiceCreate')}
        error={error}
        saving={saving}
        mobileFullscreen
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
      >
        <label className="block text-sm text-muted">
          {t('navSuppliers')}
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
          <label className="block text-sm text-muted">
            {t('purchasePoTitle')}
            <select className="field" value={poId} onChange={(e) => void fillFromPo(e.target.value)} disabled={Boolean(editing)}>
              <option value="">{t('filterAll')}</option>
              {filteredPoOptions.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.number}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-muted">
            {t('purchaseGrTitle')}
            <select className="field" value={grId} onChange={(e) => void fillFromGr(e.target.value)} disabled={Boolean(editing)}>
              <option value="">{t('filterAll')}</option>
              {filteredGrOptions.map((gr) => (
                <option key={gr.id} value={gr.id}>
                  {gr.number}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-muted">
            {t('procurementInvoiceVendorRef')}
            <input className="field" value={vendorRef} onChange={(e) => setVendorRef(e.target.value)} placeholder={t('procurementInvoiceVendorRefHint')} />
          </label>
          <label className="block text-sm text-muted">
            {t('purchaseTax')} (%)
            <input className="field" type="number" min={0} max={100} step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-muted">
            {t('procurementInvoiceDate')}
            <input className="field" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </label>
          <label className="block text-sm text-muted">
            {t('procurementInvoiceDueDate')}
            <input className="field" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm text-muted">
          {t('purchaseNote')}
          <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {invoiceNeedApproval ? (
          <div className="rounded-2xl border border-line p-3">
            <div className="mb-1 text-sm font-medium text-fg">{t('purchaseApprovers')}</div>
            <div className="mb-2 text-[11px] text-muted">{t('purchaseApproversHint')}</div>
            <AutocompleteSelect
              key={open ? 'open' : 'closed'}
              className="!mt-0 mb-2"
              options={memberOptions}
              placeholder={t('purchaseSearchApprover')}
              onSelect={addApprover}
            />
            <div className="space-y-1.5">
              {approvers.map((row, index) => (
                <div key={row.key} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5 text-sm">
                  <span className="w-16 shrink-0 text-[11px] uppercase text-muted">
                    {t('purchaseApprovalLevel', { n: String(index + 1) })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{approvalRowLabel(row)}</span>
                  <button type="button" className="btn-ghost !px-2" onClick={() => setApprovers((c) => c.filter((a) => a.key !== row.key))}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <PurchaseLineEditor
          lines={lines}
          setLines={setLines}
          products={products}
          productOptions={productOptions}
          needsCost
        />
      </MasterModal>
    </div>
  )
}
