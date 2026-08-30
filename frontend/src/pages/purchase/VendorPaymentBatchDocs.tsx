import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Member } from '../../types'
import { AutocompleteSelect } from '../../components/AutocompleteSelect'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterModal } from '../../components/MasterModal'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'
import { approvalRowLabel, buildApproverMemberOptions } from './approverOptions'
import { purchaseLineUuid } from './purchaseLineUtils'
import { formatRupiah } from '../../lib/money'

type PayableInvoice = {
  id: number
  number: string
  vendor_ref?: string | null
  total?: number
  amount_paid?: number
  amount_due?: number
  payment_status?: string
  supplier?: { id: number; name: string } | null
}

type ApprovalDraft = {
  key: string
  user_id: number
  name: string
  position?: string | null
}

type BatchItemDraft = {
  key: string
  vendor_invoice_id: number
  number: string
  supplier?: string | null
  invoice_total: number
  amount_due: number
  amount: number
}

type BatchRow = {
  id: number
  number: string
  client_uuid?: string
  status: string
  payment_method?: string | null
  total: number
  note?: string | null
  paid_at?: string | null
  can_approve?: boolean
  batch_need_approval?: boolean
  user?: { id: number; name: string } | null
  approvals?: Array<{
    level: number
    user_id: number
    user?: { id: number; name: string; position?: string | null } | null
  }>
  items?: Array<{
    id: number
    vendor_invoice_id: number
    amount: number
    vendor_invoice?: PayableInvoice | null
  }>
}

function uuid() {
  return purchaseLineUuid()
}

