import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'
import type { ApiOk } from '../../types'
import type { StorefrontInquiryRow } from './types'

const STATUS_OPTIONS: Array<{ value: string; label: MsgKey }> = [
  { value: '', label: 'storefrontInquiryStatusAll' },
  { value: 'new', label: 'storefrontInquiryStatus_new' },
  { value: 'read', label: 'storefrontInquiryStatus_read' },
  { value: 'archived', label: 'storefrontInquiryStatus_archived' },
]

const KIND_OPTIONS: Array<{ value: string; label: MsgKey }> = [
  { value: '', label: 'storefrontInquiryKindAll' },
  { value: 'contact', label: 'storefrontInquiryKind_contact' },
  { value: 'quote', label: 'storefrontInquiryKind_quote' },
]

const STATUS_LABEL: Record<string, MsgKey> = {
  new: 'storefrontInquiryStatus_new',
  read: 'storefrontInquiryStatus_read',
  archived: 'storefrontInquiryStatus_archived',
}

const KIND_LABEL: Record<string, MsgKey> = {
  contact: 'storefrontInquiryKind_contact',
  quote: 'storefrontInquiryKind_quote',
}

export default function StorefrontInquiries() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canEdit = can('storefrontinquiries', 'edit')
  const [rows, setRows] = useState<StorefrontInquiryRow[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('new')
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<StorefrontInquiryRow | null>(null)

  async function load(nextStatus = status, nextKind = kind, nextSearch = search) {
    try {
      const params = new URLSearchParams({ per_page: '50' })
      if (nextStatus) params.set('status', nextStatus)
      if (nextKind) params.set('kind', nextKind)
      if (nextSearch.trim()) params.set('search', nextSearch.trim())
      const { data } = await api.get<ApiOk<StorefrontInquiryRow[]>>(`/storefront/inquiries?${params.toString()}`)
      setRows(data.data ?? [])
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load(status, kind, search)
    }, 250)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, kind, search])

  async function openRow(row: StorefrontInquiryRow) {
    setSelected(row)
    if (row.status !== 'new' || !canEdit) return
    try {
      const { data } = await api.post<ApiOk<StorefrontInquiryRow>>(`/storefront/inquiries/${row.id}/read`)
      const updated = data.data
      setSelected(updated)
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch {
      // keep local selection even if mark-read fails
    }
  }

  async function markRead(id: number) {
    if (!canEdit) return
    setBusy(true)
    try {
      const { data } = await api.post<ApiOk<StorefrontInquiryRow>>(`/storefront/inquiries/${id}/read`)
      feedback.success(t('saved'))
      setSelected(data.data)
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function archive(id: number) {
    if (!canEdit) return
    setBusy(true)
    try {
      const { data } = await api.post<ApiOk<StorefrontInquiryRow>>(`/storefront/inquiries/${id}/archive`)
      feedback.success(t('saved'))
      setSelected(data.data)
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('storefrontInquiriesTitle')} subtitle={t('storefrontInquiriesHint')} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="h-9 min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">{t('storefrontInquiryColFrom')}</th>
                <th className="px-3 py-2 font-medium">{t('storefrontInquiryColKind')}</th>
                <th className="px-3 py-2 font-medium">{t('storefrontInquiryColStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('storefrontInquiryColDate')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    {t('storefrontInquiriesEmpty')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${selected?.id === row.id ? 'bg-slate-50' : ''} ${row.status === 'new' ? 'font-semibold' : ''}`}
                    onClick={() => void openRow(row)}
                  >
                    <td className="px-3 py-2.5">
                      <div>{row.name}</div>
                      <div className="text-xs font-normal text-slate-500">{row.email}</div>
                      {row.subject ? <div className="mt-0.5 line-clamp-1 text-xs font-normal text-slate-600">{row.subject}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{t(KIND_LABEL[row.kind] || 'storefrontInquiryKind_contact')}</td>
                    <td className="px-3 py-2.5 text-xs">{t(STATUS_LABEL[row.status] || 'storefrontInquiryStatus_new')}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-500">{t('storefrontInquiriesSelect')}</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold text-slate-900">{selected.name}</div>
                  <a href={`mailto:${selected.email}`} className="text-sky-700 hover:underline">
                    {selected.email}
                  </a>
                  {selected.phone ? <div className="text-slate-600">{selected.phone}</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit && selected.status === 'new' ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                      onClick={() => void markRead(selected.id)}
                    >
                      {t('storefrontInquiryMarkRead')}
                    </button>
                  ) : null}
                  {canEdit && selected.status !== 'archived' ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                      onClick={() => void archive(selected.id)}
                    >
                      {t('storefrontInquiryArchive')}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{t(KIND_LABEL[selected.kind] || 'storefrontInquiryKind_contact')}</span>
                <span>·</span>
                <span>{t(STATUS_LABEL[selected.status] || 'storefrontInquiryStatus_new')}</span>
                {selected.created_at ? (
                  <>
                    <span>·</span>
                    <span>{new Date(selected.created_at).toLocaleString()}</span>
                  </>
                ) : null}
              </div>
              {selected.subject ? (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('storefrontInquiryColSubject')}</div>
                  <div className="mt-0.5 font-medium text-slate-800">{selected.subject}</div>
                </div>
              ) : null}
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('storefrontInquiryColMessage')}</div>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">{selected.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
