import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import type { ApiOk } from '../../types'
import type { StorefrontAdmin, StorefrontProductRow } from './types'

type ProductOption = { id: number; name: string; sku?: string | null; sell_price?: number }

export default function StorefrontProducts() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canCreate = can('storefrontproducts', 'create')
  const canEdit = can('storefrontproducts', 'edit')
  const canDelete = can('storefrontproducts', 'delete')
  const [rows, setRows] = useState<StorefrontProductRow[]>([])
  const [stockMode, setStockMode] = useState('realtime')
  const [options, setOptions] = useState<ProductOption[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [allocatedQty, setAllocatedQty] = useState('')
  const [overridePrice, setOverridePrice] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [sf, list] = await Promise.all([
        api.get<ApiOk<StorefrontAdmin>>('/storefront'),
        api.get<ApiOk<StorefrontProductRow[]>>('/storefront/products?per_page=100'),
      ])
      setStockMode(sf.data.data.stock_mode)
      setRows(list.data.data ?? [])
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function loadOptions(search = '') {
    try {
      const { data } = await api.get<ApiOk<ProductOption[]>>(
        `/storefront/product-options?per_page=30&search=${encodeURIComponent(search)}`,
      )
      setOptions(data.data ?? [])
    } catch {
      setOptions([])
    }
  }

  useEffect(() => {
    void load()
    void loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadOptions(productSearch.trim())
    }, 250)
    return () => window.clearTimeout(id)
  }, [productSearch])

  async function onAdd() {
    if (!canCreate || !productId) return
    setBusy(true)
    try {
      await api.post('/storefront/products', {
        product_id: Number(productId),
        allocated_qty: allocatedQty === '' ? null : Number(allocatedQty),
        override_price: overridePrice === '' ? null : Number(overridePrice),
        is_visible: true,
      })
      setProductId('')
      setAllocatedQty('')
      setOverridePrice('')
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function patchRow(row: StorefrontProductRow, patch: Record<string, unknown>) {
    if (!canEdit) return
    setBusy(true)
    try {
      await api.put(`/storefront/products/${row.id}`, patch)
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function onRemove(id: number) {
    if (!canDelete) return
    setBusy(true)
    try {
      await api.delete(`/storefront/products/${id}`)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t('appStorefront')} title={t('storefrontProductsTitle')} subtitle={t('storefrontProductsHint')} />

      {canCreate ? (
        <div className="glass flex max-w-3xl flex-wrap items-end gap-2 rounded-3xl p-5">
          <label className="min-w-40 flex-1 space-y-1 text-sm">
            <span className="text-muted">{t('storefrontSearchProduct')}</span>
            <input
              className="field w-full"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder={t('storefrontSearchProduct')}
            />
          </label>
          <label className="min-w-48 flex-1 space-y-1 text-sm">
            <span className="text-muted">{t('storefrontAddProduct')}</span>
            <select className="field w-full" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">—</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="w-32 space-y-1 text-sm">
            <span className="text-muted">{t('storefrontOverridePrice')}</span>
            <input
              className="field w-full"
              type="number"
              min={0}
              value={overridePrice}
              onChange={(e) => setOverridePrice(e.target.value)}
              placeholder="—"
            />
          </label>
          {stockMode === 'allocated' ? (
            <label className="w-28 space-y-1 text-sm">
              <span className="text-muted">{t('storefrontAllocatedQty')}</span>
              <input
                className="field w-full"
                type="number"
                min={0}
                value={allocatedQty}
                onChange={(e) => setAllocatedQty(e.target.value)}
              />
            </label>
          ) : null}
          <button type="button" className="btn-primary" disabled={busy || !productId} onClick={() => void onAdd()}>
            {t('storefrontAdd')}
          </button>
        </div>
      ) : null}

      <div className="glass max-w-3xl space-y-2 rounded-3xl p-5">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t('storefrontEmptyProducts')}</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {row.product?.name ?? `#${row.product_id}`}
                  {!row.is_visible ? (
                    <span className="ml-2 text-[11px] font-normal text-amber-700">· {t('storefrontHidden')}</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted">
                  {row.product?.sku ? `${row.product.sku} · ` : ''}
                  {formatRupiah(row.override_price ?? row.product?.sell_price ?? 0)}
                  {row.override_price != null ? ' (override)' : ''}
                  {stockMode === 'allocated' ? ` · alloc ${row.allocated_qty ?? 0} / sold ${row.sold_qty}` : ''}
                  {` · ${t('storefrontSortOrder')} ${row.sort_order}`}
                  {row.units_sold != null ? ` · ${row.units_sold} terjual` : ''}
                  {row.review_count ? ` · ★ ${row.avg_rating?.toFixed?.(1) ?? row.avg_rating} (${row.review_count})` : ''}
                </div>
                {canEdit ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(
                      [
                        ['is_deal', 'Deal', row.is_deal],
                        ['is_new_arrival', 'New', row.is_new_arrival],
                        ['is_bestseller', 'Best', row.is_bestseller],
                      ] as const
                    ).map(([key, label, on]) => (
                      <button
                        key={key}
                        type="button"
                        disabled={busy}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                          on ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-500'
                        }`}
                        onClick={() => void patchRow(row, { [key]: !on })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost text-sm"
                      disabled={busy}
                      onClick={() => void patchRow(row, { is_visible: !row.is_visible })}
                    >
                      {row.is_visible ? t('storefrontHideBlock') : t('storefrontShowBlock')}
                    </button>
                    <input
                      className="field w-28"
                      type="number"
                      min={0}
                      title={t('storefrontOverridePrice')}
                      defaultValue={row.override_price ?? ''}
                      key={`price-${row.id}-${row.override_price ?? 'x'}`}
                      onBlur={(e) => {
                        const raw = e.target.value.trim()
                        const next = raw === '' ? null : Number(raw)
                        if (next === row.override_price || (next == null && row.override_price == null)) return
                        void patchRow(row, { override_price: next })
                      }}
                    />
                    <input
                      className="field w-20"
                      type="number"
                      min={0}
                      title={t('storefrontSortOrder')}
                      defaultValue={row.sort_order}
                      key={`sort-${row.id}-${row.sort_order}`}
                      onBlur={(e) => {
                        const next = Math.max(0, Number(e.target.value) || 0)
                        if (next === row.sort_order) return
                        void patchRow(row, { sort_order: next })
                      }}
                    />
                    {stockMode === 'allocated' ? (
                      <input
                        className="field w-24"
                        type="number"
                        min={0}
                        defaultValue={row.allocated_qty ?? ''}
                        key={`alloc-${row.id}-${row.allocated_qty ?? 'x'}`}
                        onBlur={(e) => {
                          const raw = e.target.value.trim()
                          const next = raw === '' ? null : Number(raw)
                          if (next === row.allocated_qty || (next == null && row.allocated_qty == null)) return
                          void patchRow(row, { allocated_qty: next })
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
                {canDelete ? (
                  <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void onRemove(row.id)}>
                    {t('delete')}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