export default function VendorPaymentBatchDocs() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const batchEnabled = me?.settings?.vendor_payment_batch_enabled === true
  const batchNeedApproval = me?.settings?.vendor_payment_batch_need_approval === true
  const canCreate = can('vendorpaymentbatches', 'create')
  const canEdit = can('vendorpaymentbatches', 'edit')

  const [rows, setRows] = useState<BatchRow[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<BatchRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [payableInvoices, setPayableInvoices] = useState<PayableInvoice[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<BatchItemDraft[]>([])
  const [approvers, setApprovers] = useState<ApprovalDraft[]>([])

  const memberOptions = useMemo(
    () => buildApproverMemberOptions(members, approvers.map((a) => a.user_id)),
    [members, approvers],
  )

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'submitted', label: t('procurementPaymentStatusSubmitted') },
      { value: 'approved', label: t('procurementPaymentStatusApproved') },
      { value: 'rejected', label: t('purchaseStatusRejected') },
      { value: 'paid', label: t('procurementPaymentStatusPaid') },
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
        submitted: t('procurementPaymentStatusSubmitted'),
        approved: t('procurementPaymentStatusApproved'),
        rejected: t('purchaseStatusRejected'),
        paid: t('procurementPaymentStatusPaid'),
        cancelled: t('purchaseStatusCancelled'),
      }) as Record<string, string>,
    [t],
  )

  const batchTotal = useMemo(() => items.reduce((sum, row) => sum + (row.amount || 0), 0), [items])

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<BatchRow[]>>('/vendor-payment-batches', {
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

  async function loadPayableInvoices() {
    try {
      const { data } = await api.get<ApiOk<PayableInvoice[]>>('/vendor-invoices', {
        params: { payment_status: 'payable', per_page: 200 },
        silent: true,
      })
      setPayableInvoices(data.data ?? [])
    } catch {
      setPayableInvoices([])
    }
  }

  useEffect(() => {
    if (!batchEnabled) return
    void loadRows()
    void api.get<ApiOk<Member[]>>('/company/members', { params: { per_page: 200 }, silent: true }).then(({ data }) => {
      setMembers(data.data ?? [])
    })
  }, [list.page, list.perPage, list.search, list.status, batchEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditing(null)
    setPaymentMethod('transfer')
    setNote('')
    setItems([])
    setApprovers([])
    setError('')
    setOpen(true)
    logMasterForm('vendorpaymentbatch', 'create')
    void loadPayableInvoices()
  }

  async function openEdit(row: BatchRow) {
    try {
      const { data } = await api.get<ApiOk<BatchRow>>(`/vendor-payment-batches/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setPaymentMethod(doc.payment_method ?? 'transfer')
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
      setItems(
        (doc.items ?? []).map((item) => ({
          key: uuid(),
          vendor_invoice_id: item.vendor_invoice_id,
          number: item.vendor_invoice?.number ?? `#${item.vendor_invoice_id}`,
          supplier: item.vendor_invoice?.supplier?.name ?? null,
          invoice_total: item.vendor_invoice?.total ?? item.amount,
          amount_due: item.vendor_invoice?.amount_due ?? item.amount,
          amount: item.amount,
        })),
      )
      setError('')
      setOpen(true)
      logMasterForm('vendorpaymentbatch', 'edit', doc.number)
      void loadPayableInvoices()
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

  function addInvoice(invoiceId: string) {
    const id = Number(invoiceId)
    if (!id || items.some((row) => row.vendor_invoice_id === id)) return
    const inv = payableInvoices.find((row) => row.id === id)
    if (!inv) return
    setItems([
      ...items,
      {
        key: uuid(),
        vendor_invoice_id: inv.id,
        number: inv.number,
        supplier: inv.supplier?.name ?? null,
        invoice_total: inv.total ?? 0,
        amount_due: inv.amount_due ?? Math.max(0, (inv.total ?? 0) - (inv.amount_paid ?? 0)),
        amount: inv.amount_due ?? Math.max(0, (inv.total ?? 0) - (inv.amount_paid ?? 0)),
      },
    ])
  }

  function removeItem(key: string) {
    setItems(items.filter((row) => row.key !== key))
  }

  function updateItemAmount(key: string, amount: number) {
    setItems(items.map((row) => (row.key === key ? { ...row, amount: Math.max(0, amount) } : row)))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (items.length === 0) {
      setError(t('procurementPaymentItemsRequired'))
      return
    }
    if (batchNeedApproval && approvers.length === 0) {
      setError(t('purchaseNeedApprovers'))
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      ...(editing ? {} : { client_uuid: uuid() }),
      payment_method: paymentMethod,
      note: note || null,
      items: items.map((row) => ({
        vendor_invoice_id: row.vendor_invoice_id,
        amount: row.amount,
      })),
      approvals: batchNeedApproval ? approvers.map((row) => ({ user_id: row.user_id })) : [],
    }
    try {
      if (editing) await api.put(`/vendor-payment-batches/${editing.id}`, payload)
      else await api.post('/vendor-payment-batches', payload)
      setOpen(false)
      await loadRows()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(row: BatchRow, action: string) {
    const labelMap: Record<string, string> = {
      submit: t('procurementPaymentSubmit'),
      pay: t('procurementPaymentPay'),
      approve: t('purchaseApprove'),
      reject: t('purchaseReject'),
      cancel: t('cancel'),
    }
    const ok = await feedback.confirm({
      title: labelMap[action] ?? action,
      message: t('procurementPaymentActionConfirm', { number: row.number }),
      confirmLabel: labelMap[action] ?? action,
      tone: action === 'cancel' || action === 'reject' ? 'danger' : 'default',
    })
    if (!ok) return
    try {
      await api.post(`/vendor-payment-batches/${row.id}/${action}`)
      await loadRows()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function canPay(row: BatchRow) {
    if (batchNeedApproval) return row.status === 'approved'
    return row.status === 'submitted'
  }

  const availableInvoices = payableInvoices.filter((inv) => !items.some((row) => row.vendor_invoice_id === inv.id))

  if (!batchEnabled) {
    return (
      <div>
        <PageHeader eyebrow={t('appProcurement')} title={t('procurementPaymentTitle')} subtitle={t('procurementPaymentSubtitle')} />
        <p className="text-sm text-muted">{t('procurementPaymentDisabledHint')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appProcurement')}
        title={t('procurementPaymentTitle')}
        subtitle={t('procurementPaymentSubtitle')}
        action={
          canCreate ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('procurementPaymentAdd')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} statusOptions={statusOptions} searchPlaceholder={t('procurementPaymentSearch')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('number')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium">{t('procurementPaymentMethod')}</th>
              <th className="px-4 py-3 font-medium">{t('total')}</th>
              <th className="px-4 py-3 font-medium">{t('cashier')}</th>
              {canEdit ? <th className="px-4 py-3 font-medium"></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3 font-medium text-fg">{row.number}</td>
                <td className="px-4 py-3 text-muted">{statusLabel[row.status] ?? row.status}</td>
                <td className="px-4 py-3 text-muted">
                  {row.payment_method ? methodOptions.find((m) => m.value === row.payment_method)?.label ?? row.payment_method : '—'}
                </td>
                <td className="px-4 py-3 text-muted">{formatRupiah(row.total, locale)}</td>
                <td className="px-4 py-3 text-muted">{row.user?.name ?? '—'}</td>
                {canEdit ? (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {['draft', 'rejected'].includes(row.status) ? (
                      <>
                        <button type="button" className="mr-3 text-mint" onClick={() => void openEdit(row)}>
                          {t('edit')}
                        </button>
                        <button type="button" className="mr-3 text-mint" onClick={() => void runAction(row, 'submit')}>
                          {t('procurementPaymentSubmit')}
                        </button>
                        {row.status === 'draft' ? (
                          <button type="button" className="text-rose-300" onClick={() => void runAction(row, 'cancel')}>
                            {t('cancel')}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {row.status === 'submitted' && row.can_approve ? (
                      <>
                        <button type="button" className="mr-3 text-mint" onClick={() => void runAction(row, 'approve')}>
                          {t('purchaseApprove')}
                        </button>
                        <button type="button" className="text-rose-300" onClick={() => void runAction(row, 'reject')}>
                          {t('purchaseReject')}
                        </button>
                      </>
                    ) : null}
                    {canPay(row) ? (
                      <button type="button" className="text-mint" onClick={() => void runAction(row, 'pay')}>
                        {t('procurementPaymentPay')}
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={canEdit ? 6 : 5}>
                  {t('procurementPaymentEmpty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t('procurementPaymentEdit') : t('procurementPaymentCreate')}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      >
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
          <textarea className="field min-h-[72px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {batchNeedApproval ? (
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

        <div className="space-y-2">
          <div className="text-sm font-medium text-fg">{t('procurementPaymentInvoices')}</div>
          {availableInvoices.length > 0 ? (
            <select
              className="field"
              defaultValue=""
              onChange={(e) => {
                addInvoice(e.target.value)
                e.target.value = ''
              }}
            >
              <option value="">{t('procurementPaymentPickInvoice')}</option>
              {availableInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} · {inv.supplier?.name ?? '—'} · {t('total')}: {formatRupiah(inv.total ?? 0, locale)} ·{' '}
                  {t('procurementPaymentDue')}: {formatRupiah(inv.amount_due ?? 0, locale)}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-muted">{t('procurementPaymentNoPayable')}</p>
          )}

          {items.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-fg">{row.number}</div>
                <div className="text-xs text-muted">
                  {row.supplier ?? '—'} · {t('total')}: {formatRupiah(row.invoice_total, locale)} · {t('procurementPaymentDue')}:{' '}
                  {formatRupiah(row.amount_due, locale)}
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={row.amount_due}
                className="field w-36"
                value={row.amount}
                onChange={(e) => updateItemAmount(row.key, Number(e.target.value) || 0)}
              />
              <button type="button" className="text-rose-300 text-sm" onClick={() => removeItem(row.key)}>
                {t('delete')}
              </button>
            </div>
          ))}
        </div>

        <div className="text-sm text-muted">
          {t('total')}: <span className="font-medium text-fg">{formatRupiah(batchTotal, locale)}</span>
        </div>
      </MasterModal>
    </div>
  )
}
