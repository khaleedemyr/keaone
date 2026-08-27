import { useEffect, useState } from 'react'
import { api, apiMessage } from '../api/client'
import type { ApiOk, Warehouse } from '../types'
import { PageEnter } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { useI18n } from '../i18n'

type Movement = {
  id: number
  created_at: string
  type: string
  qty_change: number
  qty_after: number
  qty_change_display?: string
  qty_after_display?: string
  qty_input?: number | null
  unit?: string | null
  unit_level?: string | null
  ref_type: string | null
  ref_id: number | null
  note: string | null
}

type CardPayload = {
  product: { id: number; name: string; sku: string | null; unit: string; min_stock: number }
  warehouse: { id: number; name: string }
  qty: number
  qty_display?: string
  movements: Movement[]
}

export default function StockCardPage({
  initialProductId,
  initialWarehouseId,
}: {
  initialProductId?: number
  initialWarehouseId?: number
}) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<{ id: number; name: string }[]>([])
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ? String(initialWarehouseId) : '')
  const [productId, setProductId] = useState(initialProductId ? String(initialProductId) : '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [card, setCard] = useState<CardPayload | null>(null)

  useEffect(() => {
    void api
      .get<ApiOk<Warehouse[]>>('/warehouses', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true })
      .then(({ data }) => {
        setWarehouses(data.data)
        if (!warehouseId) {
          const def = data.data.find((w) => w.is_default) ?? data.data[0]
          if (def) setWarehouseId(String(def.id))
        }
      })
      .catch(() => {})
    void api
      .get<ApiOk<{ id: number; name: string }[]>>('/products', {
        params: { for_select: 1, status: 'active', per_page: 100 },
        silent: true,
      })
      .then(({ data }) => setProducts(data.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (initialProductId) setProductId(String(initialProductId))
    if (initialWarehouseId) setWarehouseId(String(initialWarehouseId))
  }, [initialProductId, initialWarehouseId])

  async function load() {
    if (!productId) {
      setCard(null)
      return
    }
    try {
      const { data } = await api.get<ApiOk<CardPayload>>('/stock/movements', {
        params: {
          product_id: Number(productId),
          warehouse_id: warehouseId || undefined,
          from: from || undefined,
          to: to || undefined,
          per_page: 100,
        },
      })
      setCard(data.data)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void load()
  }, [productId, warehouseId, from, to])

  return (
    <PageEnter>
      <PageHeader eyebrow={t('menuStock')} title={t('stockCardTitle')} subtitle={t('stockCardSubtitle')} />

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm text-muted">
          {t('navWarehouses')}
          <select className="field !mt-1 min-w-[180px]" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          {t('product')}
          <select className="field !mt-1 min-w-[220px]" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{t('purchasePickProduct')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          {t('stockFrom')}
          <input type="date" className="field !mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          {t('stockTo')}
          <input type="date" className="field !mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {card ? (
        <div className="mb-4 rounded-2xl border border-line bg-fill px-4 py-3 text-sm">
          <div className="font-medium text-fg">{card.product.name}</div>
          <div className="mt-1 text-muted">
            {card.warehouse.name} · {t('stockQty')}: {card.qty_display ?? `${card.qty} ${card.product.unit}`}
          </div>
        </div>
      ) : null}

      <div className="overflow-auto rounded-2xl border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-fill text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">{t('stockTime')}</th>
              <th className="px-3 py-2">{t('stockType')}</th>
              <th className="px-3 py-2">{t('stockChange')}</th>
              <th className="px-3 py-2">{t('stockAfter')}</th>
              <th className="px-3 py-2">{t('purchaseNote')}</th>
            </tr>
          </thead>
          <tbody>
            {(card?.movements ?? []).map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-3 py-2 text-muted">
                  {m.created_at ? new Date(m.created_at).toLocaleString(locale) : '—'}
                </td>
                <td className="px-3 py-2">{m.type}</td>
                <td className={`px-3 py-2 font-medium ${m.qty_change < 0 ? 'text-rose-400' : 'text-mint'}`}>
                  <div>{m.qty_change_display ?? (m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change)}</div>
                  {m.qty_input != null && m.unit ? (
                    <div className="text-xs font-normal text-muted">
                      {m.qty_input} {m.unit}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2">{m.qty_after_display ?? m.qty_after}</td>
                <td className="px-3 py-2 text-muted">{m.note ?? '—'}</td>
              </tr>
            ))}
            {!card || card.movements.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  {t('stockCardEmpty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageEnter>
  )
}
