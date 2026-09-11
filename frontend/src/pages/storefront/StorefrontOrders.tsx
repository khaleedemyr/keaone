import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, apiMessage } from '../../api/client'
import { useFeedback } from '../../components/feedback'
import { PageEnter } from '../../components/motion'
import { PageHeader } from '../../components/ui'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import type { ApiOk } from '../../types'
import type { StorefrontOrderRow } from './types'
import { formatVariantSnapshot, orderItemDisplayName } from './variantLabel'

const STATUS_OPTIONS: Array<{ value: string; label: MsgKey }> = [
  { value: '', label: 'storefrontOrderStatusAll' },
  { value: 'pending_payment', label: 'storefrontOrderStatus_pending_payment' },
  { value: 'awaiting_confirmation', label: 'storefrontOrderStatus_awaiting_confirmation' },
  { value: 'paid', label: 'storefrontOrderStatus_paid' },
  { value: 'shipped', label: 'storefrontOrderStatus_shipped' },
  { value: 'delivered', label: 'storefrontOrderStatus_delivered' },
  { value: 'cancelled', label: 'storefrontOrderStatus_cancelled' },
]

const STATUS_LABEL: Record<string, MsgKey> = {
  pending_payment: 'storefrontOrderStatus_pending_payment',
  awaiting_confirmation: 'storefrontOrderStatus_awaiting_confirmation',
  paid: 'storefrontOrderStatus_paid',
  shipped: 'storefrontOrderStatus_shipped',
  delivered: 'storefrontOrderStatus_delivered',
  cancelled: 'storefrontOrderStatus_cancelled',
}

const STATUS_TONE: Record<string, string> = {
  pending_payment: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-200',
  awaiting_confirmation: 'bg-orange-500/10 text-orange-700 ring-orange-500/20 dark:text-orange-200',
  paid: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-200',
  shipped: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-200',
  delivered: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-200',
  cancelled: 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-200',
}

const STATUS_DOT: Record<string, string> = {
  pending_payment: 'bg-amber-400',
  awaiting_confirmation: 'bg-orange-400',
  paid: 'bg-sky-400',
  shipped: 'bg-violet-400',
  delivered: 'bg-emerald-400',
  cancelled: 'bg-rose-400',
}

