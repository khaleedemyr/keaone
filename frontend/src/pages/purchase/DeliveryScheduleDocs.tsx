import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterModal } from '../../components/MasterModal'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'

type ScheduleRow = {
  id: number
  purchase_order_id: number
  delivery_date: string
  qty?: number | null
  status: string
  note?: string | null
  is_overdue?: boolean
  order?: { id: number; number: string; status: string } | null
  supplier?: { id: number; name: string } | null
  item?: {
    id: number
    name_snapshot?: string
    product?: { name?: string; sku?: string } | null
  } | null
}

export default function DeliveryScheduleDocs() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const canCreate = can('deliveryschedules', 'create') || can('purchaseorders', 'edit')
  const canEdit = can('deliveryschedules', 'edit') || can('purchaseorders', 'edit')

  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [open, setOpen] = useState(false)
  const [poOptions, setPoOptions] = useState<Array<{ id: number; number: string }>>([])
  const [poId, setPoId] = useState('')
  const [poItems, setPoItems] = useState<Array<{ id: number; name: string; remaining: number }>>([])
  const [itemId, setItemId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'planned', label: t('procurementDeliveryStatusPlanned') },
      { value: 'fulfilled', label: t('procurementDeliveryStatusFulfilled') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ],
    [t],
  )

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<ScheduleRow[]>>('/procurement/delivery-schedules', {
        params: {
          page: list.page,
          per_page: list.perPage,
          search: list.search || undefined,
          status: list.status !== 'all' ? list.status : undefined,
          overdue: overdueOnly ? 1 : undefined,
        },
      })
      setRows(data.data ?? [])
      list.applyMeta(data.meta, data.data?.length ?? 0)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void loadRows()
  }, [list.page, list.perPage, list.search, list.status, overdueOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void Promise.all([
      api.get<ApiOk<Array<{ id: number; number: string }>>>('/purchase-orders', { params: { status: 'ordered', per_page: 100 }, silent: true }),
      api.get<ApiOk<Array<{ id: number; number: string }>>>('/purchase-orders', { params: { status: 'partial', per_page: 100 }, silent: true }),
    ]).then(([ordered, partial]) => {
      const merged = [...(ordered.data.data ?? []), ...(partial.data.data ?? [])]
      const unique = merged.filter((po, i, arr) => arr.findIndex((x) => x.id === po.id) === i)
      setPoOptions(unique)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!poId) {
      setPoItems([])
      setItemId('')
      return
    }
    void api
      .get<ApiOk<{ items?: Array<{ id: number; name_snapshot?: string; product?: { name?: string }; qty: number; qty_received: number }> }>>(`/purchase-orders/${poId}`, { silent: true })
      .then(({ data }) => {
        setPoItems(
          (data.data.items ?? []).map((item) => ({
            id: item.id,
            name: item.product?.name ?? item.name_snapshot ?? `#${item.id}`,
            remaining: Math.max(0, item.qty - item.qty_received),
          })),
        )
      })
      .catch(() => setPoItems([]))
  }, [poId])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!poId || !deliveryDate) {
      setError(t('procurementDeliveryNeedPo'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.post(`/purchase-orders/${poId}/delivery-schedules`, {
        purchase_order_item_id: itemId ? Number(itemId) : undefined,
        delivery_date: deliveryDate,
        qty: itemId ? qty : undefined,
        note: note || undefined,
      })
      setOpen(false)
      setPoId('')
      setItemId('')
      setDeliveryDate('')
      setQty(1)
      setNote('')
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(row: ScheduleRow, action: 'fulfill' | 'cancel') {
    try {
      await api.post(`/purchase-orders/${row.purchase_order_id}/delivery-schedules/${row.id}/${action}`)
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

  if (me?.settings?.delivery_schedule_enabled === false) {
    return (
      <div>
        <PageHeader eyebrow={t('appProcurement')} title={t('procurementDeliveryTitle')} subtitle={t('procurementDeliveryDisabledHint')} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appProcurement')}
        title={t('procurementDeliveryTitle')}
        subtitle={t('procurementDeliverySubtitle')}
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
              {t('procurementDeliveryAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('purchaseSearch')}
        statusOptions={statusOptions}
        extra={
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            {t('procurementDeliveryOverdueOnly')}
          </label>
        }
      />

      <div className="glass overflow-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('purchaseExpectedAt')}</th>
              <th className="px-4 py-3">{t('purchasePoTitle')}</th>
              <th className="px-4 py-3">{t('navSuppliers')}</th>
              <th className="px-4 py-3">{t('procurementDeliveryLine')}</th>
              <th className="px-4 py-3">{t('approvalsQty')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.delivery_date}</div>
                  {row.is_overdue ? <div className="text-xs text-rose-500">{t('procurementDashOverdue')}</div> : null}
                </td>
                <td className="px-4 py-3">{row.order?.number ?? '—'}</td>
                <td className="px-4 py-3">{row.supplier?.name ?? '—'}</td>
                <td className="px-4 py-3">{lineLabel(row)}</td>
                <td className="px-4 py-3">{row.qty ?? '—'}</td>
                <td className="px-4 py-3">{statusLabel(row.status)}</td>
                <td className="px-4 py-3">
                  {canEdit && row.status === 'planned' ? (
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'fulfill')}>
                        {t('procurementDeliveryFulfill')}
                      </button>
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void runAction(row, 'cancel')}>
                        {t('cancel')}
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={t('procurementDeliveryAdd')}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
      >
        <label className="block text-sm text-muted">
          {t('purchasePoTitle')}
          <select className="field" required value={poId} onChange={(e) => setPoId(e.target.value)}>
            <option value="">—</option>
            {poOptions.map((po) => (
              <option key={po.id} value={po.id}>{po.number}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-muted">
          {t('procurementDeliveryDate')}
          <input className="field" type="date" required value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        </label>
        <label className="block text-sm text-muted">
          {t('procurementDeliveryLine')} ({t('filterAll')})
          <select className="field" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">{t('procurementDeliveryWholePo')}</option>
            {poItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name} ({item.remaining})</option>
            ))}
          </select>
        </label>
        {itemId ? (
          <label className="block text-sm text-muted">
            {t('approvalsQty')}
            <input className="field" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
          </label>
        ) : null}
        <label className="block text-sm text-muted">
          {t('purchaseNote')}
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </MasterModal>
    </div>
  )
}
