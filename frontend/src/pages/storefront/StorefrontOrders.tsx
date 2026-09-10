import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import type { ApiOk } from '../../types'
import type { StorefrontOrderRow } from './types'

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

export default function StorefrontOrders() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canEdit = can('storefrontorders', 'edit')
  const [rows, setRows] = useState<StorefrontOrderRow[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  async function load(nextStatus = status, nextSearch = search) {
    try {
      const params = new URLSearchParams({ per_page: '50' })
      if (nextStatus) params.set('status', nextStatus)
      if (nextSearch.trim()) params.set('search', nextSearch.trim())
      const { data } = await api.get<ApiOk<StorefrontOrderRow[]>>(`/storefront/orders?${params.toString()}`)
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
      void load(status, search)
    }, 250)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search])

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

  async function ship(id: number) {
    if (!canEdit) return
    setBusy(true)
    try {
      await api.post(`/storefront/orders/${id}/ship`)
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

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t('appStorefront')} title={t('storefrontOrdersTitle')} subtitle={t('storefrontOrdersHint')} />

      <div className="glass flex max-w-3xl flex-wrap items-end gap-2 rounded-3xl p-4">
        <label className="min-w-40 flex-1 space-y-1 text-sm">
          <span className="text-muted">{t('storefrontOrderSearch')}</span>
          <input
            className="field w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('storefrontOrderSearchPlaceholder')}
          />
        </label>
        <label className="w-48 space-y-1 text-sm">
          <span className="text-muted">{t('storefrontOrderFilterStatus')}</span>
          <select className="field w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="glass max-w-3xl space-y-3 rounded-3xl p-5">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t('storefrontEmptyOrders')}</p>
        ) : (
          rows.map((row) => {
            const shipping = row.shipping_snapshot
            return (
              <div key={row.id} className="rounded-2xl border px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {row.number} · {row.customer_name}
                    </div>
                    <div className="text-xs text-muted">
                      {statusLabel(row.status)} · {formatRupiah(row.total)}
                      {row.sale?.number ? ` · Sale ${row.sale.number}` : ''}
                      {row.customer_phone ? ` · ${row.customer_phone}` : ''}
                    </div>
                  </div>
                  {canEdit && (row.status === 'pending_payment' || row.status === 'awaiting_confirmation') ? (
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void confirm(row.id)}>
                        {t('storefrontConfirmPaid')}
                      </button>
                      <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void cancel(row.id)}>
                        {t('storefrontCancelOrder')}
                      </button>
                    </div>
                  ) : null}
                  {canEdit && row.status === 'paid' ? (
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void ship(row.id)}>
                        {t('storefrontMarkShipped')}
                      </button>
                      <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void deliver(row.id)}>
                        {t('storefrontMarkDelivered')}
                      </button>
                    </div>
                  ) : null}
                  {canEdit && row.status === 'shipped' ? (
                    <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void deliver(row.id)}>
                      {t('storefrontMarkDelivered')}
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  {row.customer_address ? (
                    <div>
                      {t('storefrontOrderAddress')}: {row.customer_address}
                    </div>
                  ) : null}
                  {shipping ? (
                    <div>
                      {t('storefrontOrderShipping')}: {formatRupiah(row.shipping_cost ?? shipping.cost ?? 0)}
                      {shipping.courier_name || shipping.courier
                        ? ` · ${(shipping.courier_name || shipping.courier || '').toUpperCase()} ${shipping.service || ''}`
                        : ''}
                      {shipping.destination_label ? ` · ${shipping.destination_label}` : ''}
                    </div>
                  ) : (row.shipping_cost ?? 0) > 0 ? (
                    <div>
                      {t('storefrontOrderShipping')}: {formatRupiah(row.shipping_cost ?? 0)}
                    </div>
                  ) : null}
                  {row.note ? (
                    <div>
                      {t('storefrontOrderNote')}: {row.note}
                    </div>
                  ) : null}
                </div>
                {(row.items?.length ?? 0) > 0 ? (
                  <ul className="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted">
                    {row.items!.map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span>
                          {item.name_snapshot} × {item.qty}
                        </span>
                        <span>{formatRupiah(item.line_total)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
