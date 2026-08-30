import { useEffect, useState, type FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk } from '../../types'
import { useFeedback } from '../../components/feedback'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'

type PoItem = {
  id: number
  name_snapshot?: string
  product?: { name?: string } | null
  qty: number
  qty_received: number
}

type ScheduleRow = {
  id: number
  delivery_date: string
  qty?: number | null
  status: string
  note?: string | null
  is_overdue?: boolean
  purchase_order_item_id?: number | null
  item?: {
    id: number
    name_snapshot?: string
    product?: { name?: string } | null
  } | null
}

export function PoDeliverySchedulePanel({
  poId,
  poStatus,
  items,
}: {
  poId: number
  poStatus: string
  items: PoItem[]
}) {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const enabled = me?.settings?.delivery_schedule_enabled !== false
  const canEdit = can('deliveryschedules', 'edit') || can('purchaseorders', 'edit')
  const schedulable = enabled && ['ordered', 'partial'].includes(poStatus)

  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadRows() {
    if (!schedulable) return
    setLoading(true)
    try {
      const { data } = await api.get<ApiOk<ScheduleRow[]>>(`/purchase-orders/${poId}/delivery-schedules`, { silent: true })
      setRows(data.data ?? [])
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [poId, schedulable]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!deliveryDate) return
    setSaving(true)
    try {
      await api.post(`/purchase-orders/${poId}/delivery-schedules`, {
        purchase_order_item_id: itemId ? Number(itemId) : undefined,
        delivery_date: deliveryDate,
        qty: itemId ? qty : undefined,
        note: note || undefined,
      })
      feedback.success(t('saved'))
      setOpen(false)
      setItemId('')
      setDeliveryDate('')
      setQty(1)
      setNote('')
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(row: ScheduleRow, action: 'fulfill' | 'cancel') {
    try {
      await api.post(`/purchase-orders/${poId}/delivery-schedules/${row.id}/${action}`)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      planned: t('procurementDeliveryStatusPlanned'),
      fulfilled: t('procurementDeliveryStatusFulfilled'),
      cancelled: t('purchaseStatusCancelled'),
    }
    return map[status] ?? status
  }

  function lineLabel(row: ScheduleRow) {
    if (!row.item) return t('procurementDeliveryWholePo')
    return row.item.product?.name ?? row.item.name_snapshot ?? '—'
  }

  return (
    <section className="mt-4 rounded-2xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-fg">{t('procurementDeliveryTitle')}</div>
          <div className="text-xs text-muted">{t('procurementDeliveryPoHint')}</div>
        </div>
        {canEdit && schedulable ? (
          <button type="button" className="btn-ghost !text-xs" onClick={() => setOpen((v) => !v)}>
            {open ? t('cancel') : t('procurementDeliveryAdd')}
          </button>
        ) : null}
      </div>

      {!schedulable ? (
        <p className="text-xs text-muted">{t('procurementDeliveryNeedOrdered')}</p>
      ) : loading ? (
        <p className="text-xs text-muted">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted">{t('procurementDeliveryEmpty')}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/70 px-3 py-2 text-sm">
              <div>
                <div className="font-medium text-fg">{row.delivery_date}</div>
                <div className="text-xs text-muted">
                  {lineLabel(row)}
                  {row.qty ? ` · ${row.qty}` : ''}
                  {row.note ? ` · ${row.note}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {row.is_overdue ? <span className="text-rose-500">{t('procurementDashOverdue')}</span> : null}
                <span className="text-fg">{statusLabel(row.status)}</span>
                {canEdit && row.status === 'planned' ? (
                  <>
                    <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => void runAction(row, 'fulfill')}>
                      {t('procurementDeliveryFulfill')}
                    </button>
                    <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => void runAction(row, 'cancel')}>
                      {t('cancel')}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && schedulable ? (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-3 grid gap-2 border-t border-line pt-3 md:grid-cols-2">
          <label className="block text-xs text-muted md:col-span-2">
            {t('procurementDeliveryDate')}
            <input className="field !mt-1" type="date" required value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </label>
          <label className="block text-xs text-muted">
            {t('procurementDeliveryLine')} ({t('filterAll')})
            <select className="field !mt-1" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">{t('procurementDeliveryWholePo')}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {(item.product?.name ?? item.name_snapshot ?? `#${item.id}`)} ({Math.max(0, item.qty - item.qty_received)} {t('approvalsQty').toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          {itemId ? (
            <label className="block text-xs text-muted">
              {t('approvalsQty')}
              <input className="field !mt-1" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
            </label>
          ) : null}
          <label className="block text-xs text-muted md:col-span-2">
            {t('purchaseNote')}
            <input className="field !mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary !text-xs" disabled={saving}>
              {t('save')}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
