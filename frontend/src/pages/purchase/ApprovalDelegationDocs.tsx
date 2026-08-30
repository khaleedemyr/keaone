import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Member } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import { buildApproverMemberOptions } from './approverOptions'

type DelegationRow = {
  id: number
  user_id: number
  user?: { id: number; name: string } | null
  delegate_user_id: number
  delegate?: { id: number; name: string } | null
  starts_at: string
  ends_at: string
  note?: string | null
  is_active: boolean
}

export default function ApprovalDelegationDocs() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'all')

  const [rows, setRows] = useState<DelegationRow[]>([])
  const [viewing, setViewing] = useState<DelegationRow | null>(null)
  const [editing, setEditing] = useState<DelegationRow | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [userId, setUserId] = useState('')
  const [delegateUserId, setDelegateUserId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [note, setNote] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = can('approvaldelegations', 'create')
  const canEdit = can('approvaldelegations', 'edit')
  const canDelete = can('approvaldelegations', 'delete')

  const memberOptions = useMemo(() => buildApproverMemberOptions(members, []), [members])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'active', label: t('active') },
      { value: 'inactive', label: t('inactive') },
    ],
    [t],
  )

  async function loadMeta() {
    try {
      const { data } = await api.get<ApiOk<Member[]>>('/users', {
        params: { for_select: 1, status: 'active', per_page: 200 },
        silent: true,
      })
      setMembers(data.data ?? [])
    } catch {
      /* optional */
    }
  }

  async function loadRows() {
    try {
      const activeFilter =
        list.status === 'active' ? true : list.status === 'inactive' ? false : undefined
      const { data } = await api.get<ApiOk<DelegationRow[]>>('/approval-delegations', {
        params: {
          page: list.page,
          per_page: list.perPage,
          ...(activeFilter !== undefined ? { is_active: activeFilter } : {}),
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

  function resetForm(row?: DelegationRow | null) {
    setEditing(row ?? null)
    setUserId(row ? String(row.user_id) : '')
    setDelegateUserId(row ? String(row.delegate_user_id) : '')
    setStartsAt(row?.starts_at ?? '')
    setEndsAt(row?.ends_at ?? '')
    setNote(row?.note ?? '')
    setIsActive(row?.is_active ?? true)
    setError('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      user_id: Number(userId),
      delegate_user_id: Number(delegateUserId),
      starts_at: startsAt,
      ends_at: endsAt,
      note: note.trim() || null,
      is_active: isActive,
    }
    try {
      if (editing) {
        await api.put(`/approval-delegations/${editing.id}`, payload)
      } else {
        await api.post('/approval-delegations', payload)
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

  async function removeRow(row: DelegationRow) {
    if (!window.confirm(t('confirmDelete'))) return
    try {
      await api.delete(`/approval-delegations/${row.id}`)
      feedback.success(t('deleted'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('appProcurement')}
        title={t('procurementApprovalDelegationTitle')}
        subtitle={t('procurementApprovalDelegationSubtitle')}
        action={
          canCreate ? (
            <button type="button" className="btn btn-primary" onClick={() => { resetForm(null); setOpen(true) }}>
              {t('procurementApprovalDelegationAdd')}
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
        searchPlaceholder={t('search')}
        perPage={list.perPage}
        onPerPage={list.filters.onPerPage}
        hideStatus={false}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3">{t('procurementApprovalDelegator')}</th>
              <th className="px-4 py-3">{t('procurementApprovalDelegate')}</th>
              <th className="px-4 py-3">{t('procurementApprovalPeriod')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {t('emptyList')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <MasterNameButton onClick={() => setViewing(row)}>{row.user?.name ?? `#${row.user_id}`}</MasterNameButton>
                  </td>
                  <td className="px-4 py-3">{row.delegate?.name ?? `#${row.delegate_user_id}`}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.starts_at} — {row.ends_at}
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

      <MasterViewModal open={Boolean(viewing)} title={t('procurementApprovalDelegationTitle')} onClose={() => setViewing(null)} size="lg">
        {viewing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ViewField label={t('procurementApprovalDelegator')} value={viewing.user?.name ?? '—'} />
            <ViewField label={t('procurementApprovalDelegate')} value={viewing.delegate?.name ?? '—'} />
            <ViewField label={t('procurementApprovalPeriod')} value={`${viewing.starts_at} — ${viewing.ends_at}`} />
            <ViewField label={t('status')} value={viewing.is_active ? t('active') : t('inactive')} />
            {viewing.note ? <ViewField label={t('purchaseNote')} value={viewing.note} /> : null}
          </div>
        ) : null}
      </MasterViewModal>

      <MasterModal
        open={open}
        title={editing ? t('procurementApprovalDelegationEdit') : t('procurementApprovalDelegationAdd')}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        saving={saving}
        error={error}
        size="lg"
      >
        <div className="space-y-4">
          <label className="field-block">
            <span>{t('procurementApprovalDelegator')}</span>
            <SearchSelect className="!mt-0" value={userId} onChange={setUserId} options={memberOptions} placeholder={t('select')} />
          </label>
          <label className="field-block">
            <span>{t('procurementApprovalDelegate')}</span>
            <SearchSelect className="!mt-0" value={delegateUserId} onChange={setDelegateUserId} options={memberOptions} placeholder={t('select')} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-block">
              <span>{t('procurementApprovalStartsAt')}</span>
              <input type="date" className="field !mt-0" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </label>
            <label className="field-block">
              <span>{t('procurementApprovalEndsAt')}</span>
              <input type="date" className="field !mt-0" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
            </label>
          </div>
          <label className="field-block">
            <span>{t('purchaseNote')}</span>
            <textarea className="field !mt-0 min-h-20" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </label>
          <label className="field-block flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>{t('active')}</span>
          </label>
        </div>
      </MasterModal>
    </div>
  )
}
