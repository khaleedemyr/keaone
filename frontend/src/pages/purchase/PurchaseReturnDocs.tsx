import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Member, Party, Product, Warehouse } from '../../types'
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
import { useI18n } from '../../i18n'
import { ProcurementSimpleLineEditor } from './ProcurementSimpleLineEditor'
import { purchaseLineUuid } from './purchaseLineUtils'

type ApprovalDraft = {
  key: string
  user_id: number
  name: string
  position?: string | null
}

type LineDraft = {
  key: string
  product_id: number
  name: string
  qty: number
  unit: string
}

type ReturnRow = {
  id: number
  number: string
  status: string
  reason?: string | null
  note?: string | null
  supplier?: { id: number; name: string } | null
  warehouse?: { id: number; name: string } | null
  return_need_approval?: boolean
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
  }>
}

function uuid() {
  return purchaseLineUuid()
}

export default function PurchaseReturnDocs() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const canCreate = can('purchasereturns', 'create')
  const canEdit = can('purchasereturns', 'edit')
  const returnNeedApproval = Boolean(me?.settings?.return_need_approval)

  const [rows, setRows] = useState<ReturnRow[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ReturnRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ key: uuid(), product_id: 0, name: '', qty: 1, unit: '' }])
  const [approvers, setApprovers] = useState<ApprovalDraft[]>([])

  const { options: supplierOptions } = useSupplierSelect(suppliers)

  const memberOptions = useMemo(
    () => buildApproverMemberOptions(
      members,
      approvers.map((row) => row.user_id),
    ),
    [members, approvers],
  )

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'submitted', label: t('purchaseStatusSubmitted') },
      { value: 'approved', label: t('purchaseStatusApproved') },
      { value: 'confirmed', label: t('procurementReturnStatusConfirmed') },
      { value: 'rejected', label: t('purchaseStatusRejected') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ],
    [t],
  )

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<ReturnRow[]>>('/purchase-returns', {
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
      api.get<ApiOk<Product[]>>('/products', { params: { for_select: 1, status: 'active', per_page: 500 }, silent: true }),
      api.get<ApiOk<Warehouse[]>>('/warehouses', { params: { for_select: 1, status: 'active' }, silent: true }),
      api.get<ApiOk<Party[]>>('/suppliers', { params: { for_select: 1, status: 'active', per_page: 200 }, silent: true }),
      returnNeedApproval
        ? api.get<ApiOk<Member[]>>('/users', { params: { for_select: 1, status: 'active' }, silent: true })
        : Promise.resolve(null),
    ]).then(([productRes, warehouseRes, supplierRes, memberRes]) => {
      setProducts(productRes.data.data ?? [])
      setWarehouses(warehouseRes.data.data ?? [])
      setSuppliers(supplierRes.data.data ?? [])
      if (memberRes) setMembers(memberRes.data.data ?? [])
    }).catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [returnNeedApproval, feedback, t])

  function resetForm() {
    setEditing(null)
    setSupplierId('')
    setWarehouseId(warehouses.find((w) => w.is_default)?.id?.toString() ?? '')
    setReason('')
    setNote('')
    setLines([{ key: uuid(), product_id: 0, name: '', qty: 1, unit: '' }])
    setApprovers([])
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm('purchasereturn', 'create')
  }

  async function openEdit(row: ReturnRow) {
    try {
      const { data } = await api.get<ApiOk<ReturnRow>>(`/purchase-returns/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setSupplierId(doc.supplier?.id?.toString() ?? '')
      setWarehouseId(doc.warehouse?.id?.toString() ?? '')
      setReason(doc.reason ?? '')
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
        (doc.items ?? []).map((item) => ({
          key: uuid(),
          product_id: item.product_id,
          name: item.name_snapshot,
          qty: item.qty,
          unit: item.unit ?? '',
        })),
      )
      setOpen(true)
      logMasterForm('purchasereturn', 'edit', doc.number)
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
    if (!supplierId || !warehouseId || filled.length === 0) {
      setError(t('purchaseNeedItems'))
      return
    }
    if (returnNeedApproval && approvers.length === 0) {
      setError(t('purchaseNeedApprovers'))
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      supplier_id: Number(supplierId),
      warehouse_id: Number(warehouseId),
      reason: reason || undefined,
      note: note || undefined,
      items: filled.map((line) => ({ product_id: line.product_id, qty: line.qty, unit: line.unit || undefined })),
      approvals: returnNeedApproval ? approvers.map((row) => ({ user_id: row.user_id })) : [],
    }
    try {
      if (editing) {
        await api.put(`/purchase-returns/${editing.id}`, payload)
      } else {
        await api.post('/purchase-returns', { ...payload, client_uuid: uuid() })
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

  async function runAction(row: ReturnRow, action: string) {
    try {
      await api.post(`/purchase-returns/${row.id}/${action}`)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      draft: t('purchaseStatusDraft'),
      submitted: t('purchaseStatusSubmitted'),
      approved: t('purchaseStatusApproved'),
      confirmed: t('procurementReturnStatusConfirmed'),
      rejected: t('purchaseStatusRejected'),
      cancelled: t('purchaseStatusCancelled'),
    }
    return map[status] ?? status
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appProcurement')}
        title={t('procurementReturnTitle')}
        subtitle={t('procurementReturnSubtitle')}
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('purchaseAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('purchaseSearch')}
        statusOptions={statusOptions}
      />

      <div className="glass overflow-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('number')}</th>
              <th className="px-4 py-3">{t('navSuppliers')}</th>
              <th className="px-4 py-3">{t('navWarehouses')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">{row.number}</td>
                <td className="px-4 py-3">{row.supplier?.name ?? '—'}</td>
                <td className="px-4 py-3">{row.warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3">{statusLabel(row.status)}</td>
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
                    {canEdit && row.status === 'approved' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'confirm')}>
                        {t('procurementReturnConfirm')}
                      </button>
                    ) : null}
                    {canEdit && !['confirmed', 'cancelled'].includes(row.status) ? (
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
        title={editing ? t('procurementReturnEdit') : t('procurementReturnCreate')}
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
          <label className="block text-sm text-muted">
            {t('navWarehouses')}
            <select className="field" required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{t('purchaseSelectWarehouse')}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-muted">
            {t('procurementReturnReason')}
            <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <label className="block text-sm text-muted">
            {t('purchaseNote')}
            <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          {returnNeedApproval ? (
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
                    <button type="button" className="btn-ghost !px-2" onClick={() => setApprovers((c) => c.filter((a) => a.key !== row.key))}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <ProcurementSimpleLineEditor mode="return" lines={lines} setLines={setLines} products={products} />
      </MasterModal>
    </div>
  )
}
