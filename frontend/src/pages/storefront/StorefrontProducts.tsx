import { useEffect, useState } from 'react'
import { PageEnter } from '../../components/motion'
import { api, apiMessage } from '../../api/client'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import type { ApiOk } from '../../types'
import type { StorefrontAdmin, StorefrontProductRow } from './types'

type ProductOption = { id: number; name: string; sku?: string | null; sell_price?: number }

function productThumb(row: StorefrontProductRow): string | null {
  const images = row.product?.images
  const primary = images?.find((img) => img.is_primary)?.url || images?.[0]?.url
  return primary || row.product?.image_url || null
}

export default function StorefrontProducts() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canCreate = can('storefrontproducts', 'create')
  const canEdit = can('storefrontproducts', 'edit')
  const canDelete = can('storefrontproducts', 'delete')
  const canEditSetup = can('storefrontsetup', 'edit')
  const [rows, setRows] = useState<StorefrontProductRow[]>([])
  const [stockMode, setStockMode] = useState<'realtime' | 'allocated'>('realtime')
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
      setStockMode((sf.data.data.stock_mode as 'realtime' | 'allocated') || 'realtime')
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

  async function changeStockMode(next: 'realtime' | 'allocated') {
    if (!canEditSetup || next === stockMode) return
    setBusy(true)
    try {
      await api.put('/storefront', { stock_mode: next })
      setStockMode(next)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  const fieldSoft = 'field !h-9 !rounded-lg !border-transparent !bg-[var(--fill)]/80 !px-2.5 !py-0 !text-sm'
  const ghostBtn =
    'inline-flex h-9 items-center justify-center rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-fg transition hover:bg-[var(--fill)] disabled:opacity-50'
  const dangerBtn =
    'inline-flex h-9 items-center justify-center rounded-lg border border-rose-500/20 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10 disabled:opacity-50 dark:text-rose-300'

  function BadgeToggles({ row }: { row: StorefrontProductRow }) {
    if (!canEdit) return <span className="text-sm text-muted">—</span>
    return (
      <div className="flex flex-wrap gap-1">
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
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
              on ? 'bg-mint/18 text-fg ring-1 ring-mint/35' : 'bg-[var(--fill)] text-muted hover:text-fg'
            }`}
            onClick={() => void patchRow(row, { [key]: !on })}
          >
            {label}
          </button>
        ))}
      </div>
    )
  }

  function RowActions({ row }: { row: StorefrontProductRow }) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {canEdit ? (
          <button
            type="button"
            className={ghostBtn}
            disabled={busy}
            onClick={() => void patchRow(row, { is_visible: !row.is_visible })}
          >
            {row.is_visible ? t('storefrontHideBlock') : t('storefrontShowBlock')}
          </button>
        ) : null}
        {canDelete ? (
          <button type="button" className={dangerBtn} disabled={busy} onClick={() => void onRemove(row.id)}>
            {t('delete')}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <PageEnter className="w-full max-w-none space-y-5">
      <PageHeader
        eyebrow={t('appStorefront')}
        title={t('storefrontProductsTitle')}
        subtitle={t('storefrontProductsHint')}
        action={
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Products</div>
            <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums tracking-tight text-fg">
              {rows.length}
            </div>
          </div>
        }
      />

      <div className="glass w-full rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{t('storefrontStockMode')}</div>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              {stockMode === 'allocated' ? t('storefrontStockAllocatedHint') : t('storefrontStockRealtimeHint')}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['realtime', t('storefrontStockRealtime')],
                ['allocated', t('storefrontStockAllocated')],
              ] as const
            ).map(([mode, label]) => {
              const active = stockMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={busy || !canEditSetup}
                  onClick={() => void changeStockMode(mode)}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition disabled:opacity-50 ${
                    active
                      ? 'bg-mint/18 text-fg ring-1 ring-mint/35'
                      : 'bg-[var(--fill)] text-muted hover:text-fg'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {canCreate ? (
        <div className="glass w-full rounded-[28px] p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1.4fr_160px_140px_auto] xl:items-end">
            <label className="space-y-1.5 text-sm">
              <span className="text-muted">{t('storefrontSearchProduct')}</span>
              <input
                className="field w-full !rounded-xl !border-transparent !bg-[var(--fill)]/80"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={t('storefrontSearchProduct')}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted">{t('storefrontAddProduct')}</span>
              <select
                className="field w-full !rounded-xl !border-transparent !bg-[var(--fill)]/80"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">—</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` (${p.sku})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted">{t('storefrontOverridePrice')}</span>
              <input
                className="field w-full !rounded-xl !border-transparent !bg-[var(--fill)]/80"
                type="number"
                min={0}
                value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
                placeholder="—"
              />
            </label>
            {stockMode === 'allocated' ? (
              <label className="space-y-1.5 text-sm">
                <span className="text-muted">{t('storefrontAllocatedQty')}</span>
                <input
                  className="field w-full !rounded-xl !border-transparent !bg-[var(--fill)]/80"
                  type="number"
                  min={0}
                  value={allocatedQty}
                  onChange={(e) => setAllocatedQty(e.target.value)}
                />
              </label>
            ) : (
              <div className="hidden xl:block" />
            )}
            <button
              type="button"
              className="btn-primary w-full xl:w-auto xl:justify-self-start"
              disabled={busy || !productId}
              onClick={() => void onAdd()}
            >
              {t('storefrontAdd')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="glass w-full overflow-hidden rounded-[28px]">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-fg">{t('storefrontEmptyProducts')}</p>
            <p className="mt-1 text-sm text-muted">{t('storefrontProductsHint')}</p>
          </div>
        ) : (
          <>
            {/* Mobile / tablet cards */}
            <ul className="divide-y divide-[var(--line)] lg:hidden">
              {rows.map((row) => {
                const thumb = productThumb(row)
                const price = row.override_price ?? row.product?.sell_price ?? 0
                return (
                  <li key={row.id} className={`space-y-3 px-4 py-4 ${row.is_visible ? '' : 'opacity-70'}`}>
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--fill)]">
                        {thumb ? (
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-muted">
                            {(row.product?.name ?? '?').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-fg">{row.product?.name ?? `#${row.product_id}`}</div>
                        <div className="mt-0.5 text-[12px] text-muted">
                          {row.product?.sku ? `${row.product.sku} · ` : ''}
                          {formatRupiah(price)}
                          {!row.is_visible ? ` · ${t('storefrontHidden')}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {canEdit ? (
                        <>
                          <label className="space-y-1 text-[11px] text-muted">
                            {t('storefrontOverridePrice')}
                            <input
                              className={`${fieldSoft} w-full`}
                              type="number"
                              min={0}
                              defaultValue={row.override_price ?? ''}
                              placeholder={String(row.product?.sell_price ?? '')}
                              key={`m-price-${row.id}-${row.override_price ?? 'x'}`}
                              onBlur={(e) => {
                                const raw = e.target.value.trim()
                                const next = raw === '' ? null : Number(raw)
                                if (next === row.override_price || (next == null && row.override_price == null)) return
                                void patchRow(row, { override_price: next })
                              }}
                            />
                          </label>
                          <label className="space-y-1 text-[11px] text-muted" title={t('storefrontSortOrderHint')}>
                            {t('storefrontSortOrder')}
                            <input
                              className={`${fieldSoft} w-full`}
                              type="number"
                              min={0}
                              title={t('storefrontSortOrderHint')}
                              defaultValue={row.sort_order}
                              key={`m-sort-${row.id}-${row.sort_order}`}
                              onBlur={(e) => {
                                const next = Math.max(0, Number(e.target.value) || 0)
                                if (next === row.sort_order) return
                                void patchRow(row, { sort_order: next })
                              }}
                            />
                          </label>
                          {stockMode === 'allocated' ? (
                            <label className="space-y-1 text-[11px] text-muted">
                              {t('storefrontAllocatedQty')}
                              <input
                                className={`${fieldSoft} w-full`}
                                type="number"
                                min={0}
                                defaultValue={row.allocated_qty ?? ''}
                                key={`m-alloc-${row.id}-${row.allocated_qty ?? 'x'}`}
                                onBlur={(e) => {
                                  const raw = e.target.value.trim()
                                  const next = raw === '' ? null : Number(raw)
                                  if (next === row.allocated_qty || (next == null && row.allocated_qty == null)) return
                                  void patchRow(row, { allocated_qty: next })
                                }}
                              />
                              <span className="block text-[10px] text-muted">sold {row.sold_qty}</span>
                            </label>
                          ) : (
                            <div className="space-y-1 text-[11px] text-muted">
                              {t('storefrontSoldQty')}
                              <div className="text-sm tabular-nums text-fg">{row.units_sold ?? 0}</div>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                    <BadgeToggles row={row} />
                    <RowActions row={row} />
                  </li>
                )
              })}
            </ul>

            {/* Desktop table — fixed columns stay aligned */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[32%]" />
                  <col className="w-[12%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                  <col className="w-[16%]" />
                  <col className="w-[21%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--line)] text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                    <th className="px-5 py-3 font-medium">Produk</th>
                    <th className="px-3 py-3 font-medium">{t('storefrontOverridePrice')}</th>
                    <th className="px-3 py-3 font-medium" title={t('storefrontSortOrderHint')}>
                      {t('storefrontSortOrder')}
                    </th>
                    <th className="px-3 py-3 font-medium">
                      {stockMode === 'allocated' ? t('storefrontAllocatedQty') : t('storefrontSoldQty')}
                    </th>
                    <th className="px-3 py-3 font-medium">Badge</th>
                    <th className="px-5 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {rows.map((row) => {
                    const thumb = productThumb(row)
                    const price = row.override_price ?? row.product?.sell_price ?? 0
                    return (
                      <tr
                        key={row.id}
                        className={`transition hover:bg-[var(--fill)]/25 ${row.is_visible ? '' : 'opacity-70'}`}
                      >
                        <td className="px-5 py-3 align-middle">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--fill)]">
                              {thumb ? (
                                <img src={thumb} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-muted">
                                  {(row.product?.name ?? '?').slice(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-fg">
                                {row.product?.name ?? `#${row.product_id}`}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-muted">
                                {row.product?.sku ?? '—'}
                                {!row.is_visible ? ` · ${t('storefrontHidden')}` : ''}
                                {row.override_price != null ? ' · override' : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          {canEdit ? (
                            <input
                              className={`${fieldSoft} w-full max-w-[7.5rem]`}
                              type="number"
                              min={0}
                              title={t('storefrontOverridePrice')}
                              defaultValue={row.override_price ?? ''}
                              placeholder={String(row.product?.sell_price ?? '')}
                              key={`price-${row.id}-${row.override_price ?? 'x'}`}
                              onBlur={(e) => {
                                const raw = e.target.value.trim()
                                const next = raw === '' ? null : Number(raw)
                                if (next === row.override_price || (next == null && row.override_price == null)) return
                                void patchRow(row, { override_price: next })
                              }}
                            />
                          ) : (
                            <span className="text-sm tabular-nums text-fg">{formatRupiah(price)}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          {canEdit ? (
                            <input
                              className={`${fieldSoft} w-full max-w-[5rem]`}
                              type="number"
                              min={0}
                              title={t('storefrontSortOrderHint')}
                              defaultValue={row.sort_order}
                              key={`sort-${row.id}-${row.sort_order}`}
                              onBlur={(e) => {
                                const next = Math.max(0, Number(e.target.value) || 0)
                                if (next === row.sort_order) return
                                void patchRow(row, { sort_order: next })
                              }}
                            />
                          ) : (
                            <span className="text-sm tabular-nums text-fg">{row.sort_order}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          {stockMode === 'allocated' && canEdit ? (
                            <input
                              className={`${fieldSoft} w-full max-w-[5.5rem]`}
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
                          ) : (
                            <span className="text-sm tabular-nums text-fg">
                              {stockMode === 'allocated'
                                ? `${row.allocated_qty ?? 0}/${row.sold_qty}`
                                : (row.units_sold ?? 0)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <BadgeToggles row={row} />
                        </td>
                        <td className="px-5 py-3 align-middle">
                          <div className="flex justify-end">
                            <RowActions row={row} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PageEnter>
  )
}
