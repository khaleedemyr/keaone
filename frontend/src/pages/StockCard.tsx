import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../api/client'
import type { ApiOk, Product, Warehouse } from '../types'
import { PageEnter } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { SearchSelect } from '../components/SearchSelect'
import { InventoryScanBar } from '../components/InventoryScanBar'
import { MASTER_PER_PAGE, MasterPager } from '../components/MasterListBar'
import { useI18n, type MsgKey } from '../i18n'
import { formatRupiah } from '../lib/money'
import { buildTrackableProductOptions, productVariantLabel } from '../lib/productScan'
import { isStockSourceClickable, stockMovementTypeLabel } from './inventory/inventoryDocUtils'
import { StockSourceDocModal } from './inventory/StockSourceDocModal'

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
  user?: { id: number; name: string } | null
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

type Tab = 'movements' | 'activity'

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

function changeClass(qty: number) {
  return qty > 0 ? 'text-emerald-600' : qty < 0 ? 'text-rose-600' : 'text-fg'
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
  const [tab, setTab] = useState<Tab>('movements')
  const [source, setSource] = useState<{ refType: string; refId: number } | null>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(20)

  const productOptions = useMemo(() => buildTrackableProductOptions(products), [products])
  const trackableProducts = useMemo(() => products.filter((p) => p.track_stock), [products])
  const movements = card?.movements ?? []

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
      setLastPage(1)
      setTotal(0)
      return
    }
    try {
      const { data } = await api.get<ApiOk<CardPayload>>('/stock/movements', {
        params: {
          product_id: Number(productId),
          warehouse_id: warehouseId || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          per_page: perPage,
        },
      })
      setCard(data.data)
      const last = data.meta?.last_page ?? 1
      setLastPage(last)
      setTotal(data.meta?.total ?? data.data.movements.length)
      if (page > last) setPage(last)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void load()
  }, [productId, warehouseId, from, to, page, perPage]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetPage(next: () => void) {
    setPage(1)
    next()
  }

  function openSource(row: Movement) {
    if (!isStockSourceClickable(row.ref_type, row.ref_id)) return
    setSource({ refType: row.ref_type!, refId: row.ref_id! })
  }

  return (
    <PageEnter>
      <PageHeader eyebrow={t('menuStock')} title={t('stockCardTitle')} subtitle={t('stockCardSubtitle')} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-muted">
          {t('navWarehouses')}
          <select
            className="field !mt-1 min-w-[180px]"
            value={warehouseId}
            onChange={(e) => resetPage(() => setWarehouseId(e.target.value))}
          >
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
            onChange={(value) => resetPage(() => setProductId(value))}
            options={productOptions}
            placeholder={t('purchasePickProduct')}
          />
        </label>
        <label className="text-sm text-muted">
          {t('stockFrom')}
          <input
            type="date"
            className="field !mt-1"
            value={from}
            onChange={(e) => resetPage(() => setFrom(e.target.value))}
          />
        </label>
        <label className="text-sm text-muted">
          {t('stockTo')}
          <input
            type="date"
            className="field !mt-1"
            value={to}
            onChange={(e) => resetPage(() => setTo(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          {t('perPage')}
          <select
            className="field !mt-0 w-20"
            value={perPage}
            onChange={(e) => {
              setPage(1)
              setPerPage(Number(e.target.value))
            }}
          >
            {MASTER_PER_PAGE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 max-w-xl">
        <div className="mb-1 text-sm text-muted">{t('stockScanTitle')}</div>
        <InventoryScanBar
          products={trackableProducts}
          productOptions={productOptions}
          onPick={(product) => resetPage(() => setProductId(String(product.id)))}
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

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={tab === 'movements' ? 'btn-primary !px-3 !py-1.5 !text-xs' : 'btn-ghost !px-3 !py-1.5 !text-xs'}
          onClick={() => setTab('movements')}
        >
          {t('stockCardTabMovements')}
        </button>
        <button
          type="button"
          className={tab === 'activity' ? 'btn-primary !px-3 !py-1.5 !text-xs' : 'btn-ghost !px-3 !py-1.5 !text-xs'}
          onClick={() => setTab('activity')}
        >
          {t('stockCardTabActivity')}
        </button>
      </div>

      {tab === 'movements' ? (
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
              {movements.map((row) => {
                const clickable = isStockSourceClickable(row.ref_type, row.ref_id)
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-line ${clickable ? 'cursor-pointer hover:bg-fill/70' : ''}`}
                    onClick={() => openSource(row)}
                    onKeyDown={(e) => {
                      if (!clickable) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openSource(row)
                      }
                    }}
                    tabIndex={clickable ? 0 : undefined}
                    title={clickable ? t('stockCardOpenSource') : undefined}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{new Date(row.created_at).toLocaleString(locale)}</td>
                    <td className={`px-3 py-2 ${clickable ? 'font-medium text-mint' : ''}`}>
                      {stockMovementTypeLabel(row.type, t)}
                    </td>
                    <td className={`px-3 py-2 font-medium tabular-nums ${changeClass(row.qty_change)}`}>
                      {row.qty_change_display ?? row.qty_change}
                    </td>
                    <td className="px-3 py-2 text-base font-semibold tabular-nums text-fg">
                      {row.qty_after_display ?? row.qty_after}
                    </td>
                    <td className="px-3 py-2">{formatRupiah(row.unit_cost ?? 0, locale)}</td>
                    <td className="px-3 py-2">{formatRupiah(row.cost_amount ?? 0, locale)}</td>
                    <td className="px-3 py-2 text-muted">{row.note ?? '—'}</td>
                  </tr>
                )
              })}
              {!card || movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted">
                    {t('stockCardEmpty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-line">
          {movements.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">{t('logsEmpty')}</div>
          ) : (
            <ul className="divide-y divide-line">
              {movements.map((row) => {
                const clickable = isStockSourceClickable(row.ref_type, row.ref_id)
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => openSource(row)}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition ${
                        clickable ? 'hover:bg-fill/70' : 'cursor-default opacity-90'
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className={`text-sm font-medium ${clickable ? 'text-mint' : 'text-fg'}`}>
                          {stockMovementTypeLabel(row.type, t)}
                        </div>
                        <div className="text-xs text-muted">{new Date(row.created_at).toLocaleString(locale)}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className={`font-medium tabular-nums ${changeClass(row.qty_change)}`}>
                          {row.qty_change_display ?? row.qty_change}
                        </span>
                        <span className="text-muted">
                          {t('stockAfter')}:{' '}
                          <span className="font-semibold text-fg">{row.qty_after_display ?? row.qty_after}</span>
                        </span>
                        {row.user?.name ? (
                          <span className="text-muted">
                            {t('purchaseCreatedBy')}: <span className="text-fg">{row.user.name}</span>
                          </span>
                        ) : null}
                      </div>
                      {row.note ? <div className="text-xs text-muted">{row.note}</div> : null}
                      {clickable ? <div className="text-[11px] text-mint/80">{t('stockCardOpenSource')}</div> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {card ? <MasterPager page={page} lastPage={lastPage} total={total} onPage={setPage} /> : null}

      <StockSourceDocModal
        open={Boolean(source)}
        refType={source?.refType ?? null}
        refId={source?.refId ?? null}
        onClose={() => setSource(null)}
      />
    </PageEnter>
  )
}
