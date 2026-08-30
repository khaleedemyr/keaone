import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Party, Product } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterModal } from '../../components/MasterModal'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { SearchSelect } from '../../components/SearchSelect'
import { useSupplierSelect } from './useSupplierSelect'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import { ProcurementSimpleLineEditor } from './ProcurementSimpleLineEditor'
import { purchaseLineUuid } from './purchaseLineUtils'
import { formatRupiah } from '../../lib/money'

type NoteType = 'debit' | 'credit'

type LineDraft = {
  key: string
  product_id: number
  name: string
  qty: number
  unit_cost_before: number
  unit_cost_after: number
}

type NoteRow = {
  id: number
  type: NoteType
  number: string
  status: string
  total: number
  reason?: string | null
  note?: string | null
  supplier?: { id: number; name: string } | null
  goods_receipt?: { id: number; number: string } | null
  items?: LineDraft[]
}

function uuid() {
  return purchaseLineUuid()
}

export default function VendorAdjustmentDocs() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const canCreate = can('vendoradjustmentnotes', 'create')
  const canEdit = can('vendoradjustmentnotes', 'edit')

  const [rows, setRows] = useState<NoteRow[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<NoteRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [noteType, setNoteType] = useState<NoteType>('credit')
  const [typeFilter, setTypeFilter] = useState<'all' | NoteType>('all')
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [grOptions, setGrOptions] = useState<Array<{ id: number; number: string; supplier_id?: number | null }>>([])
  const [supplierId, setSupplierId] = useState('')
  const [grId, setGrId] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: uuid(), product_id: 0, name: '', qty: 1, unit_cost_before: 0, unit_cost_after: 0 },
  ])

  const { options: supplierOptions } = useSupplierSelect(suppliers)

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'confirmed', label: t('purchaseStatusConfirmed') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ],
    [t],
  )

  const typeOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'credit', label: t('procurementCreditNote') },
      { value: 'debit', label: t('procurementDebitNote') },
    ],
    [t],
  )

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<NoteRow[]>>('/vendor-adjustment-notes', {
        params: {
          page: list.page,
          per_page: list.perPage,
          search: list.search || undefined,
          status: list.status !== 'all' ? list.status : undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
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
  }, [list.page, list.perPage, list.search, list.status, typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void Promise.all([
      api.get<ApiOk<Product[]>>('/products', { params: { for_select: 1, status: 'active', per_page: 500 }, silent: true }),
      api.get<ApiOk<Party[]>>('/suppliers', { params: { for_select: 1, status: 'active', per_page: 200 }, silent: true }),
      api.get<ApiOk<Array<{ id: number; number: string; supplier_id?: number | null }>>>('/goods-receipts', {
        params: { status: 'confirmed', per_page: 100 },
        silent: true,
      }),
    ]).then(([productRes, supplierRes, grRes]) => {
      setProducts(productRes.data.data ?? [])
      setSuppliers(supplierRes.data.data ?? [])
      setGrOptions(grRes.data.data ?? [])
    }).catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  function resetForm() {
    setEditing(null)
    setNoteType('credit')
    setSupplierId('')
    setGrId('')
    setReason('')
    setNote('')
    setLines([{ key: uuid(), product_id: 0, name: '', qty: 1, unit_cost_before: 0, unit_cost_after: 0 }])
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    logMasterForm('vendoradjustment', 'create')
  }

  async function openEdit(row: NoteRow) {
    try {
      const { data } = await api.get<ApiOk<NoteRow>>(`/vendor-adjustment-notes/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setNoteType(doc.type)
      setSupplierId(doc.supplier?.id?.toString() ?? '')
      setGrId(doc.goods_receipt?.id?.toString() ?? '')
      setReason(doc.reason ?? '')
      setNote(doc.note ?? '')
      setLines(
        (doc.items ?? []).map((item) => ({
          key: uuid(),
          product_id: item.product_id,
          name: item.name_snapshot,
          qty: item.qty,
          unit_cost_before: item.unit_cost_before,
          unit_cost_after: item.unit_cost_after,
        })),
      )
      setOpen(true)
      logMasterForm('vendoradjustment', 'edit', doc.number)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const filled = lines.filter((line) => line.product_id > 0)
    if (!supplierId || filled.length === 0) {
      setError(t('purchaseNeedItems'))
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      type: noteType,
      supplier_id: Number(supplierId),
      goods_receipt_id: grId ? Number(grId) : undefined,
      reason: reason || undefined,
      note: note || undefined,
      items: filled.map((line) => ({
        product_id: line.product_id,
        qty: line.qty,
        unit_cost_before: line.unit_cost_before,
        unit_cost_after: line.unit_cost_after,
      })),
    }
    try {
      if (editing) {
        await api.put(`/vendor-adjustment-notes/${editing.id}`, payload)
      } else {
        await api.post('/vendor-adjustment-notes', { ...payload, client_uuid: uuid() })
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

  async function runAction(row: NoteRow, action: string) {
    try {
      await api.post(`/vendor-adjustment-notes/${row.id}/${action}`)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function typeLabel(type: NoteType) {
    return type === 'credit' ? t('procurementCreditNote') : t('procurementDebitNote')
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
        eyebrow={t('appProcurement')}
        title={t('procurementAdjustmentTitle')}
        subtitle={t('procurementAdjustmentSubtitle')}
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
        extra={
          <label className="block text-sm text-muted">
            {t('procurementAdjustmentType')}
            <select className="field !mt-1" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | NoteType)}>
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        }
      />

      <div className="glass overflow-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('number')}</th>
              <th className="px-4 py-3">{t('procurementAdjustmentType')}</th>
              <th className="px-4 py-3">{t('navSuppliers')}</th>
              <th className="px-4 py-3">{t('purchaseTotal')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 font-medium">{row.number}</td>
                <td className="px-4 py-3">{typeLabel(row.type)}</td>
                <td className="px-4 py-3">{row.supplier?.name ?? '—'}</td>
                <td className="px-4 py-3">{formatRupiah(row.total, locale)}</td>
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
                        {t('purchaseConfirm')}
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
        title={editing ? t('procurementAdjustmentEdit') : t('procurementAdjustmentCreate')}
        error={error}
        saving={saving}
        mobileFullscreen
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
      >
        <label className="block text-sm text-muted">
          {t('procurementAdjustmentType')}
          <select className="field" value={noteType} disabled={Boolean(editing)} onChange={(e) => setNoteType(e.target.value as NoteType)}>
            <option value="credit">{t('procurementCreditNote')}</option>
            <option value="debit">{t('procurementDebitNote')}</option>
          </select>
        </label>
        <label className="block text-sm text-muted">
          {t('navSuppliers')}
          <SearchSelect className="!mt-0" value={supplierId} onChange={setSupplierId} options={supplierOptions} placeholder={t('purchaseSelectSupplier')} required />
        </label>
        <label className="block text-sm text-muted">
          {t('purchaseGrTitle')} ({t('filterAll')})
          <select className="field" value={grId} onChange={(e) => setGrId(e.target.value)}>
            <option value="">—</option>
            {grOptions.map((gr) => (
              <option key={gr.id} value={gr.id}>{gr.number}</option>
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

        <ProcurementSimpleLineEditor mode="adjustment" lines={lines} setLines={setLines} products={products} />
      </MasterModal>
    </div>
  )
}
