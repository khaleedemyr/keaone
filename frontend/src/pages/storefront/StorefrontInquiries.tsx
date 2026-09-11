import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, apiMessage } from '../../api/client'
import { useFeedback } from '../../components/feedback'
import { PageEnter } from '../../components/motion'
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

const STATUS_TONE: Record<string, string> = {
  new: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-200',
  read: 'bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-200',
  archived: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
}

const KIND_TONE: Record<string, string> = {
  contact: 'bg-mint/12 text-fg ring-mint/30',
  quote: 'bg-violet/12 text-fg ring-violet/30',
}

function formatWhen(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function Badge({ tone, children }: { tone: string; children: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}>
      {children}
    </span>
  )
}

export default function StorefrontInquiries() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canEdit = can('storefrontinquiries', 'edit')
  const [rows, setRows] = useState<StorefrontInquiryRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  )

  const newCount = useMemo(() => rows.filter((row) => row.status === 'new').length, [rows])

  async function load(nextStatus = status, nextKind = kind, nextSearch = search) {
    try {
      const params = new URLSearchParams({ per_page: '50' })
      if (nextStatus) params.set('status', nextStatus)
      if (nextKind) params.set('kind', nextKind)
      if (nextSearch.trim()) params.set('search', nextSearch.trim())
      const { data } = await api.get<ApiOk<StorefrontInquiryRow[]>>(`/storefront/inquiries?${params.toString()}`)
      const next = data.data ?? []
      setRows(next)
      setSelectedId((prev) => {
        if (prev && next.some((row) => row.id === prev)) return prev
        return next[0]?.id ?? null
      })
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    } finally {
      setLoading(false)
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
    setSelectedId(row.id)
    if (row.status !== 'new' || !canEdit) return
    try {
      const { data } = await api.post<ApiOk<StorefrontInquiryRow>>(`/storefront/inquiries/${row.id}/read`)
      const updated = data.data
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch {
      // keep selection even if mark-read fails
    }
  }

  async function markRead(id: number) {
    if (!canEdit) return
    setBusy(true)
    try {
      const { data } = await api.post<ApiOk<StorefrontInquiryRow>>(`/storefront/inquiries/${id}/read`)
      feedback.success(t('saved'))
      setRows((prev) => prev.map((r) => (r.id === data.data.id ? data.data : r)))
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
      setRows((prev) => prev.map((r) => (r.id === data.data.id ? data.data : r)))
      if (status && status !== 'archived') {
        await load()
      }
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  const fieldSoft = 'field !rounded-2xl !border-transparent !bg-[var(--fill)]/80'
  const ghostBtn =
    'inline-flex h-9 items-center justify-center rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-fg transition hover:bg-[var(--fill)] disabled:opacity-50'
  const primaryBtn =
    'inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-teal-300 via-mint to-cyan-300 px-3 text-xs font-semibold text-ink shadow-[0_8px_24px_rgba(62,232,197,0.22)] transition hover:brightness-105 disabled:opacity-50'

  return (
    <PageEnter className="flex w-full max-w-none flex-col gap-5">
      <PageHeader
        eyebrow={t('appStorefront')}
        title={t('storefrontInquiriesTitle')}
        subtitle={t('storefrontInquiriesHint')}
        action={
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
              {t('storefrontInquiriesTitle')}
            </div>
            <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums tracking-tight text-fg">
              {loading ? '—' : rows.length}
              {!loading && newCount > 0 ? (
                <span className="ml-2 align-middle text-sm font-medium text-amber-600 dark:text-amber-300">
                  · {newCount} {t('storefrontInquiryStatus_new').toLowerCase()}
                </span>
              ) : null}
            </div>
          </div>
        }
      />

      <div className="glass flex min-h-[min(72vh,820px)] w-full flex-col overflow-hidden rounded-[28px]">
        <div className="border-b border-[var(--line)] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
                  <path
                    d="M8.75 14.5a5.75 5.75 0 1 1 0-11.5 5.75 5.75 0 0 1 0 11.5Zm6.35 1.6-3.2-3.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                className={`${fieldSoft} w-full pl-10`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value
                return (
                  <button
                    key={opt.value || 'all-status'}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                      active ? 'bg-mint/18 text-fg ring-1 ring-mint/35' : 'text-muted hover:bg-[var(--fill)] hover:text-fg'
                    }`}
                  >
                    {t(opt.label)}
                  </button>
                )
              })}
            </div>
            <select className={`${fieldSoft} w-full lg:w-44`} value={kind} onChange={(e) => setKind(e.target.value)}>
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value || 'all-kind'} value={opt.value}>
                  {t(opt.label)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.15fr)]">
          <div className="min-h-0 overflow-y-auto border-b border-[var(--line)] lg:border-b-0 lg:border-r">
            {loading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl bg-[var(--fill)] px-4 py-5" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-medium text-fg">{t('storefrontInquiriesEmpty')}</p>
                <p className="mt-1 text-sm text-muted">{t('storefrontInquiriesHint')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {rows.map((row) => {
                  const active = selected?.id === row.id
                  const isNew = row.status === 'new'
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => void openRow(row)}
                        className={`flex w-full gap-3 px-4 py-3.5 text-left transition sm:px-5 ${
                          active ? 'bg-[var(--fill)]/55' : 'hover:bg-[var(--fill)]/30'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[12px] font-semibold ${
                            isNew ? 'bg-mint/18 text-fg' : 'bg-[var(--fill)] text-muted'
                          }`}
                        >
                          {initials(row.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className={`truncate text-[14px] ${isNew ? 'font-semibold text-fg' : 'font-medium text-fg/90'}`}>
                              {row.name}
                            </div>
                            <div className="shrink-0 text-[11px] tabular-nums text-muted">{formatWhen(row.created_at)}</div>
                          </div>
                          <div className="mt-0.5 truncate text-[12px] text-muted">{row.email}</div>
                          <div className={`mt-1 line-clamp-1 text-[13px] ${isNew ? 'text-fg/85' : 'text-muted'}`}>
                            {row.subject || row.message}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge tone={KIND_TONE[row.kind] ?? KIND_TONE.contact}>
                              {t(KIND_LABEL[row.kind] || 'storefrontInquiryKind_contact')}
                            </Badge>
                            <Badge tone={STATUS_TONE[row.status] ?? STATUS_TONE.new}>
                              {t(STATUS_LABEL[row.status] || 'storefrontInquiryStatus_new')}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto bg-[var(--fill)]/15">
            <AnimatePresence mode="wait">
              {!selected ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-full min-h-[280px] items-center justify-center px-6 py-16 text-center"
                >
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-mint/10 text-mint">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                        <path
                          d="M4 7.5h16M4 12h10M4 16.5h7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <p className="mt-4 text-sm font-medium text-fg">{t('storefrontInquiriesSelect')}</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex h-full flex-col"
                >
                  <div className="border-b border-[var(--line)] px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint/15 text-sm font-semibold text-fg">
                          {initials(selected.name)}
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-display text-xl font-semibold tracking-tight text-fg">{selected.name}</h2>
                          <a href={`mailto:${selected.email}`} className="mt-0.5 block text-sm text-mint hover:underline">
                            {selected.email}
                          </a>
                          {selected.phone ? <div className="mt-0.5 text-sm text-muted">{selected.phone}</div> : null}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <Badge tone={KIND_TONE[selected.kind] ?? KIND_TONE.contact}>
                              {t(KIND_LABEL[selected.kind] || 'storefrontInquiryKind_contact')}
                            </Badge>
                            <Badge tone={STATUS_TONE[selected.status] ?? STATUS_TONE.new}>
                              {t(STATUS_LABEL[selected.status] || 'storefrontInquiryStatus_new')}
                            </Badge>
                            <span className="inline-flex items-center px-1 text-[12px] text-muted">
                              {formatWhen(selected.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canEdit && selected.status === 'new' ? (
                          <button type="button" className={primaryBtn} disabled={busy} onClick={() => void markRead(selected.id)}>
                            {t('storefrontInquiryMarkRead')}
                          </button>
                        ) : null}
                        {canEdit && selected.status !== 'archived' ? (
                          <button type="button" className={ghostBtn} disabled={busy} onClick={() => void archive(selected.id)}>
                            {t('storefrontInquiryArchive')}
                          </button>
                        ) : null}
                        <a href={`mailto:${selected.email}`} className={ghostBtn}>
                          {t('storefrontInquiryReply')}
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                    {selected.subject ? (
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                          {t('storefrontInquiryColSubject')}
                        </div>
                        <div className="mt-1.5 text-base font-medium text-fg">{selected.subject}</div>
                      </div>
                    ) : null}
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                        {t('storefrontInquiryColMessage')}
                      </div>
                      <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--fill)]/35 px-4 py-4 text-[14px] leading-relaxed text-fg/90 whitespace-pre-wrap sm:px-5 sm:py-5">
                        {selected.message}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageEnter>
  )
}
