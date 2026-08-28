import type { ReactNode } from 'react'

export function formatDocDate(iso: string | null | undefined, locale: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-fg">{value}</dd>
    </div>
  )
}

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
  submitted: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-200',
  approved: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-200',
  ordered: 'bg-teal-500/10 text-teal-700 ring-teal-500/25 dark:text-teal-200',
  partial: 'bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-200',
  received: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-200',
  rejected: 'bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-200',
  cancelled: 'bg-slate-500/10 text-slate-500 ring-slate-500/15 dark:text-slate-400',
}

export function DocStatusBadge({ status, label }: { status: string; label: string }) {
  const tone = STATUS_TONE[status] ?? 'bg-fill text-fg ring-line'
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${tone}`}
    >
      {label}
    </span>
  )
}

export function DocHeader({
  docLabel,
  number,
  status,
  statusLabel,
  createdAt,
  createdAtLabel,
  locale,
  qrDataUrl,
  qrHint,
  subtitle,
}: {
  docLabel: string
  number: string
  status: string
  statusLabel: string
  createdAt?: string | null
  createdAtLabel: string
  locale: string
  qrDataUrl?: string
  qrHint?: string
  subtitle?: string
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-line pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{docLabel}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold tracking-tight text-fg">{number}</h3>
          <DocStatusBadge status={status} label={statusLabel} />
        </div>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        <p className="text-xs text-muted">
          {createdAtLabel}: {formatDocDate(createdAt, locale)}
        </p>
      </div>
      {qrDataUrl ? (
        <div className="shrink-0 rounded-lg border border-line bg-white p-2.5 text-center shadow-sm">
          <img src={qrDataUrl} alt={number} className="mx-auto h-24 w-24" />
          <p className="mt-1.5 text-[10px] font-medium tracking-wide text-slate-700">{number}</p>
          {qrHint ? <p className="text-[9px] text-slate-500">{qrHint}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export function DocItemsTable({
  children,
  columns,
}: {
  columns: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-line">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-fill/60">{columns}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function DocTh({
  children,
  align = 'left',
}: {
  children: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

export function PublicDocPage({
  badge,
  children,
  error,
  loading,
  loadingLabel,
}: {
  badge: string
  children: ReactNode
  error?: string
  loading?: boolean
  loadingLabel: string
}) {
  return (
    <div className="min-h-svh bg-[var(--page)] px-4 py-8 text-fg">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <span className="font-sans text-sm font-semibold tracking-tight text-fg">KEA One</span>
          <span className="text-xs text-muted">{badge}</span>
        </div>
        {error ? (
          <div className="rounded-xl border border-line bg-fill/30 p-8 text-center font-sans text-sm text-muted">
            {error}
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-line bg-fill/30 p-8 text-center font-sans text-sm text-muted">
            {loadingLabel}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-fill/20 p-6 shadow-sm backdrop-blur-sm">{children}</div>
        )}
      </div>
    </div>
  )
}
