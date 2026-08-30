import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Department, Product } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import { buildProductOptions } from './purchaseLineUtils'

type PlanLineRow = {
  id?: number
  product_id: number
  product_name?: string
  period_month?: number | null
  qty_planned: number
  estimated_unit_cost: number
  estimated_total?: number
  note?: string | null
}

type PlanRow = {
  id: number
  name: string
  fiscal_year: number
  status: string
  department?: { id: number; name: string; code?: string } | null
  note?: string | null
  planned_total: number
  lines: PlanLineRow[]
}

type LineDraft = { product_id: string; period_month: string; qty_planned: string; estimated_unit_cost: string; note: string }
const EMPTY_LINE: LineDraft = { product_id: '', period_month: '', qty_planned: '', estimated_unit_cost: '', note: '' }

function uuid() {
  return crypto.randomUUID()
}

function statusLabel(t: (k: MsgKey) => string, status: string) {
  const map: Record<string, MsgKey> = {
    draft: 'procurementPlanStatusDraft',
    active: 'procurementPlanStatusActive',
    closed: 'procurementPlanStatusClosed',
  }
  return t(map[status] ?? 'procurementPlanStatusDraft')
}

export default function PlanDocs() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'all')
  const enabled = me?.settings?.procurement_annual_plan_enabled === true

  const [rows, setRows] = useState<PlanRow[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<PlanRow | null>(null)
  const [editing, setEditing] = useState<PlanRow | null>(null)
  const [name, setName] = useState('')
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()))
  const [departmentId, setDepartmentId] = useState('')
  const [note, setNote] = useState('')
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([{ ...EMPTY_LINE }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = can('procurementplans', 'create')
  const canEdit = can('procurementplans', 'edit')
  const canDelete = can('procurementplans', 'delete')

  const productOptions = useMemo(() => buildProductOptions(products), [products])
  const departmentOptions = useMemo(
    () =>
      departments.map((dept) => ({
        value: String(dept.id),
        label: dept.name,
        keywords: dept.code ?? '',
      })),
    [departments],
  )
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: String(index + 1),
        label: String(index + 1),
      })),
    [],
  )

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('procurementPlanStatusDraft') },
      { value: 'active', label: t('procurementPlanStatusActive') },
      { value: 'closed', label: t('procurementPlanStatusClosed') },
    ],
    [t],
  )

  async function loadMeta() {
    try {
      const [deptRes, prodRes] = await Promise.all([
        api.get<ApiOk<Department[]>>('/departments', { params: { status: 'active', per_page: 200 } }),
        api.get<ApiOk<Product[]>>('/products', { params: { for_purchase: 1, status: 'active', per_page: 200 } }),
      ])
      setDepartments(deptRes.data.data ?? [])
      setProducts(prodRes.data.data ?? [])
    } catch {
      setDepartments([])
      setProducts([])
    }
  }

  async function loadRows() {
    if (!enabled) return
    try {
      const { data } = await api.get<ApiOk<PlanRow[]>>('/procurement-plans', {
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

  useEffect(() => { void loadMeta() }, [])
  useEffect(() => { void loadRows() }, [enabled, list.page, list.perPage, list.search, list.status])

  function resetForm(row?: PlanRow | null) {
    setEditing(row ?? null)
    setName(row?.name ?? '')
    setFiscalYear(row ? String(row.fiscal_year) : String(new Date().getFullYear()))
    setDepartmentId(row?.department?.id ? String(row.department.id) : '')
    setNote(row?.note ?? '')
    setLineDrafts(
      row?.lines?.length
        ? row.lines.map((line) => ({
            product_id: String(line.product_id),
            period_month: line.period_month ? String(line.period_month) : '',
            qty_planned: String(line.qty_planned),
            estimated_unit_cost: String(line.estimated_unit_cost),
            note: line.note ?? '',
          }))
        : [{ ...EMPTY_LINE }],
    )
    setError('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const lines = lineDrafts
        .filter((row) => row.product_id && row.qty_planned)
        .map((row) => ({
          product_id: Number(row.product_id),
          period_month: row.period_month ? Number(row.period_month) : undefined,
          qty_planned: Number(row.qty_planned),
          estimated_unit_cost: Number(row.estimated_unit_cost || 0),
          note: row.note || undefined,
        }))
      const payload = {
        name,
        fiscal_year: Number(fiscalYear),
        department_id: departmentId ? Number(departmentId) : undefined,
        note: note || undefined,
        lines,
      }
      if (editing) {
        await api.put(`/procurement-plans/${editing.id}`, payload)
        feedback.success(t('saved'))
      } else {
        await api.post('/procurement-plans', { ...payload, client_uuid: uuid() })
        feedback.success(t('created'))
      }
      setOpen(false)
      await loadRows()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(path: string, okMsg: MsgKey) {
    try {
      const { data } = await api.post<ApiOk<PlanRow>>(path)
      feedback.success(t(okMsg))
      if (viewing) setViewing(data.data)
      await loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('actionFailed')))
    }
  }

  if (!enabled) {
    return (
      <div>
        <PageHeader title={t('procurementPlanTitle')} />
        <p className="text-sm text-muted">{t('procurementPlanDisabled')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('procurementPlanTitle')}
        action={canCreate ? (
          <button type="button" className="btn btn-primary" onClick={() => { resetForm(null); setOpen(true) }}>
            {t('procurementPlanAdd')}
          </button>
        ) : null}
      />
      <MasterFilters
        search={list.search}
        onSearch={list.filters.onSearch}
        status={list.status}
        onStatus={list.filters.onStatus}
        statusOptions={statusOptions}
        searchPlaceholder={t('search')}
        perPage={list.perPage}
        onPerPage={list.filters.onPerPage}
      />
      <div className="card mt-4 overflow-x-auto">
        <table className="master-table w-full">
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>{t('procurementPlanFiscalYear')}</th>
              <th>{t('department')}</th>
              <th>{t('status')}</th>
              <th>{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><MasterNameButton onClick={() => setViewing(row)}>{row.name}</MasterNameButton></td>
                <td>{row.fiscal_year}</td>
                <td>{row.department?.name ?? '—'}</td>
                <td>{statusLabel(t, row.status)}</td>
                <td>{formatRupiah(row.planned_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t('procurementPlanEdit') : t('procurementPlanAdd')}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        saving={saving}
        error={error}
        size="xl"
      >
        <div className="space-y-4">
          <label className="field-block">
            <span>{t('name')}</span>
            <input className="field !mt-0" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-block">
              <span>{t('procurementPlanFiscalYear')}</span>
              <input type="number" className="field !mt-0" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} required />
            </label>
            <label className="field-block">
              <span>{t('navDepartments')}</span>
              <SearchSelect
                className="!mt-0"
                value={departmentId}
                onChange={setDepartmentId}
                options={departmentOptions}
                placeholder={t('select')}
                allowEmpty
                emptyLabel={t('select')}
              />
            </label>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg">{t('purchaseItems')}</span>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLineDrafts([...lineDrafts, { ...EMPTY_LINE }])}>
                {t('procurementPlanAddLine')}
              </button>
            </div>
            <div className="space-y-3">
              {lineDrafts.map((row, idx) => (
                <div key={idx} className="rounded-xl border border-line p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">
                      {t('purchaseItems')} {idx + 1}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={lineDrafts.length <= 1}
                      onClick={() => setLineDrafts(lineDrafts.filter((_, i) => i !== idx))}
                    >
                      {t('delete')}
                    </button>
                  </div>
                  <label className="field-block mb-3">
                    <span>{t('product')}</span>
                    <SearchSelect
                      className="!mt-0"
                      value={row.product_id}
                      onChange={(value) => {
                        const next = [...lineDrafts]
                        next[idx] = { ...next[idx], product_id: value }
                        setLineDrafts(next)
                      }}
                      options={productOptions}
                      placeholder={t('purchasePickProduct')}
                      allowEmpty
                      emptyLabel={t('purchasePickProduct')}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="field-block mb-0">
                      <span>{t('procurementPlanMonth')}</span>
                      <select
                        className="field !mt-0"
                        value={row.period_month}
                        onChange={(e) => {
                          const next = [...lineDrafts]
                          next[idx] = { ...next[idx], period_month: e.target.value }
                          setLineDrafts(next)
                        }}
                      >
                        <option value="">{t('select')}</option>
                        {monthOptions.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block mb-0">
                      <span>{t('stockQty')}</span>
                      <input
                        className="field !mt-0 tabular-nums"
                        type="number"
                        min={0}
                        value={row.qty_planned}
                        onChange={(e) => {
                          const next = [...lineDrafts]
                          next[idx] = { ...next[idx], qty_planned: e.target.value }
                          setLineDrafts(next)
                        }}
                      />
                    </label>
                    <label className="field-block mb-0">
                      <span>{t('purchaseUnitCost')}</span>
                      <input
                        className="field !mt-0 tabular-nums"
                        type="number"
                        min={0}
                        value={row.estimated_unit_cost}
                        onChange={(e) => {
                          const next = [...lineDrafts]
                          next[idx] = { ...next[idx], estimated_unit_cost: e.target.value }
                          setLineDrafts(next)
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MasterModal>

      <MasterViewModal open={Boolean(viewing)} title={viewing?.name ?? ''} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="space-y-4">
            <ViewField label={t('procurementPlanFiscalYear')} value={String(viewing.fiscal_year)} />
            <ViewField label={t('status')} value={statusLabel(t, viewing.status)} />
            <ViewField label={t('total')} value={formatRupiah(viewing.planned_total)} />
            <ul className="space-y-1 text-sm">
              {viewing.lines.map((line) => (
                <li key={line.id}>{line.product_name} — {line.qty_planned} × {formatRupiah(line.estimated_unit_cost)}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {canEdit && viewing.status === 'draft' ? (
                <button type="button" className="btn btn-primary" onClick={() => void runAction(`/procurement-plans/${viewing.id}/activate`, 'procurementPlanActivated')}>{t('activate')}</button>
              ) : null}
              {canEdit && viewing.status === 'active' ? (
                <button type="button" className="btn btn-ghost" onClick={() => void runAction(`/procurement-plans/${viewing.id}/close`, 'procurementPlanClosed')}>{t('close')}</button>
              ) : null}
              {canEdit && viewing.status === 'draft' ? (
                <button type="button" className="btn btn-ghost" onClick={() => { resetForm(viewing); setOpen(true); setViewing(null) }}>{t('edit')}</button>
              ) : null}
              {canDelete && viewing.status === 'draft' ? (
                <button type="button" className="btn btn-danger" onClick={async () => { await api.delete(`/procurement-plans/${viewing.id}`); setViewing(null); await loadRows() }}>{t('delete')}</button>
              ) : null}
            </div>
          </div>
        ) : null}
      </MasterViewModal>
    </div>
  )
}
