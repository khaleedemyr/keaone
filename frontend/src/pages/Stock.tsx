import { useEffect, useState } from 'react'
import { api, apiMessage } from '../api/client'
import type { ApiOk, Warehouse } from '../types'
import { PageEnter } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { MasterPager } from '../components/MasterListBar'
import { PageHeader } from '../components/ui'
import { useI18n } from '../i18n'

type StockRow = {
  product_id: number
  name: string
  sku: string | null
  barcode: string | null
  qty: number
  qty_display?: string
  min_stock: number
  unit: string
  warehouse_id: number
  warehouse_name: string
}

export default function StockPage({ onOpenCard }: { onOpenCard?: (productId: number, warehouseId: number) => void }) {
  const { t } = useI18n()
  const feedback = useFeedback()
  const [rows, setRows] = useState<StockRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 50

  async function load() {
    try {
      const path = lowOnly ? '/stock/low' : '/stock'
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
  }, [warehouseId, lowOnly, page, query])

  return (
    <PageEnter>
      <PageHeader eyebrow={t('menuStock')} title={t('stockTitle')} subtitle={t('stockSubtitle')} />

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
        <label className="flex items-center gap-2 pb-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => {
              setLowOnly(e.target.checked)
              setPage(1)
            }}
          />
          {t('stockLowOnly')}
        </label>
      </div>

      <div className="overflow-auto rounded-2xl border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-fill text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">{t('product')}</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">{t('stockQty')}</th>
              <th className="px-3 py-2">{t('minStock')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product_id} className={`border-t border-line ${row.qty <= row.min_stock ? 'bg-rose-500/5' : ''}`}>
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
                <td className="px-3 py-2 text-muted">{row.min_stock}</td>
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
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
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
