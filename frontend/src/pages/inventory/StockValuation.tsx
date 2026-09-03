import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Category, Warehouse } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useI18n } from '../../i18n'
import { formatRupiah } from '../../lib/money'

type ValuationRow = {
  warehouse_id: number
  warehouse_name: string
  product_id: number
  product_name: string
  sku: string | null
  unit: string
  category_id: number | null
  category_name: string | null
  qty: number
  unit_cost: number
  cost_value: number
}

type MutationRow = {
  type: string
  qty_in: number
  qty_out: number
  cost_in: number
  cost_out: number
}

type Tab = 'valuation' | 'mutations'

export default function StockValuation() {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [tab, setTab] = useState<Tab>('valuation')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<ValuationRow[]>([])
  const [mutations, setMutations] = useState<MutationRow[]>([])
  const [totals, setTotals] = useState({ qty: 0, cost_value: 0 })
  const [mutationTotals, setMutationTotals] = useState({ qty_in: 0, qty_out: 0, cost_in: 0, cost_out: 0 })
  const [method, setMethod] = useState('')

  const methodLabel = useMemo(() => {
    if (method === 'fifo') return t('inventoryCostingFifo')
    if (method === 'average') return t('inventoryCostingAverage')
    if (method === 'moving_average') return t('inventoryCostingMovingAverage')
    return method || '—'
  }, [method, t])

  useEffect(() => {
    void Promise.all([
      api.get<ApiOk<Warehouse[]>>('/warehouses', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true }),
      api.get<ApiOk<Category[]>>('/categories', { params: { for_select: 1, status: 'active', per_page: 200 }, silent: true }),
    ])
      .then(([wh, cat]) => {
        setWarehouses(wh.data.data ?? [])
        setCategories(cat.data.data ?? [])
      })
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  async function loadValuation() {
    try {
      const { data } = await api.get<
        ApiOk<{ rows: ValuationRow[]; totals: { qty: number; cost_value: number }; method: string }>
      >('/stock/valuation', {
        params: {
          warehouse_id: warehouseId || undefined,
          category_id: categoryId || undefined,
        },
      })
      setRows(data.data.rows ?? [])
      setTotals(data.data.totals ?? { qty: 0, cost_value: 0 })
      setMethod(data.data.method ?? '')
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function loadMutations() {
    try {
      const { data } = await api.get<
        ApiOk<{
          rows: MutationRow[]
          totals: { qty_in: number; qty_out: number; cost_in: number; cost_out: number }
        }>
      >('/stock/mutations', {
        params: {
          warehouse_id: warehouseId || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      })
      setMutations(data.data.rows ?? [])
      setMutationTotals(data.data.totals ?? { qty_in: 0, qty_out: 0, cost_in: 0, cost_out: 0 })
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    if (tab === 'valuation') void loadValuation()
    else void loadMutations()
  }, [tab, warehouseId, categoryId, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader eyebrow={t('appInventory')} title={t('stockValuationTitle')} subtitle={t('stockValuationHint')} />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-sm ${tab === 'valuation' ? 'bg-mint/20 text-fg' : 'text-muted'}`}
          onClick={() => setTab('valuation')}
        >
          {t('stockValuationTab')}
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-sm ${tab === 'mutations' ? 'bg-mint/20 text-fg' : 'text-muted'}`}
          onClick={() => setTab('mutations')}
        >
          {t('stockMutationsTab')}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-muted">
          {t('navWarehouses')}
          <select className="field !mt-1 min-w-[180px]" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">{t('filterAll')}</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </label>
        {tab === 'valuation' ? (
          <label className="text-sm text-muted">
            {t('navCategories')}
            <select className="field !mt-1 min-w-[180px]" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t('filterAll')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="text-sm text-muted">
              {t('stockMutationsFrom')}
              <input className="field !mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-sm text-muted">
              {t('stockMutationsTo')}
              <input className="field !mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
      </div>

      {tab === 'valuation' ? (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-sm text-muted">
            <span>
              {t('inventoryCostingMethod')}: <strong className="text-fg">{methodLabel}</strong>
            </span>
            <span>
              {t('stockQty')}: <strong className="text-fg">{totals.qty}</strong>
            </span>
            <span>
              {t('stockValue')}: <strong className="text-fg">{formatRupiah(totals.cost_value, locale)}</strong>
            </span>
          </div>
          <div className="glass overflow-auto rounded-3xl">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">{t('navWarehouses')}</th>
                  <th className="px-4 py-3">{t('product')}</th>
                  <th className="px-4 py-3">{t('navCategories')}</th>
                  <th className="px-4 py-3 text-right">{t('stockQty')}</th>
                  <th className="px-4 py-3 text-right">{t('stockUnitCost')}</th>
                  <th className="px-4 py-3 text-right">{t('stockValue')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.warehouse_id}-${row.product_id}`} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3">{row.warehouse_name}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.product_name}</div>
                      <div className="text-xs text-muted">{row.sku ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.category_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {row.qty} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right">{formatRupiah(row.unit_cost, locale)}</td>
                    <td className="px-4 py-3 text-right">{formatRupiah(row.cost_value, locale)}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      {t('stockValuationEmpty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-sm text-muted">
            <span>
              {t('stockMutationsQtyIn')}: <strong className="text-fg">{mutationTotals.qty_in}</strong> /{' '}
              {formatRupiah(mutationTotals.cost_in, locale)}
            </span>
            <span>
              {t('stockMutationsQtyOut')}: <strong className="text-fg">{mutationTotals.qty_out}</strong> /{' '}
              {formatRupiah(mutationTotals.cost_out, locale)}
            </span>
          </div>
          <div className="glass overflow-auto rounded-3xl">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">{t('stockMutationsType')}</th>
                  <th className="px-4 py-3 text-right">{t('stockMutationsQtyIn')}</th>
                  <th className="px-4 py-3 text-right">{t('stockMutationsQtyOut')}</th>
                  <th className="px-4 py-3 text-right">{t('stockMutationsCostIn')}</th>
                  <th className="px-4 py-3 text-right">{t('stockMutationsCostOut')}</th>
                </tr>
              </thead>
              <tbody>
                {mutations.map((row) => (
                  <tr key={row.type} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3 font-medium">{row.type}</td>
                    <td className="px-4 py-3 text-right">{row.qty_in}</td>
                    <td className="px-4 py-3 text-right">{row.qty_out}</td>
                    <td className="px-4 py-3 text-right">{formatRupiah(row.cost_in, locale)}</td>
                    <td className="px-4 py-3 text-right">{formatRupiah(row.cost_out, locale)}</td>
                  </tr>
                ))}
                {mutations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      {t('stockMutationsEmpty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
