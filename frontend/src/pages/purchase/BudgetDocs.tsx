import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Department } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'

type BudgetLineRow = {
  id?: number
  department_id?: number | null
  department_name?: string | null
  outlet_id?: number | null
  outlet_name?: string | null
  amount: number
  committed?: number
  available?: number
  note?: string | null
}

type BudgetRow = {
  id: number
  name: string
  fiscal_year: number
  period_start: string
  period_end: string
  status: string
  note?: string | null
  allocated_total: number
  committed_total: number
  available_total: number
  lines: BudgetLineRow[]
}

type LineDraft = {
  department_id: string
  amount: string
  note: string
}

const EMPTY_LINE: LineDraft = { department_id: '', amount: '', note: '' }

function statusLabel(t: (k: MsgKey) => string, status: string) {
  const map: Record<string, MsgKey> = {
    draft: 'procurementBudgetStatusDraft',
    active: 'procurementBudgetStatusActive',
    closed: 'procurementBudgetStatusClosed',
  }
  return t(map[status] ?? 'procurementBudgetStatusDraft')
}

export default function BudgetDocs() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'all')
  const budgetEnabled = me?.settings?.procurement_budget_check_enabled === true

  const [rows, setRows] = useState<BudgetRow[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<BudgetRow | null>(null)
  const [editing, setEditing] = useState<BudgetRow | null>(null)
  const [name, setName] = useState('')
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()))
  const [periodStart, setPeriodStart] = useState(`${new Date().getFullYear()}-01-01`)
  const [periodEnd, setPeriodEnd] = useState(`${new Date().getFullYear()}-12-31`)
  const [note, setNote] = useState('')
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([{ ...EMPTY_LINE }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = can('procurementbudgets', 'create')
  const canEdit = can('procurementbudgets', 'edit')
  const canDelete = can('procurementbudgets', 'delete')

  const departmentOptions = useMemo(
    () =>
      departments.map((dept) => ({
        value: String(dept.id),
        label: dept.name,
        keywords: dept.code ?? '',
      })),
    [departments],
  )

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'draft', label: t('procurementBudgetStatusDraft') },
      { value: 'active', label: t('procurementBudgetStatusActive') },
      { value: 'closed', label: t('procurementBudgetStatusClosed') },
    ],
    [t],
  )

  async function loadDepartments() {
    try {
      const { data } = await api.get<ApiOk<Department[]>>('/departments', { params: { status: 'active', per_page: 200 } })
      setDepartments(data.data ?? [])
    } catch {
      setDepartments([])
    }
  }

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<BudgetRow[]>>('/budgets', {
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
    void loadDepartments()
  }, [])

  useEffect(() => {
    if (!budgetEnabled) return
    const handle = window.setTimeout(() => void loadRows(), 200)
    return () => window.clearTimeout(handle)
  }, [list.page, list.perPage, list.status, list.search, budgetEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditing(null)
    setName('')
    setFiscalYear(String(new Date().getFullYear()))
    setPeriodStart(`${new Date().getFullYear()}-01-01`)
    setPeriodEnd(`${new Date().getFullYear()}-12-31`)
    setNote('')
    setLineDrafts([{ ...EMPTY_LINE }])
    setError('')
    setOpen(true)
  }

  function openEdit(row: BudgetRow) {
    setEditing(row)
    setName(row.name)
    setFiscalYear(String(row.fiscal_year))
    setPeriodStart(row.period_start)
    setPeriodEnd(row.period_end)
    setNote(row.note ?? '')
    setLineDrafts(
      row.lines.length > 0
        ? row.lines.map((line) => ({
            department_id: line.department_id ? String(line.department_id) : '',
            amount: String(line.amount),
            note: line.note ?? '',
          }))
        : [{ ...EMPTY_LINE }],
    )
    setError('')
    setOpen(true)
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLineDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addLine() {
    setLineDrafts((prev) => [...prev, { ...EMPTY_LINE }])
  }

  function removeLine(index: number) {
    setLineDrafts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const lines = lineDrafts
        .filter((line) => Number(line.amount) > 0)
        .map((line) => ({
          department_id: line.department_id ? Number(line.department_id) : null,
          amount: Number(line.amount),
          note: line.note || null,
        }))

      const payload = {
        name,
        fiscal_year: Number(fiscalYear),
        period_start: periodStart,
        period_end: periodEnd,
        note: note || null,
        lines,
      }

      if (editing) await api.put(`/budgets/${editing.id}`, payload)
      else await api.post('/budgets', payload)

      setOpen(false)
      await loadRows()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function activateRow(row: BudgetRow) {
    const ok = await feedback.confirm({
      title: t('procurementBudgetActivateTitle'),
      message: t('procurementBudgetActivateConfirm', { name: row.name }),
      confirmLabel: t('procurementBudgetActivate'),
    })
    if (!ok) return
    try {
      await api.post(`/budgets/${row.id}/activate`)
      await loadRows()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function closeRow(row: BudgetRow) {
    const ok = await feedback.confirm({
      title: t('procurementBudgetCloseTitle'),
      message: t('procurementBudgetCloseConfirm', { name: row.name }),
      confirmLabel: t('procurementBudgetClose'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.post(`/budgets/${row.id}/close`)
      await loadRows()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function removeRow(row: BudgetRow) {
    const ok = await feedback.confirm({
      title: t('delete'),
      message: t('deleteConfirm', { name: row.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/budgets/${row.id}`)
      await loadRows()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  if (!budgetEnabled) {
    return (
      <div>
        <PageHeader title={t('procurementBudgetTitle')} subtitle={t('procurementBudgetSubtitle')} />
        <p className="text-sm text-muted">{t('procurementBudgetDisabledHint')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('procurementBudgetTitle')}
        subtitle={t('procurementBudgetSubtitle')}
        action={
          canCreate ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              {t('procurementBudgetAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        search={list.search}
        onSearch={list.filters.onSearch}
        status={list.status}
        onStatus={list.filters.onStatus}
        statusOptions={statusOptions}
        searchPlaceholder={t('procurementBudgetSearch')}
        perPage={list.perPage}
        onPerPage={list.filters.onPerPage}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3">{t('name')}</th>
              <th className="px-4 py-3">{t('procurementBudgetFiscalYear')}</th>
              <th className="px-4 py-3">{t('procurementBudgetPeriod')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3 text-right">{t('procurementBudgetAllocated')}</th>
              <th className="px-4 py-3 text-right">{t('procurementBudgetCommitted')}</th>
              <th className="px-4 py-3 text-right">{t('procurementBudgetAvailable')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="px-4 py-3">
                  <MasterNameButton onClick={() => setViewing(row)}>{row.name}</MasterNameButton>
                </td>
                <td className="px-4 py-3">{row.fiscal_year}</td>
                <td className="px-4 py-3 tabular-nums">
                  {row.period_start} — {row.period_end}
                </td>
                <td className="px-4 py-3">{statusLabel(t, row.status)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(row.allocated_total, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(row.committed_total, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(row.available_total, locale)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {row.status === 'draft' && canEdit ? (
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEdit(row)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {row.status === 'draft' && canEdit ? (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => void activateRow(row)}>
                        {t('procurementBudgetActivate')}
                      </button>
                    ) : null}
                    {row.status === 'active' && canEdit ? (
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => void closeRow(row)}>
                        {t('procurementBudgetClose')}
                      </button>
                    ) : null}
                    {row.status === 'draft' && canDelete ? (
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => void removeRow(row)}>
                        {t('delete')}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  {t('procurementBudgetEmpty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t('procurementBudgetEdit') : t('procurementBudgetAdd')}
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
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field-block">
              <span>{t('procurementBudgetFiscalYear')}</span>
              <input type="number" className="field !mt-0" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} required />
            </label>
            <label className="field-block">
              <span>{t('procurementBudgetPeriodStart')}</span>
              <input type="date" className="field !mt-0" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
            </label>
            <label className="field-block">
              <span>{t('procurementBudgetPeriodEnd')}</span>
              <input type="date" className="field !mt-0" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
            </label>
          </div>
          <label className="field-block">
            <span>{t('purchaseNote')}</span>
            <textarea className="field !mt-0 min-h-20" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </label>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg">{t('procurementBudgetLines')}</span>
              <button type="button" className="btn btn-sm btn-secondary" onClick={addLine}>
                {t('procurementBudgetAddLine')}
              </button>
            </div>
            <div className="space-y-3">
              {lineDrafts.map((line, index) => (
                <div key={index} className="rounded-xl border border-line p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">
                      {t('procurementBudgetLines')} {index + 1}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={lineDrafts.length <= 1}
                      onClick={() => removeLine(index)}
                    >
                      {t('delete')}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="field-block mb-0">
                      <span>{t('navDepartments')}</span>
                      <SearchSelect
                        className="!mt-0"
                        value={line.department_id}
                        onChange={(value) => updateLine(index, { department_id: value })}
                        options={departmentOptions}
                        placeholder={t('procurementBudgetCompanyWide')}
                        allowEmpty
                        emptyLabel={t('procurementBudgetCompanyWide')}
                      />
                    </label>
                    <label className="field-block mb-0">
                      <span>{t('procurementBudgetAmount')}</span>
                      <input
                        type="number"
                        min={0}
                        className="field !mt-0 tabular-nums"
                        value={line.amount}
                        onChange={(e) => updateLine(index, { amount: e.target.value })}
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
          <>
            <ViewField label={t('procurementBudgetFiscalYear')} value={String(viewing.fiscal_year)} />
            <ViewField label={t('procurementBudgetPeriod')} value={`${viewing.period_start} — ${viewing.period_end}`} />
            <ViewField label={t('status')} value={statusLabel(t, viewing.status)} />
            <ViewField label={t('procurementBudgetAllocated')} value={formatRupiah(viewing.allocated_total, locale)} />
            <ViewField label={t('procurementBudgetCommitted')} value={formatRupiah(viewing.committed_total, locale)} />
            <ViewField label={t('procurementBudgetAvailable')} value={formatRupiah(viewing.available_total, locale)} />
            {viewing.note ? <ViewField label={t('purchaseNote')} value={viewing.note} /> : null}
            <div className="mt-4">
              <div className="mb-2 text-sm font-medium">{t('procurementBudgetLines')}</div>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="px-3 py-2">{t('department')}</th>
                      <th className="px-3 py-2 text-right">{t('procurementBudgetAllocated')}</th>
                      <th className="px-3 py-2 text-right">{t('procurementBudgetCommitted')}</th>
                      <th className="px-3 py-2 text-right">{t('procurementBudgetAvailable')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.lines.map((line) => (
                      <tr key={line.id ?? `${line.department_id}-${line.amount}`} className="border-b border-border/60">
                        <td className="px-3 py-2">{line.department_name ?? t('procurementBudgetCompanyWide')}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(line.amount, locale)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(line.committed ?? 0, locale)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(line.available ?? 0, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </MasterViewModal>
    </div>
  )
}
