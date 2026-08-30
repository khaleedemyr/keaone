import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Member, Party } from '../../types'
import { AutocompleteSelect } from '../../components/AutocompleteSelect'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterModal } from '../../components/MasterModal'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { SearchSelect } from '../../components/SearchSelect'
import { approvalRowLabel, buildApproverMemberOptions } from './approverOptions'
import { useSupplierSelect } from './useSupplierSelect'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'
import { purchaseLineUuid } from './purchaseLineUtils'
import { formatRupiah } from '../../lib/money'

type PayableInvoice = {
  id: number
  number: string
  vendor_ref?: string | null
  total?: number
  amount_paid?: number
  amount_due?: number
  supplier?: { id: number; name: string } | null
}

type ApplyItemDraft = {
  key: string
  vendor_invoice_id: number
  number: string
  invoice_total: number
  amount_due: number
  amount: number
}

type ApprovalDraft = {
  key: string
  user_id: number
  name: string
  position?: string | null
}

type PrepaymentRow = {
  id: number
  number: string
  client_uuid?: string
  status: string
  amount: number
  amount_applied: number
  amount_balance: number
  payment_method?: string | null
  note?: string | null
  paid_at?: string | null
  can_approve?: boolean
  prepayment_need_approval?: boolean
  user?: { id: number; name: string } | null
  supplier?: { id: number; name: string } | null
  purchase_order?: { id: number; number: string } | null
  approvals?: Array<{
    level: number
    user_id: number
    user?: { id: number; name: string; position?: string | null } | null
  }>
  applications?: Array<{
    id: number
    vendor_invoice_id: number
    amount: number
    applied_at?: string | null
    is_planned?: boolean
    vendor_invoice?: PayableInvoice | null
  }>
}

type PoOption = { id: number; number: string }

function uuid() {
  return purchaseLineUuid()
}

