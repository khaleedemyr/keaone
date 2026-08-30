import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { SearchSelect } from '../../components/SearchSelect'
import { formatRupiah } from '../../lib/money'
import type { Product } from '../../types'
import { useI18n } from '../../i18n'
import { ProcurementQuickAddBar } from './ProcurementQuickAddBar'
import { buildProductOptions, parseQtyInput, productPurchaseCost, purchaseLineUuid } from './purchaseLineUtils'

export type ReturnLineDraft = {
  key: string
  product_id: number
  name: string
  qty: number
  unit: string
}

export type AdjustmentLineDraft = {
  key: string
  product_id: number
  name: string
  qty: number
  unit_cost_before: number
  unit_cost_after: number
}

function QtyStepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-fill text-lg font-semibold"
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        className="field !mt-0 min-w-0 flex-1 text-center text-lg tabular-nums"
        value={value > 0 ? String(value) : ''}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(Math.max(1, parseQtyInput(e.target.value) || 1))}
      />
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-fill text-lg font-semibold"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}

type ReturnEditorProps = {
  mode: 'return'
  lines: ReturnLineDraft[]
  setLines: Dispatch<SetStateAction<ReturnLineDraft[]>>
  products: Product[]
}

type AdjustmentEditorProps = {
  mode: 'adjustment'
  lines: AdjustmentLineDraft[]
  setLines: Dispatch<SetStateAction<AdjustmentLineDraft[]>>
  products: Product[]
}

