import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { formatRupiah } from '../../lib/money'
import type { CartLine, Discount, Product, Promotion } from '../../types'
import { useI18n } from '../../i18n'

const CASH_QUICK = [20000, 50000, 100000, 150000, 200000, 500000]
const PAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '00']

function isQtyField(target: EventTarget | null) {
  return target instanceof HTMLElement && target.dataset.retailQty === '1'
}

function isCashField(target: EventTarget | null) {
  return target instanceof HTMLInputElement && target.dataset.retailCash === '1'
}

function QtyField({
  value,
  onCommit,
  onEditing,
  inputRef,
}: {
  value: number
  onCommit: (qty: number) => void
  onEditing: () => void
  inputRef: (el: HTMLInputElement | null) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(String(value))
  }, [value])

  function commit(raw: string) {
    const n = Number.parseInt(raw, 10)
    onCommit(Number.isFinite(n) && n > 0 ? n : 0)
  }

  return (
    <input
      ref={inputRef}
      data-retail-qty="1"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      className="retail-qty-input"
      value={draft}
      onFocus={(event) => {
        focused.current = true
        onEditing()
        event.currentTarget.select()
      }}
      onBlur={() => {
        focused.current = false
        commit(draft)
      }}
      onChange={(event) => {
        const next = event.target.value.replace(/\D/g, '').slice(0, 6)
        setDraft(next)
        const n = Number.parseInt(next, 10)
        if (next !== '' && Number.isFinite(n) && n > 0) {
          onEditing()
          onCommit(n)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          if (event.key === 'Escape') setDraft(String(value))
          event.currentTarget.blur()
        }
      }}
    />
  )
}