function formatWhen(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
        STATUS_TONE[status] ?? 'bg-fill text-muted ring-line'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? 'bg-muted'}`} />
      {label}
    </span>
  )
}

export default function StorefrontOrders() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canEdit = can('storefrontorders', 'edit')
  const [rows, setRows] = useState<StorefrontOrderRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  async function load(nextStatus = status, nextSearch = search) {
    try {
      const params = new URLSearchParams({ per_page: '50' })
      if (nextStatus) params.set('status', nextStatus)
      if (nextSearch.trim()) params.set('search', nextSearch.trim())
      const { data } = await api.get<ApiOk<StorefrontOrderRow[]>>(`/storefront/orders?${params.toString()}`)
      setRows(data.data ?? [])
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
      void load(status, search)
    }, 250)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1
    return counts
  }, [rows])

  async function confirm(id: number) {
    if (!canEdit) return
    setBusy(true)
    try {
      await api.post(`/storefront/orders/${id}/confirm`)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function cancel(id: number) {
    if (!canEdit) return
    setBusy(true)
    try {
      await api.post(`/storefront/orders/${id}/cancel`)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function askTracking(row: StorefrontOrderRow, mode: 'ship' | 'update') {
    const tracking = await feedback.prompt({
      title: mode === 'ship' ? t('storefrontMarkShipped') : t('storefrontEditTracking'),
      message: t('storefrontTrackingPrompt'),
      inputLabel: t('storefrontTrackingNumber'),
      inputPlaceholder: t('storefrontTrackingPlaceholder'),
      defaultValue: row.tracking_number ?? '',
      confirmLabel: mode === 'ship' ? t('storefrontMarkShipped') : t('save'),
      required: true,
    })
    if (tracking === null) return null
    return tracking.trim() || null
  }

  async function ship(row: StorefrontOrderRow) {
    if (!canEdit) return
    const tracking = await askTracking(row, 'ship')
    if (!tracking) return
    setBusy(true)
    try {
      await api.post(`/storefront/orders/${row.id}/ship`, { tracking_number: tracking })
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function updateTracking(row: StorefrontOrderRow) {
    if (!canEdit) return
    const tracking = await askTracking(row, 'update')
    if (!tracking) return
    setBusy(true)
    try {
      await api.post(`/storefront/orders/${row.id}/tracking`, { tracking_number: tracking })
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function deliver(id: number) {
    if (!canEdit) return
    setBusy(true)
    try {
      await api.post(`/storefront/orders/${id}/deliver`)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  function statusLabel(value: string) {
    const key = STATUS_LABEL[value]
    return key ? t(key) : value
  }

  function renderActions(row: StorefrontOrderRow) {
    if (!canEdit) return null
    const btn = 'rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50'
    const primary = `${btn} bg-gradient-to-r from-teal-300 via-mint to-cyan-300 text-ink shadow-[0_8px_24px_rgba(62,232,197,0.22)] hover:brightness-105`
    const ghost = `${btn} border border-[var(--line)] bg-transparent text-fg hover:bg-[var(--fill)]`

    if (row.status === 'pending_payment' || row.status === 'awaiting_confirmation') {
      return (
        <>
          <button type="button" className={primary} disabled={busy} onClick={() => void confirm(row.id)}>
            {t('storefrontConfirmPaid')}
          </button>
          <button type="button" className={ghost} disabled={busy} onClick={() => void cancel(row.id)}>
            {t('storefrontCancelOrder')}
          </button>
        </>
      )
    }
    if (row.status === 'paid') {
      return (
        <>
          <button type="button" className={primary} disabled={busy} onClick={() => void ship(row)}>
            {t('storefrontMarkShipped')}
          </button>
          <button type="button" className={ghost} disabled={busy} onClick={() => void deliver(row.id)}>
            {t('storefrontMarkDelivered')}
          </button>
        </>
      )
    }
    if (row.status === 'shipped') {
      return (
        <>
          <button type="button" className={ghost} disabled={busy} onClick={() => void updateTracking(row)}>
            {t('storefrontEditTracking')}
          </button>
          <button type="button" className={primary} disabled={busy} onClick={() => void deliver(row.id)}>
            {t('storefrontMarkDelivered')}
          </button>
        </>
      )
    }
    if (row.status === 'delivered' && row.tracking_number) {
      return (
        <button type="button" className={ghost} disabled={busy} onClick={() => void updateTracking(row)}>
          {t('storefrontEditTracking')}
        </button>
      )
    }
    return null
  }

  return (
    <PageEnter className="w-full max-w-none space-y-6">
      <PageHeader
        eyebrow={t('appStorefront')}
        title={t('storefrontOrdersTitle')}
        subtitle={t('storefrontOrdersHint')}
        action={
          <div className="rounded-2xl px-1 text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Orders</div>
            <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums tracking-tight text-fg">
              {loading ? '—' : rows.length}
            </div>
          </div>
        }
      />

      <div className="glass overflow-hidden rounded-[28px]">
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
                className="field w-full !rounded-2xl !border-transparent !bg-[var(--fill)]/80 pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('storefrontOrderSearchPlaceholder')}
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0.5 lg:max-w-[58%] lg:justify-end">
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value
                const count = opt.value ? (statusCounts[opt.value] ?? 0) : rows.length
                return (
                  <button
                    key={opt.value || 'all'}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                      active
                        ? 'bg-mint/18 text-fg ring-1 ring-mint/35'
                        : 'text-muted hover:bg-[var(--fill)] hover:text-fg'
                    }`}
                  >
                    {t(opt.label)}
                    {!loading && !status ? (
                      <span className={`ml-1.5 tabular-nums ${active ? 'opacity-70' : 'opacity-50'}`}>{count}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-0 px-4 py-3 sm:px-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse border-b border-[var(--line)] py-5 last:border-0">
                <div className="h-4 w-28 rounded bg-[var(--fill)]" />
                <div className="mt-3 h-3 w-2/3 rounded bg-[var(--fill)]" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-mint/10 text-mint">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <path
                  d="M4 7h16M4 12h10M4 17h7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-fg">{t('storefrontEmptyOrders')}</p>
            <p className="mt-1 text-sm text-muted">{t('storefrontOrdersHint')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {rows.map((row, index) => {
              const open = openId === row.id
              const shipping = row.shipping_snapshot
              const when = formatWhen(row.placed_at)
              const actions = renderActions(row)
              const firstItem = row.items?.[0]
              const firstVariant = formatVariantSnapshot(firstItem?.variant_snapshot)
              const itemPreview = firstItem
                ? orderItemDisplayName(firstItem.name_snapshot, firstVariant)
                : null
              const moreItems = Math.max(0, (row.items?.length ?? 0) - 1)
              const courier =
                shipping?.courier_name || shipping?.courier
                  ? `${(shipping.courier_name || shipping.courier || '').toUpperCase()}${
                      shipping.service ? ` ${shipping.service}` : ''
                    }`
                  : null

              return (
                <motion.li
                  key={row.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  className="group"
                >
                  <div
                    className={`px-4 transition sm:px-5 ${
                      open ? 'bg-[var(--fill)]/35' : 'hover:bg-[var(--fill)]/25'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3 py-4 lg:flex-nowrap lg:gap-5">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setOpenId(open ? null : row.id)}
                      >
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-display text-[15px] font-semibold tracking-tight text-fg">
                            {row.number}
                          </span>
                          <StatusBadge status={row.status} label={statusLabel(row.status)} />
                          {row.tracking_number ? (
                            <span className="rounded-full bg-[var(--fill)] px-2 py-0.5 font-mono text-[10px] tracking-wide text-muted">
                              {row.tracking_number}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                          <span className="font-medium text-fg/80">{row.customer_name}</span>
                          {row.customer_phone ? (
                            <>
                              <span className="opacity-30">·</span>
                              <span>{row.customer_phone}</span>
                            </>
                          ) : null}
                          {itemPreview ? (
                            <>
                              <span className="opacity-30">·</span>
                              <span className="truncate">
                                {itemPreview}
                                {firstVariant ? ` (${firstVariant})` : ''}
                                {moreItems > 0 ? ` +${moreItems}` : ''}
                              </span>
                            </>
                          ) : null}
                          {when ? (
                            <>
                              <span className="opacity-30">·</span>
                              <span>{when}</span>
                            </>
                          ) : null}
                        </div>
                      </button>

                      <div className="ml-auto flex items-center gap-3 sm:gap-4">
                        <div className="text-right">
                          <div className="font-display text-[15px] font-semibold tabular-nums tracking-tight text-fg">
                            {formatRupiah(row.total)}
                          </div>
                          {(row.shipping_cost ?? 0) > 0 ? (
                            <div className="mt-0.5 text-[11px] tabular-nums text-muted">
                              +{formatRupiah(row.shipping_cost ?? 0)} ongkir
                            </div>
                          ) : null}
                        </div>
                        {actions ? <div className="hidden items-center gap-1.5 md:flex">{actions}</div> : null}
                        <button
                          type="button"
                          aria-label={open ? 'Collapse' : 'Expand'}
                          onClick={() => setOpenId(open ? null : row.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-[var(--fill)] hover:text-fg"
                        >
                          <motion.svg
                            viewBox="0 0 20 20"
                            className="h-4 w-4"
                            animate={{ rotate: open ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            fill="none"
                          >
                            <path
                              d="M5 7.5 10 12.5 15 7.5"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </motion.svg>
                        </button>
                      </div>
                    </div>

                    {actions ? <div className="flex flex-wrap gap-1.5 pb-3 md:hidden">{actions}</div> : null}

                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          key="detail"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-[var(--line)] pb-5 pt-4">
                            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                              {row.customer_address ? (
                                <div className="min-w-0">
                                  <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                                    {t('storefrontOrderAddress')}
                                  </dt>
                                  <dd className="mt-1.5 text-[13px] leading-relaxed text-fg/90 whitespace-pre-wrap">
                                    {row.customer_address}
                                  </dd>
                                </div>
                              ) : null}
                              {shipping || (row.shipping_cost ?? 0) > 0 ? (
                                <div className="min-w-0">
                                  <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                                    {t('storefrontOrderShipping')}
                                  </dt>
                                  <dd className="mt-1.5 text-[13px] text-fg/90">
                                    <div className="font-medium tabular-nums">
                                      {formatRupiah(row.shipping_cost ?? shipping?.cost ?? 0)}
                                    </div>
                                    {courier ? <div className="mt-0.5 text-muted">{courier}</div> : null}
                                    {shipping?.destination_label ? (
                                      <div className="mt-0.5 text-muted">{shipping.destination_label}</div>
                                    ) : null}
                                  </dd>
                                </div>
                              ) : null}
                              {row.tracking_number ? (
                                <div className="min-w-0">
                                  <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                                    {t('storefrontTrackingNumber')}
                                  </dt>
                                  <dd className="mt-1.5 font-mono text-[13px] font-medium tracking-wide text-fg">
                                    {row.tracking_number}
                                  </dd>
                                </div>
                              ) : null}
                              {row.note ? (
                                <div className="min-w-0">
                                  <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                                    {t('storefrontOrderNote')}
                                  </dt>
                                  <dd className="mt-1.5 text-[13px] leading-relaxed text-fg/90 whitespace-pre-wrap">
                                    {row.note}
                                  </dd>
                                </div>
                              ) : null}
                              {row.sale?.number ? (
                                <div className="min-w-0">
                                  <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Sale</dt>
                                  <dd className="mt-1.5 text-[13px] font-medium text-fg">{row.sale.number}</dd>
                                </div>
                              ) : null}
                            </dl>

                            {(row.items?.length ?? 0) > 0 ? (
                              <div className="mt-5">
                                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                                  Items
                                </div>
                                <ul className="space-y-1">
                                  {row.items!.map((item) => {
                                    const variantLabel = formatVariantSnapshot(item.variant_snapshot)
                                    const name = orderItemDisplayName(item.name_snapshot, variantLabel)
                                    return (
                                      <li
                                        key={item.id}
                                        className="flex items-start justify-between gap-4 rounded-xl px-0 py-1.5 text-[13px]"
                                      >
                                        <span className="min-w-0">
                                          <span className="text-fg/90">{name}</span>
                                          <span className="text-muted"> × {item.qty}</span>
                                          {variantLabel ? (
                                            <div className="mt-0.5 text-[12px] text-muted">{variantLabel}</div>
                                          ) : null}
                                        </span>
                                        <span className="shrink-0 tabular-nums text-muted">
                                          {formatRupiah(item.line_total)}
                                        </span>
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </motion.li>
              )
            })}
          </ul>
        )}
      </div>
    </PageEnter>
  )
}
