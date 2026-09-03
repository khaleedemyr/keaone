import { useEffect, useState } from 'react'
import { api, apiMessage } from '../api/client'
import type { ApiOk, Warehouse } from '../types'
import { PageEnter } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { MasterPager } from '../components/MasterListBar'
import { PageHeader } from '../components/ui'
import { useI18n } from '../i18n'
import { useAccess } from '../access'
import { useAuth } from '../auth'
import { useDesktop } from '../desktop/DesktopContext'
import { formatRupiah } from '../lib/money'

type StockFilter = 'all' | 'low' | 'over'

type StockRow = {
  product_id: number
  name: string
  sku: string | null
  barcode: string | null
  qty: number
  qty_display?: string
  min_stock: number
  max_stock?: number
  reorder_qty?: number
  unit: string
  warehouse_id: number
  warehouse_name: string
  unit_cost?: number
  cost_value?: number
}

type Suggestion = {
  product_id: number
  name: string
  sku: string | null
  stock_qty: number
  min_stock: number
  suggested_qty: number
  warehouse_id: number
  warehouse_name: string
}

export default function StockPage({ onOpenCard }: { onOpenCard?: (productId: number, warehouseId: number) => void }) {
  const { t, locale } = useI18n()
  const { can, hasModule } = useAccess()
  const { me } = useAuth()
  const desktop = useDesktop()
  const feedback = useFeedback()
  const [rows, setRows] = useState<StockRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [filter, setFilter] = useState<StockFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [creatingPr, setCreatingPr] = useState(false)
  const perPage = 50

  const canCreatePr = hasModule('purchase') && can('purchaserequisitions', 'create') && me?.modules?.purchase

  async function load() {
    try {
      const path = filter === 'low' ? '/stock/low' : filter === 'over' ? '/stock/over' : '/stock'
      const { data } = await api.get<ApiOk<StockRow[]>>(path, {
        params: {
          warehouse_id: warehouseId || undefined,
          search: query.trim() || undefined,
          page,
          per_page: perPage,
        },
      })
      setRows(data.data)
      setLastPage(data.meta.last_page ?? 1)
      setTotal(data.meta.total ?? data.data.length)
      if (page > (data.meta.last_page ?? 1)) setPage(data.meta.last_page ?? 1)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function loadSuggestions() {
    if (!warehouseId) return
    try {
      const { data } = await api.get<ApiOk<Suggestion[]>>('/stock/reorder-suggestions', {
        params: { warehouse_id: warehouseId },
        silent: true,
      })
      setSuggestions(data.data ?? [])
    } catch {
      setSuggestions([])
    }
  }

  useEffect(() => {
    void api
      .get<ApiOk<Warehouse[]>>('/warehouses', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true })
      .then(({ data }) => {
        setWarehouses(data.data)
        const def = data.data.find((w) => w.is_default)
        if (def && !warehouseId) setWarehouseId(String(def.id))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!warehouseId && warehouses.length === 0) return
    void load()
    void loadSuggestions()
  }, [warehouseId, filter, page, query])

  async function createReorderPr() {
    if (!canCreatePr || !warehouseId) return
    setCreatingPr(true)
    try {
      const { data } = await api.post<ApiOk<{ id: number; number: string }>>('/stock/reorder-suggestions/create-pr', {
        warehouse_id: Number(warehouseId),
      })
      feedback.success(`${t('stockReorderPrCreated')} ${data.data.number}`)
      desktop.openApp('purchase')
      void loadSuggestions()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setCreatingPr(false)
    }
  }

  function rowClass(row: StockRow) {
    if (row.qty <= row.min_stock) return 'bg-rose-500/5'
    if ((row.max_stock ?? 0) > 0 && row.qty > (row.max_stock ?? 0)) return 'bg-amber-500/5'
    return ''
  }

  return (
    <PageEnter>
      <PageHeader eyebrow={t('menuStock')} title={t('stockTitle')} subtitle={t('stockSubtitle')} />

      {suggestions.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/5 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-fg">{t('stockReorderAlertTitle')}</div>
            <div className="text-xs text-muted">
              {t('stockReorderAlertHint').replace('{count}', String(suggestions.length))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost !text-xs" onClick={() => { setFilter('low'); setPage(1) }}>
              {t('stockLowOnly')}
            </button>
            {canCreatePr ? (
              <button type="button" className="btn-primary !text-xs" disabled={creatingPr} onClick={() => void createReorderPr()}>
                {creatingPr ? '…' : t('stockCreateReorderPr')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-muted">
          {t('navWarehouses')}
          <select className="field !mt-1 min-w-[200px]" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          {t('search')}
          <input
            className="field !mt-1 min-w-[200px]"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder={t('stockSearch')}
          />
        </label>
        <label className="text-sm text-muted">
          {t('status')}
          <select
            className="field !mt-1 min-w-[160px]"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as StockFilter)
              setPage(1)
            }}
          >
            <option value="all">{t('filterAll')}</option>
            <option value="low">{t('stockLowOnly')}</option>
            <option value="over">{t('stockOverOnly')}</option>
          </select>
        </label>
      </div>

      <div className="overflow-auto rounded-2xl border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-fill text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">{t('product')}</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">{t('stockQty')}</th>
              <th className="px-3 py-2">{t('stockUnitCost')}</th>
              <th className="px-3 py-2">{t('stockValue')}</th>
              <th className="px-3 py-2">{t('minStock')}</th>
              <th className="px-3 py-2">{t('maxStock')}</th>
              <th className="px-3 py-2">{t('reorderQty')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product_id} className={`border-t border-line ${rowClass(row)}`}>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-muted">{row.sku ?? '—'}</td>
                <td className="px-3 py-2">
                  <div>{row.qty_display ?? `${row.qty} ${row.unit}`}</div>
                  {row.qty_display && row.qty_display !== `${row.qty} ${row.unit}` ? (
                    <div className="text-xs text-muted">
                      {row.qty} {row.unit}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">{formatRupiah(row.unit_cost ?? 0, locale)}</td>
                <td className="px-3 py-2 text-right">{formatRupiah(row.cost_value ?? 0, locale)}</td>
                <td className="px-3 py-2 text-muted">{row.min_stock}</td>
                <td className="px-3 py-2 text-muted">{(row.max_stock ?? 0) > 0 ? row.max_stock : '—'}</td>
                <td className="px-3 py-2 text-muted">{row.reorder_qty ?? 0}</td>
                <td className="px-3 py-2 text-right">
                  {onOpenCard ? (
                    <button
                      type="button"
                      className="btn-ghost !px-2 !text-xs"
                      onClick={() => onOpenCard(row.product_id, row.warehouse_id)}
                    >
                      {t('stockCardOpen')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted">
                  {t('stockEmpty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MasterPager page={page} lastPage={lastPage} total={total} onPage={setPage} />
    </PageEnter>
  )
}