export function RetailRegister({
  cashier,
  outlet,
  query,
  onQuery,
  products,
  cart,
  onAdd,
  onQty,
  priceOf,
  onScan,
  onVoidLast,
  onClear,
  highlightId,
  highlightSeq,
  method,
  onMethod,
  payAmount,
  onPayAmount,
  subtotal,
  discountAmount = 0,
  discountSource = null,
  taxAmount = 0,
  total,
  change,
  onOpenDiscountList,
  onClearDiscount,
  formatDiscountLabel,
  selectedDiscount = null,
  promotionId = '',
  onOpenPromoList,
  onClearPromo,
  onParkCart,
  onOpenHoldList,
  holdCount = 0,
  autoPromotion = null,
  effectivePromotion = null,
  promoCodeActive = false,
  formatPromotionLabel,
  busy,
  onCheckout,
  settling = false,
  onSettlement,
}: {
  cashier: string
  outlet: string
  query: string
  onQuery: (value: string) => void
  products: Product[]
  cart: CartLine[]
  onAdd: (product: Product) => void
  onQty: (productId: number, qty: number) => void
  priceOf: (product: Product) => number
  onScan: () => void
  onVoidLast: () => void
  onClear: () => void
  highlightId: number | null
  highlightSeq: number
  method: 'cash' | 'transfer' | 'qris'
  onMethod: (method: 'cash' | 'transfer' | 'qris') => void
  payAmount: string
  onPayAmount: (value: string) => void
  subtotal: number
  discountAmount?: number
  discountSource?: 'promotion' | 'discount' | null
  taxAmount?: number
  total: number
  change: number
  onOpenDiscountList?: () => void
  onClearDiscount?: () => void
  formatDiscountLabel?: (item: Discount) => string
  selectedDiscount?: Discount | null
  promotionId?: number | ''
  onOpenPromoList?: () => void
  onClearPromo?: () => void
  onParkCart?: () => void
  onOpenHoldList?: () => void
  holdCount?: number
  autoPromotion?: Promotion | null
  effectivePromotion?: Promotion | null
  promoCodeActive?: boolean
  formatPromotionLabel?: (item: Promotion) => string
  busy: boolean
  onCheckout: () => void
  settling?: boolean
  onSettlement?: () => void
}) {
  const { t, locale } = useI18n()
  const scanRef = useRef<HTMLInputElement>(null)
  const qtyRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const skipScanFocus = useRef(false)
  const [clock, setClock] = useState(() => new Date())
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (highlightId) setActive(highlightId)
  }, [highlightId, highlightSeq])

  useEffect(() => {
    if (active && cart.some((line) => line.product.id === active)) return
    setActive(cart[cart.length - 1]?.product.id ?? null)
  }, [cart, active])

  useEffect(() => {
    if (active == null) return
    document.querySelector(`[data-line="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, cart])

  useEffect(() => {
    if (skipScanFocus.current) {
      skipScanFocus.current = false
      return
    }
    if (isQtyField(document.activeElement)) return
    scanRef.current?.focus()
  }, [cart])

  function targetLine() {
    return cart.find((line) => line.product.id === active) ?? cart[cart.length - 1] ?? null
  }

  function bumpQty(delta: number) {
    const line = targetLine()
    if (!line) return
    onQty(line.product.id, line.qty + delta)
  }

  function focusQty(productId?: number) {
    const id = productId ?? targetLine()?.product.id
    if (id == null) return
    skipScanFocus.current = true
    setActive(id)
    requestAnimationFrame(() => {
      const el = qtyRefs.current[id]
      el?.focus()
      el?.select()
    })
  }

  function applyTypedQty() {
    const raw = query.trim()
    if (!/^\d{1,6}$/.test(raw)) return false
    const line = targetLine()
    if (!line) return false
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n) || n <= 0) return false
    onQty(line.product.id, n)
    onQuery('')
    return true
  }

  function moveActive(dir: -1 | 1) {
    if (cart.length === 0) return
    const index = Math.max(
      0,
      cart.findIndex((line) => line.product.id === active),
    )
    const next = cart[Math.min(cart.length - 1, Math.max(0, index + dir))]
    if (next) setActive(next.product.id)
  }

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (busy) return
      if (event.key === 'F2') {
        event.preventDefault()
        if (cart.length) onCheckout()
        return
      }
      if (event.key === 'F3') {
        event.preventDefault()
        onOpenPromoList?.()
        return
      }
      if (event.key === 'F6') {
        event.preventDefault()
        onOpenDiscountList?.()
        return
      }
      if (event.key === 'F7') {
        event.preventDefault()
        onOpenHoldList?.()
        return
      }
      if (event.key === 'F9') {
        event.preventDefault()
        onParkCart?.()
        return
      }

      if (isCashField(event.target)) return

      const inQty = isQtyField(event.target)
      const inScan = event.target === scanRef.current

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const dir = event.key === 'ArrowUp' ? -1 : 1
        if (inQty) {
          const index = Math.max(0, cart.findIndex((line) => line.product.id === active))
          const next = cart[Math.min(cart.length - 1, Math.max(0, index + dir))]
          if (next) focusQty(next.product.id)
          return
        }
        moveActive(dir)
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (inScan && query.trim() !== '') return
        event.preventDefault()
        bumpQty(event.key === 'ArrowRight' ? 1 : -1)
        return
      }

      if (event.key === '*' || event.key === 'F4' || event.code === 'NumpadMultiply') {
        event.preventDefault()
        if (inScan && applyTypedQty()) {
          scanRef.current?.focus()
          return
        }
        if (!inQty) focusQty()
        return
      }

      if (inQty || (!inScan && event.target instanceof HTMLInputElement)) return

      if (inScan && query.trim() !== '') return

      if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') {
        event.preventDefault()
        bumpQty(1)
        return
      }
      if (event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract') {
        event.preventDefault()
        bumpQty(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onScan()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onQuery('')
    }
  }

  function tapPad(key: string) {
    if (key === 'C') {
      onPayAmount('')
      return
    }
    const next = `${payAmount}${key}`.replace(/^0+(?=\d)/, '')
    onPayAmount(next)
  }

  const methods = [
    { id: 'cash' as const, label: t('cash') },
    { id: 'transfer' as const, label: t('transfer') },
    { id: 'qris' as const, label: t('qris') },
  ]

  return (
    <div className="retail-pos">
      <header className="retail-pos-bar">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mint/80">{t('posTitle')}</div>
          <div className="mt-0.5 text-sm font-medium text-fg sm:text-base">
            {outlet} · {cashier}
          </div>
        </div>
        <div className="retail-pos-bar-actions">
          <button type="button" className="retail-touch-btn" disabled={settling} onClick={onSettlement}>
            {t('posSettlement')} · F8
          </button>
          {onParkCart ? (
            <button type="button" className="retail-touch-btn" onClick={onParkCart}>
              {t('posHoldShortcut')}
            </button>
          ) : null}
          {onOpenHoldList ? (
            <button type="button" className="retail-touch-btn" onClick={onOpenHoldList}>
              {t('posHoldListShortcut')}
              {holdCount > 0 ? ` (${holdCount})` : ''}
            </button>
          ) : null}
          {onOpenDiscountList ? (
            <button type="button" className="retail-touch-btn" onClick={onOpenDiscountList}>
              {t('posDiscountShortcut')}
            </button>
          ) : null}
          {onOpenPromoList ? (
            <button type="button" className="retail-touch-btn retail-touch-btn--mint" onClick={onOpenPromoList}>
              {t('posPromoShortcut')}
            </button>
          ) : null}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold tabular-nums">
              {clock.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-muted">{t('posModeRetail')}</div>
          </div>
        </div>
      </header>

      <div className="retail-pos-grid">
        <section className="retail-pos-main">
          <input
            ref={scanRef}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="retail-scan"
            placeholder={t('posScanHint')}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={onSearchKey}
          />
          <div className="text-[11px] text-muted">{t('posQtyHint')}</div>

          <div className="retail-ticket">
            <table>
              <thead>
                <tr>
                  <th className="w-10">{t('posColNo')}</th>
                  <th className="w-28">{t('sku')}</th>
                  <th>{t('posColItem')}</th>
                  <th className="w-40 text-center">{t('posColQty')}</th>
                  <th className="w-28 text-right">{t('posColPrice')}</th>
                  <th className="w-32 text-right">{t('posColSubtotal')}</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((line, index) => {
                  const price = priceOf(line.product)
                  const selected = active === line.product.id
                  return (
                    <tr
                      key={line.product.id}
                      data-line={line.product.id}
                      className={selected ? 'is-active' : ''}
                      onClick={() => setActive(line.product.id)}
                    >
                      <td>{index + 1}</td>
                      <td className="font-mono text-xs">{line.product.sku || line.product.barcode || '-'}</td>
                      <td>
                        <div className="font-medium">
                          {line.product.name}
                          {(line.promo_free_qty ?? 0) > 0 ? (
                            <span className="ml-2 rounded bg-mint/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mint">
                              {t('posPromoFreeBadge')}
                            </span>
                          ) : null}
                        </div>
                        {line.product.barcode && line.product.sku ? (
                          <div className="text-[11px] text-muted">{line.product.barcode}</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="retail-qty">
                          <button
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onQty(line.product.id, line.qty - 1)}
                          >
                            −
                          </button>
                          <QtyField
                            value={line.qty}
                            onEditing={() => {
                              skipScanFocus.current = true
                              setActive(line.product.id)
                            }}
                            onCommit={(qty) => {
                              skipScanFocus.current = true
                              onQty(line.product.id, qty)
                            }}
                            inputRef={(el) => {
                              qtyRefs.current[line.product.id] = el
                            }}
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onQty(line.product.id, line.qty + 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="text-right tabular-nums">
                        {(line.promo_free_qty ?? 0) >= line.qty
                          ? formatRupiah(0, locale)
                          : formatRupiah(price, locale)}
                      </td>
                      <td className="text-right tabular-nums font-semibold">
                        {formatRupiah(price * Math.max(0, line.qty - (line.promo_free_qty ?? 0)), locale)}
                      </td>
                    </tr>
                  )
                })}
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted">
                      {t('posTicketEmpty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="retail-lookup">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t('posLookup')}</div>
            <div className="retail-lookup-list">
              {products.map((product) => (
                <button key={product.id} type="button" onClick={() => onAdd(product)}>
                  <span className="retail-lookup-sku">{product.sku || product.barcode || '—'}</span>
                  <span className="retail-lookup-name">{product.name}</span>
                  <span className="retail-lookup-price">{formatRupiah(priceOf(product), locale)}</span>
                </button>
              ))}
              {products.length === 0 ? <div className="col-span-full px-2 py-3 text-sm text-muted">{t('productNotFound')}</div> : null}
            </div>
          </div>
        </section>

        <aside className="retail-pos-pay">
          <div className="text-xs text-muted">
            {t('posItemsCount', {
              count: String(
                cart.reduce((sum, line) => sum + Math.max(0, line.qty - (line.promo_free_qty ?? 0)), 0),
              ),
            })}
          </div>
          <div className="retail-total">
            <div>{t('total')}</div>
            <strong>{formatRupiah(total, locale)}</strong>
          </div>
          {(discountAmount > 0 || taxAmount > 0) && (
            <div className="space-y-1 text-xs text-muted">
              <div className="flex justify-between">
                <span>{t('receiptSubtotal')}</span>
                <span className="tabular-nums">{formatRupiah(subtotal, locale)}</span>
              </div>
              {discountAmount > 0 ? (
                <div className="flex justify-between text-rose-300">
                  <span>{discountSource === 'promotion' ? t('receiptPromo') : t('receiptDiscount')}</span>
                  <span className="tabular-nums">-{formatRupiah(discountAmount, locale)}</span>
                </div>
              ) : null}
              {taxAmount > 0 ? (
                <div className="flex justify-between">
                  <span>{t('receiptTax')}</span>
                  <span className="tabular-nums">{formatRupiah(taxAmount, locale)}</span>
                </div>
              ) : null}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault()
              onCheckout()
            }}
            className="space-y-3"
          >
            {autoPromotion && !promotionId && !promoCodeActive ? (
              <div className="retail-promo-card border border-mint/30 bg-mint/10 text-sm text-mint">
                <div className="font-medium">{t('posPromoAutoApplied')}</div>
                <div className="mt-0.5 text-xs opacity-90">
                  {formatPromotionLabel ? formatPromotionLabel(autoPromotion) : autoPromotion.name}
                </div>
                {onClearPromo ? (
                  <button type="button" className="bg-fill/40 text-rose-300" onClick={onClearPromo}>
                    {t('posClearPromo')}
                  </button>
                ) : null}
              </div>
            ) : null}
            {effectivePromotion && (promotionId || promoCodeActive) ? (
              <div className="retail-promo-card bg-fill text-sm">
                <div className="text-xs text-muted">{t('receiptPromo')}</div>
                <div className="font-medium">{effectivePromotion.name}</div>
                {onClearPromo ? (
                  <button type="button" className="bg-rose-500/10 text-rose-300" onClick={onClearPromo}>
                    {t('posClearPromo')}
                  </button>
                ) : null}
              </div>
            ) : null}
            {selectedDiscount && !effectivePromotion ? (
              <div className="retail-promo-card bg-fill text-sm">
                <div className="text-xs text-muted">{t('receiptDiscount')}</div>
                <div className="font-medium">
                  {formatDiscountLabel ? formatDiscountLabel(selectedDiscount) : selectedDiscount.name}
                </div>
                {onClearDiscount ? (
                  <button type="button" className="bg-rose-500/10 text-rose-300" onClick={onClearDiscount}>
                    {t('posNoDiscount')}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="retail-pay-methods">
              {methods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onMethod(item.id)}
                  className={method === item.id ? 'bg-mint text-ink' : 'bg-fill text-muted'}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {method === 'cash' ? (
              <>
                <input
                  type="number"
                  min={0}
                  data-retail-cash="1"
                  className="field min-h-12 text-base tabular-nums"
                  placeholder={t('cashReceived')}
                  value={payAmount}
                  onChange={(e) => onPayAmount(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="retail-cash-chip" onClick={() => onPayAmount(String(total))} disabled={!total}>
                    {t('posExactCash')}
                  </button>
                  {CASH_QUICK.filter((amount) => amount >= total).map((amount) => (
                    <button key={amount} type="button" className="retail-cash-chip" onClick={() => onPayAmount(String(amount))}>
                      {formatRupiah(amount, locale)}
                    </button>
                  ))}
                </div>
                <div className="retail-pad">
                  {PAD.map((key) => (
                    <button key={key} type="button" onClick={() => tapPad(key)}>
                      {key}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('change')}</span>
                  <span className="font-display text-xl font-bold text-mint">{formatRupiah(change, locale)}</span>
                </div>
              </>
            ) : null}

            <button
              type="submit"
              disabled={busy || cart.length === 0}
              className="btn-primary retail-checkout-btn w-full"
            >
              {busy ? t('processing') : `${t('pay')}  ·  F2`}
            </button>
          </form>

          <div className="retail-pay-actions mt-1">
            <button type="button" className="btn-ghost" disabled={cart.length === 0} onClick={onVoidLast}>
              {t('posVoidLine')}
            </button>
            <button type="button" className="btn-ghost text-rose-300" disabled={cart.length === 0} onClick={onClear}>
              {t('posClearCart')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