export function ProcurementSimpleLineEditor(props: ReturnEditorProps | AdjustmentEditorProps) {
  const { t, locale } = useI18n()
  const { mode, products } = props
  const productOptions = useMemo(() => buildProductOptions(products), [products])

  const filledReturn =
    props.mode === 'return' ? props.lines.filter((line) => line.product_id > 0) : []
  const filledAdjustment =
    props.mode === 'adjustment' ? props.lines.filter((line) => line.product_id > 0) : []

  function quickAddReturn(productId: string) {
    if (props.mode !== 'return') return
    const product = products.find((p) => p.id === Number(productId))
    if (!product) return
    props.setLines((current) => {
      const existing = current.find((line) => line.product_id === product.id)
      if (existing) {
        return current.map((line) =>
          line.product_id === product.id ? { ...line, qty: line.qty + 1 } : line,
        )
      }
      return [
        ...current.filter((line) => line.product_id > 0),
        {
          key: purchaseLineUuid(),
          product_id: product.id,
          name: product.name,
          qty: 1,
          unit: product.unit ?? '',
        },
      ]
    })
  }

  function quickAddAdjustment(productId: string) {
    if (props.mode !== 'adjustment') return
    const product = products.find((p) => p.id === Number(productId))
    if (!product) return
    const cost = productPurchaseCost(product)
    props.setLines((current) => {
      const existing = current.find((line) => line.product_id === product.id)
      if (existing) {
        return current.map((line) =>
          line.product_id === product.id ? { ...line, qty: line.qty + 1 } : line,
        )
      }
      return [
        ...current.filter((line) => line.product_id > 0),
        {
          key: purchaseLineUuid(),
          product_id: product.id,
          name: product.name,
          qty: 1,
          unit_cost_before: cost,
          unit_cost_after: cost,
        },
      ]
    })
  }

  function removeReturn(key: string) {
    if (props.mode !== 'return') return
    props.setLines((current) => {
      const next = current.filter((line) => line.key !== key)
      return next.length === 0
        ? [{ key: purchaseLineUuid(), product_id: 0, name: '', qty: 1, unit: '' }]
        : next
    })
  }

  function removeAdjustment(key: string) {
    if (props.mode !== 'adjustment') return
    props.setLines((current) => {
      const next = current.filter((line) => line.key !== key)
      return next.length === 0
        ? [{ key: purchaseLineUuid(), product_id: 0, name: '', qty: 1, unit_cost_before: 0, unit_cost_after: 0 }]
        : next
    })
  }

  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-fg">{t('navProducts')}</div>
        <div className="hidden text-[11px] text-muted md:block">
          {mode === 'adjustment' ? t('procurementAdjustmentLineHint') : t('purchaseGridHint')}
        </div>
        <div className="text-[11px] text-muted md:hidden">{t('purchaseMobileHint')}</div>
      </div>

      <div className="mb-3">
        <ProcurementQuickAddBar
          products={products}
          productOptions={productOptions}
          onPick={mode === 'return' ? quickAddReturn : quickAddAdjustment}
        />
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {mode === 'return'
          ? filledReturn.map((line) => (
              <div key={line.key} className="rounded-xl border border-line bg-fill/20 p-3">
                <div className="font-medium text-fg">{line.name}</div>
                <div className="mt-2">
                  <QtyStepper
                    value={line.qty}
                    onChange={(qty) =>
                      props.mode === 'return' &&
                      props.setLines((current) =>
                        current.map((row) => (row.key === line.key ? { ...row, qty } : row)),
                      )
                    }
                  />
                </div>
                <button type="button" className="btn-ghost mt-2 !text-xs" onClick={() => removeReturn(line.key)}>
                  {t('delete')}
                </button>
              </div>
            ))
          : filledAdjustment.map((line) => (
              <div key={line.key} className="rounded-xl border border-line bg-fill/20 p-3">
                <div className="font-medium text-fg">{line.name}</div>
                <label className="mt-2 block text-xs text-muted">
                  {t('approvalsQty')}
                  <QtyStepper
                    value={line.qty}
                    onChange={(qty) =>
                      props.mode === 'adjustment' &&
                      props.setLines((current) =>
                        current.map((row) => (row.key === line.key ? { ...row, qty } : row)),
                      )
                    }
                  />
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block text-xs text-muted">
                    {t('procurementAdjustmentCostBefore')}
                    <input
                      type="number"
                      min={0}
                      className="field !mt-0"
                      value={line.unit_cost_before}
                      onChange={(e) =>
                        props.mode === 'adjustment' &&
                        props.setLines((current) =>
                          current.map((row) =>
                            row.key === line.key
                              ? { ...row, unit_cost_before: Number(e.target.value) || 0 }
                              : row,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    {t('procurementAdjustmentCostAfter')}
                    <input
                      type="number"
                      min={0}
                      className="field !mt-0"
                      value={line.unit_cost_after}
                      onChange={(e) =>
                        props.mode === 'adjustment' &&
                        props.setLines((current) =>
                          current.map((row) =>
                            row.key === line.key
                              ? { ...row, unit_cost_after: Number(e.target.value) || 0 }
                              : row,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="mt-1 text-xs text-muted tabular-nums">
                  Δ {formatRupiah((line.unit_cost_after - line.unit_cost_before) * line.qty, locale)}
                </div>
                <button type="button" className="btn-ghost mt-2 !text-xs" onClick={() => removeAdjustment(line.key)}>
                  {t('delete')}
                </button>
              </div>
            ))}

        {mode === 'return' && filledReturn.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
            {t('purchaseItemsEmpty')}
          </div>
        ) : null}
        {mode === 'adjustment' && filledAdjustment.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
            {t('purchaseItemsEmpty')}
          </div>
        ) : null}
      </div>

      {/* Desktop grid */}
      <div className="hidden md:block">
        {mode === 'return' && props.mode === 'return'
          ? props.lines.map((line, index) => (
              <div key={line.key} className="mb-2 grid gap-2 md:grid-cols-[1fr_100px_80px]">
                <SearchSelect
                  className="!mt-0"
                  value={line.product_id ? String(line.product_id) : ''}
                  onChange={(value) => {
                    const product = products.find((p) => p.id === Number(value))
                    props.setLines((current) =>
                      current.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              product_id: Number(value),
                              name: product?.name ?? '',
                              unit: product?.unit ?? '',
                            }
                          : row,
                      ),
                    )
                  }}
                  options={productOptions}
                  placeholder={t('purchasePickProduct')}
                />
                <input
                  className="field !mt-0"
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(e) =>
                    props.setLines((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, qty: Number(e.target.value) || 0 } : row,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => removeReturn(line.key)}
                  disabled={props.lines.length === 1}
                >
                  ×
                </button>
              </div>
            ))
          : null}

        {mode === 'adjustment' && props.mode === 'adjustment'
          ? props.lines.map((line, index) => (
              <div key={line.key} className="mb-2 grid gap-2 md:grid-cols-[1fr_70px_100px_100px_40px]">
                <SearchSelect
                  className="!mt-0"
                  value={line.product_id ? String(line.product_id) : ''}
                  onChange={(value) => {
                    const product = products.find((p) => p.id === Number(value))
                    props.setLines((current) =>
                      current.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              product_id: Number(value),
                              name: product?.name ?? '',
                              unit_cost_before: productPurchaseCost(product),
                              unit_cost_after: productPurchaseCost(product),
                            }
                          : row,
                      ),
                    )
                  }}
                  options={productOptions}
                  placeholder={t('purchasePickProduct')}
                />
                <input
                  className="field !mt-0"
                  type="number"
                  min={1}
                  title={t('approvalsQty')}
                  value={line.qty}
                  onChange={(e) =>
                    props.setLines((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, qty: Number(e.target.value) || 1 } : row,
                      ),
                    )
                  }
                />
                <input
                  className="field !mt-0"
                  type="number"
                  min={0}
                  title={t('procurementAdjustmentCostBefore')}
                  value={line.unit_cost_before}
                  onChange={(e) =>
                    props.setLines((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, unit_cost_before: Number(e.target.value) || 0 } : row,
                      ),
                    )
                  }
                />
                <input
                  className="field !mt-0"
                  type="number"
                  min={0}
                  title={t('procurementAdjustmentCostAfter')}
                  value={line.unit_cost_after}
                  onChange={(e) =>
                    props.setLines((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, unit_cost_after: Number(e.target.value) || 0 } : row,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => removeAdjustment(line.key)}
                  disabled={props.lines.length === 1}
                >
                  ×
                </button>
              </div>
            ))
          : null}

        {mode === 'return' && props.mode === 'return' ? (
          <button
            type="button"
            className="btn-ghost !text-xs"
            onClick={() =>
              props.setLines((current) => [
                ...current,
                { key: purchaseLineUuid(), product_id: 0, name: '', qty: 1, unit: '' },
              ])
            }
          >
            + {t('purchaseAddLine')}
          </button>
        ) : null}

        {mode === 'adjustment' && props.mode === 'adjustment' ? (
          <button
            type="button"
            className="btn-ghost !text-xs"
            onClick={() =>
              props.setLines((current) => [
                ...current,
                {
                  key: purchaseLineUuid(),
                  product_id: 0,
                  name: '',
                  qty: 1,
                  unit_cost_before: 0,
                  unit_cost_after: 0,
                },
              ])
            }
          >
            + {t('purchaseAddLine')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
