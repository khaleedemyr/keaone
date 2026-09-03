import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../api/client'
import type { ApiOk, Product, Warehouse } from '../types'
import { PageEnter } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { SearchSelect } from '../components/SearchSelect'
import { InventoryScanBar } from '../components/InventoryScanBar'
import { useI18n, type MsgKey } from '../i18n'
import { formatRupiah } from '../lib/money'
import { buildTrackableProductOptions, productVariantLabel } from '../lib/productScan'

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
  unit_cost?: number
  cost_amount?: number
  costing_method?: string | null
}

type CardPayload = {
  product: { id: number; name: string; sku: string | null; barcode?: string | null; unit: string; min_stock: number }
  warehouse: { id: number; name: string }
  qty: number
  qty_display?: string
  unit_cost?: number
  cost_value?: number
  costing_method?: string
  movements: Movement[]
}

function costingLabel(method: string | undefined, t: (key: MsgKey) => string) {
  switch (method) {
    case 'fifo':
      return t('inventoryCostingFifo')
    case 'average':
      return t('inventoryCostingAverage')
    case 'moving_average':
      return t('inventoryCostingMovingAverage')
    default:
      return method || '—'
  }
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
  const [products, setProducts] = useState<Product[]>([])
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ? String(initialWarehouseId) : '')
  const [productId, setProductId] = useState(initialProductId ? String(initialProductId) : '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [card, setCard] = useState<CardPayload | null>(null)

  const productOptions = useMemo(() => buildTrackableProductOptions(products), [products])
  const trackableProducts = useMemo(() => products.filter((p) => p.track_stock), [products])

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
      .get<ApiOk<Product[]>>('/products', {
        params: { for_select: 1, status: 'active', per_page: 500 },
        silent: true,
      })
      .then(({ data }) => setProducts(data.data ?? []))
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
  }, [productId, warehouseId, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <label className="min-w-[240px] flex-1 text-sm text-muted">
          {t('product')}
          <SearchSelect
            className="!mt-1"
            value={productId}
            onChange={setProductId}
            options={productOptions}
            placeholder={t('purchasePickProduct')}
          />
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

      <div className="mb-4 max-w-xl">
        <div className="mb-1 text-sm text-muted">{t('stockScanTitle')}</div>
        <InventoryScanBar
          products={trackableProducts}
          productOptions={productOptions}
          onPick={(product) => setProductId(String(product.id))}
        />
      </div>

      {card ? (
        <div className="mb-4 rounded-2xl border border-line bg-fill px-4 py-3 text-sm">
          <div className="font-medium text-fg">{productVariantLabel(card.product)}</div>
          <div className="mt-1 text-muted">
            {card.product.barcode ? (
              <>
                {t('barcode')}: {card.product.barcode}
                {' · '}
              </>
            ) : null}
            {card.warehouse.name} · {t('stockQty')}: {card.qty_display ?? `${card.qty} ${card.product.unit}`}
            {' · '}
            {t('stockCostingMethod')}: {costingLabel(card.costing_method, t)}
            {' · '}
            {t('stockUnitCost')}: {formatRupiah(card.unit_cost ?? 0, locale)}
            {' · '}
            {t('stockValue')}: {formatRupiah(card.cost_value ?? 0, locale)}
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
              <th className="px-3 py-2">{t('stockUnitCost')}</th>
              <th className="px-3 py-2">{t('stockCostAmount')}</th>
              <th className="px-3 py-2">{t('purchaseNote')}</th>
            </tr>
          </thead>
          <tbody>
            {(card?.movements ?? []).map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2 whitespace-nowrap text-muted">{new Date(row.created_at).toLocaleString(locale)}</td>
                <td className="px-3 py-2">{row.type}</td>
                <td className="px-3 py-2">{row.qty_change_display ?? row.qty_change}</td>
                <td className="px-3 py-2">{row.qty_after_display ?? row.qty_after}</td>
                <td className="px-3 py-2">{formatRupiah(row.unit_cost ?? 0, locale)}</td>
                <td className="px-3 py-2">{formatRupiah(row.cost_amount ?? 0, locale)}</td>
                <td className="px-3 py-2 text-muted">{row.note ?? '—'}</td>
              </tr>
            ))}
            {!card || card.movements.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
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