export default function VendorPrepaymentDocs() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const prepaymentEnabled = me?.settings?.vendor_prepayment_enabled === true
  const prepaymentNeedApproval = me?.settings?.vendor_prepayment_need_approval === true
  const canCreate = can('vendorprepayments', 'create')
  const canEdit = can('vendorprepayments', 'edit')

  const [rows, setRows] = useState<PrepaymentRow[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [approvers, setApprovers] = useState<ApprovalDraft[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [open, setOpen] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [editing, setEditing] = useState<PrepaymentRow | null>(null)
  const [applyTarget, setApplyTarget] = useState<PrepaymentRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [poId, setPoId] = useState('')
  const [amount, setAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [note, setNote] = useState('')
  const [poOptions, setPoOptions] = useState<PoOption[]>([])
  const [payableInvoices, setPayableInvoices] = useState<PayableInvoice[]>([])
  const [invoiceItems, setInvoiceItems] = useState<ApplyItemDraft[]>([])
  const [applyItems, setApplyItems] = useState<ApplyItemDraft[]>([])
  const [amountManual, setAmountManual] = useState(false)

  const invoiceItemsTotal = useMemo(() => invoiceItems.reduce((sum, row) => sum + (row.amount || 0), 0), [invoiceItems])
  const availableInvoices = useMemo(
    () => payableInvoices.filter((inv) => !invoiceItems.some((row) => row.vendor_invoice_id === inv.id)),
    [payableInvoices, invoiceItems],
  )
  const availableApplyInvoices = useMemo(
    () => payableInvoices.filter((inv) => !applyItems.some((row) => row.vendor_invoice_id === inv.id)),
    [payableInvoices, applyItems],
  )

  const { options: supplierOptions } = useSupplierSelect(suppliers)
  const memberOptions = useMemo(
    () => buildApproverMemberOptions(members, approvers.map((a) => a.user_id)),
    [members, approvers],
  )

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'submitted', label: t('procurementPrepaymentStatusSubmitted') },
      { value: 'approved', label: t('procurementPrepaymentStatusApproved') },
      { value: 'rejected', label: t('purchaseStatusRejected') },
      { value: 'paid', label: t('procurementPrepaymentStatusPaid') },
      { value: 'applied', label: t('procurementPrepaymentStatusApplied') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ],
    [t],
  )

  const methodOptions = useMemo(
    () => [
      { value: 'cash', label: t('cash') },
      { value: 'transfer', label: t('transfer') },
      { value: 'qris', label: t('qris') },
    ],
    [t],
  )

  const statusLabel = useMemo(
    () =>
      ({
        draft: t('purchaseStatusDraft'),
        submitted: t('procurementPrepaymentStatusSubmitted'),
        approved: t('procurementPrepaymentStatusApproved'),
        rejected: t('purchaseStatusRejected'),
        paid: t('procurementPrepaymentStatusPaid'),
        applied: t('procurementPrepaymentStatusApplied'),
        cancelled: t('purchaseStatusCancelled'),
      }) as Record<string, string>,
    [t],
  )

  const poSelectOptions = useMemo(
    () => [
      { value: '', label: t('procurementPrepaymentNoPo') },
      ...poOptions.map((row) => ({ value: String(row.id), label: row.number })),
    ],
    [poOptions, t],
  )

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<PrepaymentRow[]>>('/vendor-prepayments', {
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

  async function loadSuppliers() {
    try {
      const { data } = await api.get<ApiOk<Party[]>>('/suppliers', { params: { per_page: 500 }, silent: true })
      setSuppliers(data.data ?? [])
    } catch {
      setSuppliers([])
    }
  }

  async function loadPoOptions(nextSupplierId: string) {
    if (!nextSupplierId) {
      setPoOptions([])
      return
    }
    try {
      const { data } = await api.get<ApiOk<Array<{ id: number; number: string; status: string }>>>('/purchase-orders', {
        params: { supplier_id: nextSupplierId, per_page: 100, status: 'ordered' },
        silent: true,
      })
      const partial = await api.get<ApiOk<Array<{ id: number; number: string; status: string }>>>('/purchase-orders', {
        params: { supplier_id: nextSupplierId, per_page: 100, status: 'partial' },
        silent: true,
      })
      const received = await api.get<ApiOk<Array<{ id: number; number: string; status: string }>>>('/purchase-orders', {
        params: { supplier_id: nextSupplierId, per_page: 100, status: 'received' },
        silent: true,
      })
      const merged = [...(data.data ?? []), ...(partial.data.data ?? []), ...(received.data.data ?? [])]
      const seen = new Set<number>()
      setPoOptions(merged.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true))))
    } catch {
      setPoOptions([])
    }
  }

  async function loadPayableInvoices(nextSupplierId: number) {
    try {
      const { data } = await api.get<ApiOk<PayableInvoice[]>>('/vendor-invoices', {
        params: { payment_status: 'payable', supplier_id: nextSupplierId, per_page: 200 },
        silent: true,
      })
      setPayableInvoices(data.data ?? [])
    } catch {
      setPayableInvoices([])
    }
  }

  useEffect(() => {
    if (!prepaymentEnabled) return
    void loadRows()
    void loadSuppliers()
    void api.get<ApiOk<Member[]>>('/company/members', { params: { per_page: 200 }, silent: true }).then(({ data }) => {
      setMembers(data.data ?? [])
    })
  }, [list.page, list.perPage, list.search, list.status, prepaymentEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setEditing(null)
    setSupplierId('')
    setPoId('')
    setAmount(0)
    setPaymentMethod('transfer')
    setNote('')
    setPoOptions([])
    setInvoiceItems([])
    setAmountManual(false)
    setApprovers([])
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm('vendorprepayment', 'create')
  }

  async function openEdit(row: PrepaymentRow) {
    try {
      const { data } = await api.get<ApiOk<PrepaymentRow>>(`/vendor-prepayments/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setSupplierId(doc.supplier?.id?.toString() ?? '')
      setPoId(doc.purchase_order?.id?.toString() ?? '')
      setPaymentMethod(doc.payment_method ?? 'transfer')
      setNote(doc.note ?? '')
      const planned = (doc.applications ?? []).filter((row) => !row.applied_at)
      setInvoiceItems(
        planned.map((row) => ({
          key: uuid(),
          vendor_invoice_id: row.vendor_invoice_id,
          number: row.vendor_invoice?.number ?? `#${row.vendor_invoice_id}`,
          invoice_total: row.vendor_invoice?.total ?? row.amount,
          amount_due:
            row.vendor_invoice?.amount_due ??
            Math.max(0, (row.vendor_invoice?.total ?? 0) - (row.vendor_invoice?.amount_paid ?? 0)),
          amount: row.amount,
        })),
      )
      setAmountManual(planned.length === 0)
      setAmount(doc.amount ?? 0)
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
      setOpen(true)
      logMasterForm('vendorprepayment', 'edit', doc.number)
      if (doc.supplier?.id) {
        void loadPoOptions(String(doc.supplier.id))
        void loadPayableInvoices(doc.supplier.id)
      }
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  function onSupplierChange(nextSupplierId: string) {
    setSupplierId(nextSupplierId)
    setPoId('')
    setInvoiceItems([])
    setAmountManual(false)
    void loadPoOptions(nextSupplierId)
    if (nextSupplierId) void loadPayableInvoices(Number(nextSupplierId))
    else setPayableInvoices([])
  }

  function invoiceDue(inv: PayableInvoice) {
    return inv.amount_due ?? Math.max(0, (inv.total ?? 0) - (inv.amount_paid ?? 0))
  }

  function addInvoiceItem(invoiceId: string) {
    const id = Number(invoiceId)
    if (!id || invoiceItems.some((row) => row.vendor_invoice_id === id)) return
    const inv = payableInvoices.find((row) => row.id === id)
    if (!inv) return
    const due = invoiceDue(inv)
    const nextItems = [
      ...invoiceItems,
      {
        key: uuid(),
        vendor_invoice_id: inv.id,
        number: inv.number,
        invoice_total: inv.total ?? due,
        amount_due: due,
        amount: due,
      },
    ]
    setInvoiceItems(nextItems)
    if (!amountManual) setAmount(nextItems.reduce((sum, row) => sum + row.amount, 0))
  }

  function updateInvoiceItemAmount(key: string, nextAmount: number) {
    const nextItems = invoiceItems.map((row) =>
      row.key === key ? { ...row, amount: Math.max(0, Math.min(nextAmount, row.amount_due)) } : row,
    )
    setInvoiceItems(nextItems)
    if (!amountManual) setAmount(nextItems.reduce((sum, row) => sum + row.amount, 0))
  }

  function removeInvoiceItem(key: string) {
    const nextItems = invoiceItems.filter((row) => row.key !== key)
    setInvoiceItems(nextItems)
    if (!amountManual) setAmount(nextItems.reduce((sum, row) => sum + row.amount, 0))
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
    if (!supplierId || amount < 1) {
      setError(t('procurementPrepaymentAmountRequired'))
      return
    }
    if (prepaymentNeedApproval && approvers.length === 0) {
      setError(t('purchaseNeedApprovers'))
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      ...(editing ? {} : { client_uuid: uuid() }),
      supplier_id: Number(supplierId),
      purchase_order_id: poId ? Number(poId) : null,
      amount,
      payment_method: paymentMethod,
      note: note || null,
      items: invoiceItems.map((row) => ({
        vendor_invoice_id: row.vendor_invoice_id,
        amount: row.amount,
      })),
      approvals: prepaymentNeedApproval ? approvers.map((row) => ({ user_id: row.user_id })) : [],
    }
    try {
      if (editing) await api.put(`/vendor-prepayments/${editing.id}`, payload)
      else await api.post('/vendor-prepayments', payload)
      setOpen(false)
      await loadRows()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(row: PrepaymentRow, action: string) {
    const labelMap: Record<string, string> = {
      submit: t('procurementPrepaymentSubmit'),
      pay: t('procurementPrepaymentPay'),
      approve: t('purchaseApprove'),
      reject: t('purchaseReject'),
      cancel: t('cancel'),
    }
    const ok = await feedback.confirm({
      title: labelMap[action] ?? action,
      message: t('procurementPrepaymentActionConfirm', { number: row.number }),
      confirmLabel: labelMap[action] ?? action,
      tone: action === 'cancel' || action === 'reject' ? 'danger' : 'default',
    })
    if (!ok) return
    try {
      await api.post(`/vendor-prepayments/${row.id}/${action}`)
      await loadRows()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function canPay(row: PrepaymentRow) {
    if (prepaymentNeedApproval) return row.status === 'approved'
    return row.status === 'draft'
  }

  async function openApply(row: PrepaymentRow) {
    try {
      const { data } = await api.get<ApiOk<PrepaymentRow>>(`/vendor-prepayments/${row.id}`)
      const doc = data.data
      setApplyTarget(doc)
      const planned = (doc.applications ?? []).filter((app) => !app.applied_at)
      setApplyItems(
        planned.length > 0
          ? planned.map((app) => ({
              key: uuid(),
              vendor_invoice_id: app.vendor_invoice_id,
              number: app.vendor_invoice?.number ?? `#${app.vendor_invoice_id}`,
              invoice_total: app.vendor_invoice?.total ?? app.amount,
              amount_due:
                app.vendor_invoice?.amount_due ??
                Math.max(0, (app.vendor_invoice?.total ?? 0) - (app.vendor_invoice?.amount_paid ?? 0)),
              amount: Math.min(app.amount, doc.amount_balance ?? app.amount),
            }))
          : [],
      )
      setError('')
      setApplyOpen(true)
      if (doc.supplier?.id) void loadPayableInvoices(doc.supplier.id)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  function addApplyInvoice(invoiceId: string) {
    const id = Number(invoiceId)
    if (!id || applyItems.some((row) => row.vendor_invoice_id === id)) return
    const inv = payableInvoices.find((row) => row.id === id)
    if (!inv) return
    const due = invoiceDue(inv)
    setApplyItems([
      ...applyItems,
      {
        key: uuid(),
        vendor_invoice_id: inv.id,
        number: inv.number,
        invoice_total: inv.total ?? due,
        amount_due: due,
        amount: Math.min(due, applyTarget?.amount_balance ?? due),
      },
    ])
  }

  function updateApplyAmount(key: string, nextAmount: number) {
    setApplyItems(applyItems.map((row) => (row.key === key ? { ...row, amount: Math.max(0, nextAmount) } : row)))
  }

  function removeApplyItem(key: string) {
    setApplyItems(applyItems.filter((row) => row.key !== key))
  }

  async function submitApply(event: FormEvent) {
    event.preventDefault()
    if (!applyTarget || applyItems.length === 0) {
      setError(t('procurementPrepaymentItemsRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.post(`/vendor-prepayments/${applyTarget.id}/apply`, {
        items: applyItems.map((row) => ({
          vendor_invoice_id: row.vendor_invoice_id,
          amount: row.amount,
        })),
      })
      setApplyOpen(false)
      await loadRows()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  const applyTotal = applyItems.reduce((sum, row) => sum + (row.amount || 0), 0)

  if (!prepaymentEnabled) {
    return (
      <div>
        <PageHeader eyebrow={t('appProcurement')} title={t('procurementPrepaymentTitle')} subtitle={t('procurementPrepaymentSubtitle')} />
        <p className="text-sm text-muted">{t('procurementPrepaymentDisabledHint')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appProcurement')}
        title={t('procurementPrepaymentTitle')}
        subtitle={t('procurementPrepaymentSubtitle')}
        action={
          canCreate ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('procurementPrepaymentAdd')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder={t('procurementPrepaymentSearch')}
        status={list.status}
        onStatusChange={list.setStatus}
        statusOptions={statusOptions}
      />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3">{t('number')}</th>
              <th className="px-4 py-3">{t('supplier')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3 text-right">{t('procurementPrepaymentAmount')}</th>
              <th className="px-4 py-3 text-right">{t('procurementPrepaymentBalance')}</th>
              <th className="px-4 py-3 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {t('procurementPrepaymentEmpty')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{row.number}</td>
                  <td className="px-4 py-3">{row.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3">{statusLabel[row.status] ?? row.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(row.amount, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(row.amount_balance ?? 0, locale)}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && ['draft', 'rejected'].includes(row.status) ? (
                      <>
                        <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void openEdit(row)}>
                          {t('edit')}
                        </button>
                        {prepaymentNeedApproval ? (
                          <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'submit')}>
                            {t('procurementPrepaymentSubmit')}
                          </button>
                        ) : null}
                        {row.status === 'draft' ? (
                          <button type="button" className="btn-ghost !px-2 !text-xs text-rose-400" onClick={() => void runAction(row, 'cancel')}>
                            {t('cancel')}
                          </button>
                        ) : null}
                      </>
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
                    {canEdit && canPay(row) ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'pay')}>
                        {t('procurementPrepaymentPay')}
                      </button>
                    ) : null}
                    {row.status === 'paid' && (row.amount_balance ?? 0) > 0 && canEdit ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => openApply(row)}>
                        {t('procurementPrepaymentApply')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} pages={list.pages} onPageChange={list.setPage} />

      <MasterModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('procurementPrepaymentEdit') : t('procurementPrepaymentCreate')}
        size="lg"
        error={error}
        saving={saving}
        onSubmit={onSubmit}
      >
        <label className="block text-sm text-muted">
          {t('supplier')}
          <SearchSelect
            value={supplierId}
            onChange={onSupplierChange}
            options={supplierOptions}
            placeholder={t('purchaseSelectSupplier')}
            disabled={Boolean(editing && editing.status !== 'draft')}
          />
        </label>
        <label className="block text-sm text-muted">
          {t('purchasePoTitle')}
          <SearchSelect value={poId} onChange={setPoId} options={poSelectOptions} placeholder={t('procurementPrepaymentPickPo')} disabled={!supplierId} />
        </label>

        <div className="space-y-2">
          <div>
            <div className="text-sm font-medium text-fg">{t('procurementPaymentInvoices')}</div>
            <p className="mt-0.5 text-xs text-muted">{t('procurementPrepaymentInvoicesHint')}</p>
          </div>
          {supplierId && availableInvoices.length > 0 ? (
            <select
              className="field"
              defaultValue=""
              onChange={(e) => {
                addInvoiceItem(e.target.value)
                e.target.value = ''
              }}
            >
              <option value="">{t('procurementPaymentPickInvoice')}</option>
              {availableInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} · {t('total')}: {formatRupiah(inv.total ?? 0, locale)} · {t('procurementPaymentDue')}:{' '}
                  {formatRupiah(invoiceDue(inv), locale)}
                </option>
              ))}
            </select>
          ) : supplierId ? (
            <p className="text-xs text-muted">{t('procurementPaymentNoPayable')}</p>
          ) : (
            <p className="text-xs text-muted">{t('purchaseSelectSupplier')}</p>
          )}

          {invoiceItems.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-fg">{row.number}</div>
                <div className="text-xs text-muted">
                  {t('total')}: {formatRupiah(row.invoice_total, locale)} · {t('procurementPaymentDue')}:{' '}
                  {formatRupiah(row.amount_due, locale)}
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={row.amount_due}
                className="field w-36"
                value={row.amount || ''}
                onChange={(e) => updateInvoiceItemAmount(row.key, Number(e.target.value) || 0)}
              />
              <button type="button" className="text-sm text-rose-300" onClick={() => removeInvoiceItem(row.key)}>
                {t('delete')}
              </button>
            </div>
          ))}

          {invoiceItems.length > 0 ? (
            <p className="text-right text-sm font-medium tabular-nums text-fg">
              {t('procurementPrepaymentInvoiceTotal')}: {formatRupiah(invoiceItemsTotal, locale)}
            </p>
          ) : null}
        </div>

        <label className="block text-sm text-muted">
          {t('procurementPrepaymentAmount')}
          <input
            type="number"
            min={1}
            className="field"
            value={amount || ''}
            onChange={(e) => {
              setAmountManual(true)
              setAmount(Number(e.target.value) || 0)
            }}
            required
          />
          {invoiceItems.length > 0 && !amountManual ? (
            <span className="mt-1 block text-xs text-muted">{t('procurementPrepaymentAmountAutoHint')}</span>
          ) : null}
        </label>
        <label className="block text-sm text-muted">
          {t('procurementPaymentMethod')}
          <select className="field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {methodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-muted">
          {t('purchaseNote')}
          <textarea className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {prepaymentNeedApproval ? (
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
      </MasterModal>

      <MasterModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title={t('procurementPrepaymentApplyTitle')}
        size="lg"
        error={error}
        saving={saving}
        onSubmit={submitApply}
        submitLabel={t('procurementPrepaymentApply')}
        submitDisabled={applyItems.length === 0}
      >
        {applyTarget ? (
          <p className="text-sm text-muted">
            {applyTarget.number} · {t('procurementPrepaymentBalance')}: {formatRupiah(applyTarget.amount_balance ?? 0, locale)}
          </p>
        ) : null}
        {availableApplyInvoices.length > 0 ? (
          <label className="block text-sm text-muted">
            {t('procurementPaymentInvoices')}
            <select
              className="field"
              defaultValue=""
              onChange={(e) => {
                addApplyInvoice(e.target.value)
                e.target.value = ''
              }}
            >
              <option value="">{t('procurementPaymentPickInvoice')}</option>
              {availableApplyInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} · {t('total')}: {formatRupiah(inv.total ?? 0, locale)} · {t('procurementPaymentDue')}:{' '}
                  {formatRupiah(invoiceDue(inv), locale)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-muted">{t('procurementPaymentNoPayable')}</p>
        )}
        {applyItems.length > 0 ? (
          <div className="space-y-2">
            {applyItems.map((row) => (
              <div key={row.key} className="flex items-center gap-2 rounded-2xl border border-line px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.number}</p>
                  <p className="text-xs text-muted">
                    {t('total')}: {formatRupiah(row.invoice_total, locale)} · {t('procurementPaymentDue')}:{' '}
                    {formatRupiah(row.amount_due, locale)}
                  </p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={row.amount_due}
                  className="field w-32"
                  value={row.amount || ''}
                  onChange={(e) => updateApplyAmount(row.key, Number(e.target.value) || 0)}
                />
                <button type="button" className="btn-ghost !px-2" onClick={() => removeApplyItem(row.key)}>
                  ×
                </button>
              </div>
            ))}
            <p className="text-right text-sm font-medium tabular-nums">
              {t('total')}: {formatRupiah(applyTotal, locale)}
            </p>
          </div>
        ) : null}
      </MasterModal>
    </div>
  )
}
