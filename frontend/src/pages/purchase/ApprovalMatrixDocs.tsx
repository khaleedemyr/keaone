import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Department, Member, RoleRecord, RoleCatalogPayload } from '../../types'
import { buildApproverMemberOptions } from './approverOptions'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'

type MatrixRow = {
  id: number
  doc_type: string
  department_id?: number | null
  department?: { id: number; name: string; code?: string | null } | null
  min_amount: number
  max_amount?: number | null
  level: number
  approver_type: string
  approver_ref_id?: number | null
  priority: number
  escalate_after_days?: number | null
  escalate_to_user_id?: number | null
  escalate_to?: { id: number; name: string } | null
  is_active: boolean
}

type NamedRef = { id: number; name: string }

export default function ApprovalMatrixDocs() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'all')

  const [rows, setRows] = useState<MatrixRow[]>([])
  const [viewing, setViewing] = useState<MatrixRow | null>(null)
  const [editing, setEditing] = useState<MatrixRow | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [positions, setPositions] = useState<NamedRef[]>([])
  const [jobLevels, setJobLevels] = useState<NamedRef[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [docType, setDocType] = useState('pr')
  const [departmentId, setDepartmentId] = useState('')
  const [minAmount, setMinAmount] = useState('0')
  const [maxAmount, setMaxAmount] = useState('')
  const [level, setLevel] = useState('1')
  const [approverType, setApproverType] = useState('user')
  const [approverRefId, setApproverRefId] = useState('')
  const [priority, setPriority] = useState('0')
  const [escalateDays, setEscalateDays] = useState('')
  const [escalateToUserId, setEscalateToUserId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const canCreate = can('approvalmatrix', 'create')
  const canEdit = can('approvalmatrix', 'edit')
  const canDelete = can('approvalmatrix', 'delete')

  const docTypeOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'pr', label: t('purchasePrTitle') },
      { value: 'po', label: t('purchasePoTitle') },
    ],
    [t],
  )

  const departmentOptions = useMemo(
    () =>
      departments.map((dept) => ({
        value: String(dept.id),
        label: dept.name,
        keywords: dept.code ?? '',
      })),
    [departments],
  )

  const memberOptions = useMemo(() => buildApproverMemberOptions(members, []), [members])

  const approverRefOptions = useMemo(() => {
    if (approverType === 'user') return memberOptions
    if (approverType === 'role') {
      return roles
        .filter((r) => r.is_active)
        .map((r) => ({ value: String(r.id), label: r.name, keywords: r.slug }))
    }
    if (approverType === 'position') {
      return positions.map((r) => ({ value: String(r.id), label: r.name }))
    }
    return jobLevels.map((r) => ({ value: String(r.id), label: r.name }))
  }, [approverType, memberOptions, roles, positions, jobLevels])

  function approverTypeLabel(type: string) {
    const map: Record<string, MsgKey> = {
      user: 'procurementApprovalTypeUser',
      role: 'procurementApprovalTypeRole',
      position: 'procurementApprovalTypePosition',
      job_level: 'procurementApprovalTypeJobLevel',
    }
    return t(map[type] ?? 'procurementApprovalTypeUser')
  }

  async function loadMeta() {
    const load = async <T,>(run: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await run()
      } catch {
        return fallback
      }
    }

    const [depts, roleRows, posRows, jlRows, memberRows] = await Promise.all([
      load(
        () =>
          api
            .get<ApiOk<Department[]>>('/departments', {
              params: { for_select: 1, status: 'active', per_page: 200 },
              silent: true,
            })
            .then(({ data }) => data.data ?? []),
        [] as Department[],
      ),
      load(
        () =>
          api
            .get<ApiOk<RoleCatalogPayload>>('/roles', { params: { for_select: 1, status: 'all' }, silent: true })
            .then(({ data }) => data.data?.roles ?? []),
        [] as RoleRecord[],
      ),
      load(
        () =>
          api
            .get<ApiOk<NamedRef[]>>('/positions', {
              params: { for_select: 1, status: 'active', per_page: 200 },
              silent: true,
            })
            .then(({ data }) => data.data ?? []),
        [] as NamedRef[],
      ),
      load(
        () =>
          api
            .get<ApiOk<NamedRef[]>>('/job-levels', {
              params: { for_select: 1, status: 'active', per_page: 200 },
              silent: true,
            })
            .then(({ data }) => data.data ?? []),
        [] as NamedRef[],
      ),
      load(
        () =>
          api
            .get<ApiOk<Member[]>>('/users', { params: { for_select: 1, status: 'active', per_page: 200 }, silent: true })
            .then(({ data }) => data.data ?? []),
        [] as Member[],
      ),
    ])

    setDepartments(depts)
    setRoles(roleRows)
    setPositions(posRows)
    setJobLevels(jlRows)
    setMembers(memberRows)
  }

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<MatrixRow[]>>('/approval-matrix', {
        params: {
          page: list.page,
          per_page: list.perPage,
          doc_type: list.status !== 'all' ? list.status : undefined,
        },
      })
      setRows(data.data ?? [])
      list.applyMeta(data.meta, data.data?.length ?? 0)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void loadMeta()
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => void loadRows(), 200)
    return () => window.clearTimeout(handle)
  }, [list.page, list.perPage, list.status]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm(row?: MatrixRow | null) {
    setEditing(row ?? null)
    setDocType(row?.doc_type ?? 'pr')
    setDepartmentId(row?.department_id ? String(row.department_id) : '')
    setMinAmount(String(row?.min_amount ?? 0))
    setMaxAmount(row?.max_amount != null ? String(row.max_amount) : '')
    setLevel(String(row?.level ?? 1))
    setApproverType(row?.approver_type ?? 'user')
    setApproverRefId(row?.approver_ref_id ? String(row.approver_ref_id) : '')
    setPriority(String(row?.priority ?? 0))
    setEscalateDays(row?.escalate_after_days != null ? String(row.escalate_after_days) : '')
    setEscalateToUserId(row?.escalate_to_user_id ? String(row.escalate_to_user_id) : '')
    setIsActive(row?.is_active ?? true)
    setError('')
  }

  function openCreate() {
    resetForm(null)
    setOpen(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      doc_type: docType,
      department_id: departmentId ? Number(departmentId) : null,
      min_amount: Number(minAmount || 0),
      max_amount: maxAmount.trim() ? Number(maxAmount) : null,
      level: Number(level),
      approver_type: approverType,
      approver_ref_id: approverRefId ? Number(approverRefId) : null,
      priority: Number(priority || 0),
      escalate_after_days: escalateDays.trim() ? Number(escalateDays) : null,
      escalate_to_user_id: escalateToUserId ? Number(escalateToUserId) : null,
      is_active: isActive,
    }
    try {
      if (editing) {
        await api.put(`/approval-matrix/${editing.id}`, payload)
      } else {
        await api.post('/approval-matrix', payload)
      }
      feedback.success(t('saved'))
      setOpen(false)
      void loadRows()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function removeRow(row: MatrixRow) {
    if (!window.confirm(t('confirmDelete'))) return
    try {
      await api.delete(`/approval-matrix/${row.id}`)
      feedback.success(t('deleted'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  function refLabel(row: MatrixRow) {
    const id = row.approver_ref_id
    if (!id) return '—'
    if (row.approver_type === 'user') return members.find((m) => m.id === id)?.name ?? `#${id}`
    if (row.approver_type === 'role') return roles.find((r) => r.id === id)?.name ?? `#${id}`
    if (row.approver_type === 'position') return positions.find((r) => r.id === id)?.name ?? `#${id}`
    return jobLevels.find((r) => r.id === id)?.name ?? `#${id}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('appProcurement')}
        title={t('procurementApprovalMatrixTitle')}
        subtitle={t('procurementApprovalMatrixSubtitle')}
        action={
          canCreate ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              {t('procurementApprovalMatrixAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        search={list.search}
        onSearch={list.filters.onSearch}
        status={list.status}
        onStatus={list.filters.onStatus}
        statusOptions={docTypeOptions}
        searchPlaceholder={t('search')}
        perPage={list.perPage}
        onPerPage={list.filters.onPerPage}
        hideStatus={false}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3">{t('procurementApprovalDocType')}</th>
              <th className="px-4 py-3">{t('navDepartments')}</th>
              <th className="px-4 py-3">{t('procurementApprovalAmountRange')}</th>
              <th className="px-4 py-3">{t('procurementApprovalLevel')}</th>
              <th className="px-4 py-3">{t('procurementApprovalApprover')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  {t('emptyList')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <MasterNameButton onClick={() => setViewing(row)}>
                      {row.doc_type === 'po' ? t('purchasePoTitle') : t('purchasePrTitle')}
                    </MasterNameButton>
                  </td>
                  <td className="px-4 py-3">{row.department?.name ?? t('procurementBudgetCompanyWide')}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatRupiah(row.min_amount, locale)}
                    {row.max_amount != null ? ` — ${formatRupiah(row.max_amount, locale)}` : '+'}
                  </td>
                  <td className="px-4 py-3">{row.level}</td>
                  <td className="px-4 py-3">
                    {approverTypeLabel(row.approver_type)} · {refLabel(row)}
                  </td>
                  <td className="px-4 py-3">{row.is_active ? t('active') : t('inactive')}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {canEdit ? (
                        <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => { resetForm(row); setOpen(true) }}>
                          {t('edit')}
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button type="button" className="btn-ghost !px-2 !text-xs text-danger" onClick={() => void removeRow(row)}>
                          {t('delete')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterViewModal open={Boolean(viewing)} title={t('procurementApprovalMatrixTitle')} onClose={() => setViewing(null)} size="lg">
        {viewing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ViewField label={t('procurementApprovalDocType')} value={viewing.doc_type === 'po' ? t('purchasePoTitle') : t('purchasePrTitle')} />
            <ViewField label={t('navDepartments')} value={viewing.department?.name ?? t('procurementBudgetCompanyWide')} />
            <ViewField label={t('procurementApprovalMinAmount')} value={formatRupiah(viewing.min_amount, locale)} />
            <ViewField label={t('procurementApprovalMaxAmount')} value={viewing.max_amount != null ? formatRupiah(viewing.max_amount, locale) : '—'} />
            <ViewField label={t('procurementApprovalLevel')} value={String(viewing.level)} />
            <ViewField label={t('procurementApprovalApprover')} value={`${approverTypeLabel(viewing.approver_type)} · ${refLabel(viewing)}`} />
            <ViewField label={t('procurementApprovalEscalateDays')} value={viewing.escalate_after_days != null ? String(viewing.escalate_after_days) : '—'} />
            <ViewField label={t('procurementApprovalEscalateTo')} value={viewing.escalate_to?.name ?? '—'} />
          </div>
        ) : null}
      </MasterViewModal>

      <MasterModal
        open={open}
        title={editing ? t('procurementApprovalMatrixEdit') : t('procurementApprovalMatrixAdd')}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        saving={saving}
        error={error}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-block">
              <span>{t('procurementApprovalDocType')}</span>
              <select className="field !mt-0" value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="pr">{t('purchasePrTitle')}</option>
                <option value="po">{t('purchasePoTitle')}</option>
              </select>
            </label>
            <label className="field-block">
              <span>{t('navDepartments')}</span>
              <SearchSelect
                className="!mt-0"
                value={departmentId}
                onChange={setDepartmentId}
                options={departmentOptions}
                placeholder={t('procurementBudgetCompanyWide')}
                allowEmpty
                emptyLabel={t('procurementBudgetCompanyWide')}
              />
            </label>
            <label className="field-block">
              <span>{t('procurementApprovalMinAmount')}</span>
              <input type="number" min={0} className="field !mt-0 tabular-nums" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
            </label>
            <label className="field-block">
              <span>{t('procurementApprovalMaxAmount')}</span>
              <input type="number" min={0} className="field !mt-0 tabular-nums" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞" />
            </label>
            <label className="field-block">
              <span>{t('procurementApprovalLevel')}</span>
              <input type="number" min={1} max={20} className="field !mt-0" value={level} onChange={(e) => setLevel(e.target.value)} required />
            </label>
            <label className="field-block">
              <span>{t('procurementApprovalApproverType')}</span>
              <select className="field !mt-0" value={approverType} onChange={(e) => { setApproverType(e.target.value); setApproverRefId('') }}>
                <option value="user">{t('procurementApprovalTypeUser')}</option>
                <option value="role">{t('procurementApprovalTypeRole')}</option>
                <option value="position">{t('procurementApprovalTypePosition')}</option>
                <option value="job_level">{t('procurementApprovalTypeJobLevel')}</option>
              </select>
            </label>
            <label className="field-block sm:col-span-2">
              <span>{t('procurementApprovalApprover')}</span>
              <SearchSelect
                key={approverType}
                className="!mt-0"
                value={approverRefId}
                onChange={setApproverRefId}
                options={approverRefOptions}
                placeholder={t('select')}
              />
            </label>
            <label className="field-block">
              <span>{t('procurementApprovalPriority')}</span>
              <input type="number" min={0} className="field !mt-0" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </label>
            <label className="field-block">
              <span>{t('procurementApprovalEscalateDays')}</span>
              <input type="number" min={1} className="field !mt-0" value={escalateDays} onChange={(e) => setEscalateDays(e.target.value)} />
            </label>
            <label className="field-block sm:col-span-2">
              <span>{t('procurementApprovalEscalateTo')}</span>
              <SearchSelect
                className="!mt-0"
                value={escalateToUserId}
                onChange={setEscalateToUserId}
                options={memberOptions}
                placeholder={t('select')}
                allowEmpty
                emptyLabel="—"
              />
            </label>
            <label className="field-block flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>{t('active')}</span>
            </label>
          </div>
        </div>
      </MasterModal>
    </div>
  )
}
