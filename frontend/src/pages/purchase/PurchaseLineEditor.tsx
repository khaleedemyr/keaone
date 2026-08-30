import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { SearchSelect } from '../../components/SearchSelect'
import { formatRupiah } from '../../lib/money'
import type { Product } from '../../types'
import { useI18n } from '../../i18n'
import { ProcurementQuickAddBar } from './ProcurementQuickAddBar'
import {
  defaultUnitPick,
  emptyPurchaseLine,
  ensureTrailingEmptyPurchaseLine,
  focusLineCell,
  parseCostInput,
  parseQtyInput,
  productUnitOptions,
  productPurchaseCost,
  type LineCol,
  type PurchaseLineDraft,
} from './purchaseLineUtils'

function QtyStepper({
  value,
  onChange,
  min = 1,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-fill text-lg font-semibold text-fg active:bg-fill/80"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="-"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="field !mt-0 min-w-0 flex-1 text-center text-lg tabular-nums"
        value={value > 0 ? String(value) : ''}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(Math.max(min, parseQtyInput(e.target.value) || min))}
      />
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-fill text-lg font-semibold text-fg active:bg-fill/80"
        onClick={() => onChange(value + 1)}
        aria-label="+"
      >
        +
      </button>
    </div>
  )
}

function MobileLineSheet({
  open,
  line,
  products,
  needsCost,
  grFromPo,
  locale,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean
  line: PurchaseLineDraft | null
  products: Product[]
  needsCost: boolean
  grFromPo?: boolean
  locale: string
  onSave: (next: PurchaseLineDraft) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<PurchaseLineDraft | null>(line)

  useEffect(() => {
    setDraft(line)
  }, [line])

  if (!open || !draft) return null

  const product = products.find((p) => p.id === draft.product_id)
  const unitOptions = productUnitOptions(product)

  function setProduct(productId: string) {
    const id = Number(productId)
    const picked = products.find((p) => p.id === id)
    if (!picked) {
      setDraft((current) =>
        current
          ? { ...current, product_id: 0, name: '', unit: '', unit_level: 'small', unit_cost: 0 }
          : current,
      )
      return
    }
    const unitPick = defaultUnitPick(picked)
    setDraft((current) =>
      current
        ? {
            ...current,
            product_id: picked.id,
            name: picked.name,
            unit: unitPick.unit,
            unit_level: unitPick.unit_level,
            unit_cost: current.unit_cost > 0 ? current.unit_cost : productPurchaseCost(picked),
          }
        : current,
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 md:hidden" onMouseDown={onClose}>
      <div
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-line bg-[var(--glass)] p-4 pb-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-fg">
            {draft.product_id ? t('purchaseEditItem') : t('purchaseAddItem')}
          </h3>
          <button type="button" className="btn-ghost !px-2" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="grid gap-3">
          <label className="block text-sm text-muted">
            {t('product')}
            <SearchSelect
              className="!mt-0"
              value={draft.product_id ? String(draft.product_id) : ''}
              onChange={setProduct}
              options={products.map((p) => ({
                value: String(p.id),
                label: p.name,
                keywords: `${p.sku ?? ''} ${p.barcode ?? ''}`,
              }))}
              placeholder={t('purchasePickProduct')}
              allowEmpty
              emptyLabel={t('purchasePickProduct')}
            />
          </label>
          {grFromPo && draft.po_qty != null ? (
            <label className="block text-sm text-muted">
              {t('purchasePoQty')}
              <input type="text" className="field !mt-0 tabular-nums" value={String(draft.po_qty)} readOnly />
            </label>
          ) : null}
          <label className="block text-sm text-muted">
            {grFromPo && draft.po_qty != null ? t('purchaseReceiveQty') : t('stockQty')}
            <QtyStepper
              value={draft.qty || 0}
              min={grFromPo ? 0 : 1}
              onChange={(qty) => setDraft((c) => (c ? { ...c, qty } : c))}
            />
          </label>
          <label className="block text-sm text-muted">
            {t('unit')}
            <select
              className="field !mt-0"
              value={draft.unit_level}
              disabled={!draft.product_id}
              onChange={(e) => {
                const level = e.target.value as PurchaseLineDraft['unit_level']
                const picked = unitOptions.find((o) => o.level === level)
                setDraft((c) =>
                  c ? { ...c, unit_level: level, unit: picked?.label || c.unit } : c,
                )
              }}
            >
              {unitOptions.map((opt) => (
                <option key={opt.level} value={opt.level}>
                  {opt.label}
                  {opt.factor_to_base > 1 ? ` (=${opt.factor_to_base})` : ''}
                </option>
              ))}
            </select>
          </label>
          {needsCost ? (
            <label className="block text-sm text-muted">
              {t('purchaseUnitCost')}
              <input
                type="text"
                inputMode="decimal"
                className="field !mt-0 tabular-nums"
                value={draft.unit_cost > 0 ? String(draft.unit_cost) : ''}
                disabled={!draft.product_id}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  setDraft((c) => (c ? { ...c, unit_cost: parseCostInput(e.target.value) } : c))
                }
              />
            </label>
          ) : null}
          {draft.product_id && needsCost && draft.unit_cost > 0 ? (
            <div className="text-sm text-muted">
              {t('purchaseTotal')}: {formatRupiah(draft.qty * draft.unit_cost, locale)}
            </div>
          ) : null}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!draft.product_id || draft.qty <= 0}
            onClick={() => {
              if (!draft.product_id || draft.qty <= 0) return
              onSave(draft)
              onClose()
            }}
          >
            {t('save')}
          </button>
          {onDelete ? (
            <button type="button" className="btn-ghost w-full text-rose-500" onClick={onDelete}>
              {t('delete')}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function PurchaseLineEditor({
  lines,
  setLines,
  products,
  productOptions,
  needsCost,
  grFromPo = false,
  autoFocusFirst = false,
  onProductSelected,
}: {
  lines: PurchaseLineDraft[]
  setLines: Dispatch<SetStateAction<PurchaseLineDraft[]>>
  products: Product[]
  productOptions: Array<{ value: string; label: string; keywords?: string }>
  needsCost: boolean
  grFromPo?: boolean
  autoFocusFirst?: boolean
  onProductSelected?: (product: Product) => void
}) {
  const { t, locale } = useI18n()
  const [focusHint, setFocusHint] = useState<{ key: string; col: LineCol } | null>(null)
  const [sheetLine, setSheetLine] = useState<PurchaseLineDraft | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const filledLines = useMemo(() => lines.filter((line) => line.product_id > 0), [lines])

  useEffect(() => {
    if (!focusHint) return
    focusLineCell(focusHint.key, focusHint.col)
    setFocusHint(null)
  }, [focusHint, lines])

  function setProductOnLine(rowKey: string, productId: string) {
    const id = Number(productId)
    const product = products.find((p) => p.id === id)
    setLines((current) => {
      const next = current.map((item) => {
        if (item.key !== rowKey) return item
        if (!product) {
          return { ...item, product_id: 0, name: '', unit: '', unit_level: 'small' as const }
        }
        const pick = defaultUnitPick(product)
        return {
          ...item,
          product_id: product.id,
          name: product.name,
          unit: pick.unit,
          unit_level: pick.unit_level,
          unit_cost: item.unit_cost > 0 ? item.unit_cost : productPurchaseCost(product),
        }
      })
      return ensureTrailingEmptyPurchaseLine(next)
    })
    if (product) {
      onProductSelected?.(product)
      setFocusHint({ key: rowKey, col: 'qty' })
    }
  }

  function quickAddProduct(productId: string) {
    const product = products.find((p) => p.id === Number(productId))
    if (!product) return
    const pick = defaultUnitPick(product)

    setLines((current) => {
      const existing = current.find(
        (line) => line.product_id === product.id && line.unit_level === pick.unit_level,
      )
      if (existing) {
        return current.map((line) =>
          line.key === existing.key ? { ...line, qty: line.qty + 1 } : line,
        )
      }

      const emptyIndex = current.findIndex((line) => line.product_id === 0)
      if (emptyIndex >= 0) {
        const next = current.map((line, index) =>
          index === emptyIndex
            ? {
                ...line,
                product_id: product.id,
                name: product.name,
                qty: 1,
                unit: pick.unit,
                unit_level: pick.unit_level,
                unit_cost: productPurchaseCost(product),
              }
            : line,
        )
        return ensureTrailingEmptyPurchaseLine(next)
      }

      return ensureTrailingEmptyPurchaseLine([
        ...current,
        {
          ...emptyPurchaseLine(),
          product_id: product.id,
          name: product.name,
          qty: 1,
          unit: pick.unit,
          unit_level: pick.unit_level,
          unit_cost: productPurchaseCost(product),
        },
      ])
    })
    onProductSelected?.(product)
  }

  function advanceFrom(rowKey: string, col: LineCol) {
    if (col === 'product') {
      setFocusHint({ key: rowKey, col: 'qty' })
      return
    }
    if (col === 'qty') {
      setFocusHint({ key: rowKey, col: 'unit' })
      return
    }
    if (col === 'unit' && needsCost) {
      setFocusHint({ key: rowKey, col: 'cost' })
      return
    }
    let nextKey = ''
    setLines((current) => {
      const idx = current.findIndex((item) => item.key === rowKey)
      const row = current[idx]
      if (row && row.product_id === 0) return current
      if (idx >= 0 && idx < current.length - 1) {
        nextKey = current[idx + 1].key
        return current
      }
      const blank = emptyPurchaseLine()
      nextKey = blank.key
      return [...current, blank]
    })
    if (nextKey) setFocusHint({ key: nextKey, col: 'product' })
  }

  function onLineEnter(event: KeyboardEvent, rowKey: string, col: LineCol) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    advanceFrom(rowKey, col)
  }

  function removeLine(rowKey: string) {
    setLines((current) => {
      const next = current.filter((item) => item.key !== rowKey)
      return next.length === 0 ? [emptyPurchaseLine()] : ensureTrailingEmptyPurchaseLine(next)
    })
  }

  function openAddSheet() {
    setSheetLine(emptyPurchaseLine())
    setSheetOpen(true)
  }

  function openEditSheet(line: PurchaseLineDraft) {
    setSheetLine({ ...line })
    setSheetOpen(true)
  }

  function saveSheetLine(next: PurchaseLineDraft) {
    setLines((current) => {
      const exists = current.some((line) => line.key === next.key && line.product_id > 0)
      if (exists) {
        return ensureTrailingEmptyPurchaseLine(
          current.map((line) => (line.key === next.key ? next : line)),
        )
      }
      const emptyIndex = current.findIndex((line) => line.product_id === 0)
      if (emptyIndex >= 0) {
        return ensureTrailingEmptyPurchaseLine(
          current.map((line, index) => (index === emptyIndex ? { ...next, key: line.key } : line)),
        )
      }
      return ensureTrailingEmptyPurchaseLine([...current.filter((l) => l.product_id > 0), next])
    })
  }

  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-fg">{t('purchaseItems')}</div>
        <div className="hidden text-[11px] text-muted md:block">{t('purchaseGridHint')}</div>
        <div className="text-[11px] text-muted md:hidden">{t('purchaseMobileHint')}</div>
      </div>

      <div className="mb-3">
        <ProcurementQuickAddBar productOptions={productOptions} products={products} onPick={quickAddProduct} />
      </div>

      {/* Mobile card list */}
      <div className="space-y-2 md:hidden">
        {filledLines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
            {t('purchaseItemsEmpty')}
          </div>
        ) : (
          filledLines.map((line) => {
            const product = products.find((p) => p.id === line.product_id)
            return (
              <button
                key={line.key}
                type="button"
                className="flex w-full items-start gap-3 rounded-xl border border-line bg-fill/20 p-3 text-left active:bg-fill/40"
                onClick={() => openEditSheet(line)}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-fg">{line.name || product?.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {grFromPo && line.po_qty != null ? `${t('purchasePoQty')}: ${line.po_qty} · ` : ''}
                    {t('purchaseReceiveQty')}: {line.qty} {line.unit || product?.unit}
                    {needsCost && line.unit_cost > 0
                      ? ` · ${formatRupiah(line.unit_cost, locale)}/${line.unit || t('unit')}`
                      : ''}
                  </div>
                  {needsCost && line.unit_cost > 0 ? (
                    <div className="mt-1 text-sm font-medium tabular-nums text-fg">
                      {formatRupiah(line.qty * line.unit_cost, locale)}
                    </div>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted">{t('purchaseTapToEdit')}</span>
              </button>
            )
          })
        )}
        <button type="button" className="btn-ghost w-full !py-3" onClick={openAddSheet}>
          + {t('purchaseAddItem')}
        </button>
        {filledLines.length > 0 ? (
          <div className="text-center text-xs text-muted">
            {t('purchaseItemsCount', { count: String(filledLines.length) })}
          </div>
        ) : null}
      </div>

      {/* Desktop grid */}
      <div className="hidden md:block">
        <div
          className={`mb-1 grid gap-2 text-[10px] uppercase tracking-wide text-muted ${
            grFromPo
              ? needsCost
                ? 'grid-cols-[minmax(0,1.6fr)_64px_72px_88px_110px_auto]'
                : 'grid-cols-[minmax(0,1.6fr)_64px_72px_88px_auto]'
              : needsCost
                ? 'grid-cols-[minmax(0,1.6fr)_72px_88px_110px_auto]'
                : 'grid-cols-[minmax(0,1.6fr)_72px_88px_auto]'
          }`}
        >
          <span>{t('product')}</span>
          {grFromPo ? <span>{t('purchasePoQty')}</span> : null}
          <span>{grFromPo ? t('purchaseReceiveQty') : t('stockQty')}</span>
          <span>{t('unit')}</span>
          {needsCost ? <span>{t('purchaseUnitCost')}</span> : null}
          <span />
        </div>
        <div className="space-y-1.5">
          {lines.map((line, index) => {
            const product = products.find((p) => p.id === line.product_id)
            const options = productUnitOptions(product)
            const known = options.some((o) => o.level === line.unit_level || o.label === line.unit)
            const showPoQty = grFromPo && line.po_qty != null
            return (
              <div
                key={line.key}
                className={`grid items-center gap-2 text-sm ${
                  grFromPo
                    ? needsCost
                      ? 'grid-cols-[minmax(0,1.6fr)_64px_72px_88px_110px_auto]'
                      : 'grid-cols-[minmax(0,1.6fr)_64px_72px_88px_auto]'
                    : needsCost
                      ? 'grid-cols-[minmax(0,1.6fr)_72px_88px_110px_auto]'
                      : 'grid-cols-[minmax(0,1.6fr)_72px_88px_auto]'
                }`}
              >
                <div data-line={line.key} data-col="product">
                  <SearchSelect
                    className="!mt-0"
                    value={line.product_id ? String(line.product_id) : ''}
                    onChange={(value) => setProductOnLine(line.key, value)}
                    onCommit={() => setFocusHint({ key: line.key, col: 'qty' })}
                    options={productOptions}
                    placeholder={t('purchasePickProduct')}
                    allowEmpty
                    emptyLabel={t('purchasePickProduct')}
                    autoFocus={index === 0 && autoFocusFirst}
                  />
                </div>
                {grFromPo ? (
                  showPoQty ? (
                    <div className="field !mt-0 flex h-[38px] items-center justify-end px-2 tabular-nums text-muted">
                      {line.po_qty}
                    </div>
                  ) : (
                    <div />
                  )
                ) : null}
                <input
                  data-line={line.key}
                  data-col="qty"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="field !mt-0 tabular-nums"
                  value={line.qty > 0 ? String(line.qty) : ''}
                  placeholder={grFromPo ? '0' : undefined}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setLines((current) =>
                      current.map((item) =>
                        item.key === line.key ? { ...item, qty: parseQtyInput(e.target.value) } : item,
                      ),
                    )
                  }
                  onKeyDown={(e) => onLineEnter(e, line.key, 'qty')}
                />
                <select
                  data-line={line.key}
                  data-col="unit"
                  className="field !mt-0"
                  value={line.unit_level}
                  disabled={!line.product_id}
                  onChange={(e) => {
                    const level = e.target.value as PurchaseLineDraft['unit_level']
                    const picked = options.find((o) => o.level === level)
                    setLines((current) =>
                      current.map((item) =>
                        item.key === line.key
                          ? { ...item, unit_level: level, unit: picked?.label || item.unit }
                          : item,
                      ),
                    )
                  }}
                  onKeyDown={(e) => onLineEnter(e, line.key, 'unit')}
                >
                  {!known ? (
                    <option value={line.unit_level}>{line.unit || t('purchaseSelectUnit')}</option>
                  ) : null}
                  {options.map((opt) => (
                    <option key={opt.level} value={opt.level}>
                      {opt.label}
                      {opt.factor_to_base > 1 ? ` (=${opt.factor_to_base})` : ''}
                    </option>
                  ))}
                </select>
                {needsCost ? (
                  <input
                    data-line={line.key}
                    data-col="cost"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="field !mt-0 tabular-nums"
                    value={line.unit_cost > 0 ? String(line.unit_cost) : ''}
                    disabled={!line.product_id}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((item) =>
                          item.key === line.key
                            ? { ...item, unit_cost: parseCostInput(e.target.value) }
                            : item,
                        ),
                      )
                    }
                    onKeyDown={(e) => onLineEnter(e, line.key, 'cost')}
                  />
                ) : null}
                <button
                  type="button"
                  className="btn-ghost !px-2"
                  disabled={lines.length <= 1 && line.product_id === 0}
                  onClick={() => removeLine(line.key)}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <MobileLineSheet
        open={sheetOpen}
        line={sheetLine}
        products={products}
        needsCost={needsCost}
        grFromPo={grFromPo}
        locale={locale}
        onSave={saveSheetLine}
        onDelete={
          sheetLine?.product_id
            ? () => {
                if (sheetLine) removeLine(sheetLine.key)
                setSheetOpen(false)
                setSheetLine(null)
              }
            : undefined
        }
        onClose={() => {
          setSheetOpen(false)
          setSheetLine(null)
        }}
      />
    </div>
  )
}
