import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { api, apiMessage } from '../api/client'
import { formatRupiah } from '../lib/money'
import { computeCheckoutTotals, formatDiscountValue } from '../lib/discountCalc'
import { bestAutoPromotion, formatPromotionLabel } from '../lib/promoCalc'
import { cartFingerprint, paidPromoLines, promoGetProductIds, syncCrossPromoFree } from '../lib/promoCart'
import {
  cartToHoldLines,
  deletePosHold,
  formatHoldLabel,
  getPosHold,
  holdLinesToCart,
  readPosHolds,
  savePosHold,
  type PosHoldScope,
  type PosHoldSnapshot,
} from '../lib/posHolds'
import type { ApiOk, CartLine, Discount, PosSettlement, PriceChannel, Product, Promotion, ReceiptPayload, Sale } from '../types'
import { PageEnter } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { PageHeader, ReceiptModal, SettlementModal } from '../components/ui'
import { DiscountSelectModal } from '../components/pos/DiscountSelectModal'
import { HoldSelectModal } from '../components/pos/HoldSelectModal'
import { PromoSelectModal } from '../components/pos/PromoSelectModal'
import { useI18n, type MsgKey } from '../i18n'
import { useAuth } from '../auth'
import { RetailRegister } from './pos/RetailRegister'

const POS_MODE_LABEL: Record<string, MsgKey> = {
  retail: 'posModeRetail',
  restaurant: 'posModeRestaurant',
  cafe: 'posModeCafe',
}

export default function Pos() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const feedback = useFeedback()
  const promoEnabled = Boolean(me?.modules?.promotions)
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<'cash' | 'transfer' | 'qris'>('cash')
  const [payAmount, setPayAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null)
  const [settlement, setSettlement] = useState<PosSettlement | null>(null)
  const [settling, setSettling] = useState(false)
  const [channels, setChannels] = useState<PriceChannel[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [discountId, setDiscountId] = useState<number | ''>('')
  const [promotionId, setPromotionId] = useState<number | ''>('')
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [promoCodeApplied, setPromoCodeApplied] = useState<Promotion | null>(null)
  const [promoModalOpen, setPromoModalOpen] = useState(false)
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [holdModalOpen, setHoldModalOpen] = useState(false)
  const [holds, setHolds] = useState<PosHoldSnapshot[]>([])
  const [suppressAutoPromo, setSuppressAutoPromo] = useState(false)
  const suppressAtPaidFingerprintRef = useRef<string | null>(null)
  const paidFingerprintRef = useRef('')
  const [channelCode, setChannelCode] = useState('pos')
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [highlightSeq, setHighlightSeq] = useState(0)

  const posMode = me?.settings?.pos_mode ?? 'retail'
  const posModeLabel = t(POS_MODE_LABEL[posMode] ?? 'posModeRetail')
  const retail = posMode === 'retail'
  const holdScope = useMemo<PosHoldScope | null>(() => {
    if (!me?.company?.id || !me.user?.id) return null
    return {
      companyId: me.company.id,
      outletId: me.outlet?.id ?? 0,
      userId: me.user.id,
    }
  }, [me?.company?.id, me?.outlet?.id, me?.user?.id])

  function refreshHolds() {
    if (!holdScope) {
      setHolds([])
      return
    }
    setHolds(readPosHolds(holdScope))
  }

  useEffect(() => {
    refreshHolds()
  }, [holdScope?.companyId, holdScope?.outletId, holdScope?.userId])

  useEffect(() => {
    void api
      .get<ApiOk<Product[]>>('/products', { params: { per_page: 100, for_pos: 1 } })
      .then(({ data }) => setProducts(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
    if (!retail) {
      void api
        .get<ApiOk<PriceChannel[]>>('/price-channels', { params: { for_select: 1 }, silent: true })
        .then(({ data }) => setChannels(data.data.filter((item) => item.is_active !== false)))
        .catch(() => {})
    }
    void api
      .get<ApiOk<Discount[]>>('/discounts', { params: { for_select: 1, status: 'active' }, silent: true })
      .then(({ data }) => setDiscounts(data.data.filter((item) => item.is_active !== false)))
      .catch(() => {})
    if (promoEnabled) {
      void api
        .get<ApiOk<Promotion[]>>('/promotions', { params: { for_select: 1 }, silent: true })
        .then(({ data }) =>
          setPromotions((Array.isArray(data.data) ? data.data : []).filter((item) => item.is_active !== false)),
        )
        .catch(() => setPromotions([]))
    }
  }, [feedback, t, retail, promoEnabled])

  useEffect(() => {
    if (!promoEnabled || promotions.length === 0) return
    const missing = promoGetProductIds(promotions).filter((id) => !products.some((item) => item.id === id))
    if (missing.length === 0) return
    void Promise.all(
      missing.map((id) =>
        api
          .get<ApiOk<Product>>(`/products/${id}`, { silent: true })
          .then((res) => res.data.data)
          .catch(() => null),
      ),
    ).then((fetched) => {
      const extra = fetched.filter((item): item is Product => item != null)
      if (extra.length === 0) return
      setProducts((current) => {
        const have = new Set(current.map((item) => item.id))
        const add = extra.filter((item) => !have.has(item.id))
        return add.length === 0 ? current : [...current, ...add]
      })
    })
  }, [promotions, products, promoEnabled])

  useEffect(() => {
    if (promoEnabled) return
    setPromotions([])
    setPromotionId('')
    setPromoCodeApplied(null)
    setPromoCodeInput('')
    setSuppressAutoPromo(false)
  }, [promoEnabled])

  useEffect(() => {
    if (retail) setChannelCode('pos')
  }, [retail])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku ?? '').toLowerCase().includes(q) ||
            (p.barcode ?? '').toLowerCase().includes(q),
        )
      : products
    return retail ? list.slice(0, 12) : list
  }, [products, query, retail])

  function sellPrice(product: Product) {
    if (channelCode !== 'pos') {
      const found = product.channel_prices?.find((row) => row.code === channelCode)
      if (found) return found.sell_price
    }
    return product.sell_price
  }

  const subtotal = cart.reduce((sum, line) => sum + sellPrice(line.product) * line.qty, 0)
  const selectedDiscount = useMemo(
    () => (discountId ? discounts.find((item) => item.id === discountId) ?? null : null),
    [discountId, discounts],
  )
  const selectablePromotions = useMemo(() => promotions.filter((item) => item.is_active !== false), [promotions])
  const selectedManualPromotion = useMemo(
    () => (promotionId ? promotions.find((item) => item.id === promotionId) ?? null : null),
    [promotionId, promotions],
  )
  const paidCartLines = useMemo(() => paidPromoLines(cart, sellPrice), [cart, channelCode, products])
  const paidSubtotal = paidCartLines.reduce((sum, line) => sum + line.qty * line.price, 0)
  const paidFingerprint = useMemo(
    () => paidCartLines.map((line) => `${line.product_id}:${line.qty}`).join('|'),
    [paidCartLines],
  )
  paidFingerprintRef.current = paidFingerprint

  useEffect(() => {
    if (!suppressAutoPromo || suppressAtPaidFingerprintRef.current === null) return
    if (paidFingerprint !== suppressAtPaidFingerprintRef.current) {
      setSuppressAutoPromo(false)
      suppressAtPaidFingerprintRef.current = null
    }
  }, [paidFingerprint, suppressAutoPromo])
  const cartLines = useMemo(() => {
    const rows: { qty: number; price: number; product_id: number; category_id: number | null | undefined }[] = []
    cart.forEach((line) => {
      const free = line.promo_free_qty ?? 0
      const paid = Math.max(0, line.qty - free)
      const price = sellPrice(line.product)
      if (paid > 0) {
        rows.push({
          qty: paid,
          price,
          product_id: line.product.id,
          category_id: line.product.category_id,
        })
      }
      if (free > 0) {
        rows.push({
          qty: free,
          price: 0,
          product_id: line.product.id,
          category_id: line.product.category_id,
        })
      }
    })
    return rows
  }, [cart, channelCode, products])
  const autoPromotion = useMemo(() => {
    if (suppressAutoPromo || discountId || promotionId || promoCodeApplied) return null
    return bestAutoPromotion(promotions, paidCartLines, paidSubtotal, (productId) => {
      const product =
        products.find((item) => item.id === productId) ?? cart.find((line) => line.product.id === productId)?.product
      return product ? sellPrice(product) : 0
    })
  }, [
    suppressAutoPromo,
    discountId,
    promotionId,
    promoCodeApplied,
    promotions,
    paidCartLines,
    paidSubtotal,
    products,
    cart,
    channelCode,
  ])
  const effectivePromotion = selectedManualPromotion ?? promoCodeApplied ?? autoPromotion

  useEffect(() => {
    setCart((current) => {
      const next = syncCrossPromoFree(current, effectivePromotion, products, sellPrice)
      return cartFingerprint(current) === cartFingerprint(next) ? current : next
    })
  }, [effectivePromotion?.id, products, channelCode, paidFingerprint])

  const taxPercent = Number(me?.settings?.tax_percent ?? 0)
  const checkoutTotals = useMemo(
    () => computeCheckoutTotals(cartLines, effectivePromotion ? null : selectedDiscount, effectivePromotion, taxPercent),
    [cartLines, selectedDiscount, effectivePromotion, taxPercent],
  )
  const pay = Number(payAmount || 0)
  const change = Math.max(0, pay - checkoutTotals.total)
  const methods = [
    { id: 'cash' as const, label: t('cash') },
    { id: 'transfer' as const, label: t('transfer') },
    { id: 'qris' as const, label: t('qris') },
  ]

  function sameLine(line: CartLine, product: Product) {
    if (line.product.id === product.id) return true
    if (product.barcode && line.product.barcode && line.product.barcode === product.barcode) return true
    if (product.sku && line.product.sku && line.product.sku === product.sku) return true
    return false
  }

  function addProduct(product: Product) {
    setCart((current) => {
      const found = current.find((line) => sameLine(line, product))
      if (found) {
        return current.map((line) =>
          line.product.id === found.product.id ? { ...line, qty: line.qty + 1 } : line,
        )
      }
      return [...current, { product, qty: 1 }]
    })
    setHighlightId(product.id)
    setHighlightSeq((n) => n + 1)
    setQuery('')
  }

  function setQty(productId: number, qty: number) {
    if (qty <= 0) {
      setCart((current) => current.filter((line) => line.product.id !== productId))
      return
    }
    // Qty di UI termasuk unit gratis — jangan hitung ulang free sebagai bayar (bikin qty membengkak).
    setCart((current) =>
      current.map((line) => {
        if (line.product.id !== productId) return line
        const free = line.promo_free_qty ?? 0
        const paid = Math.max(0, qty - free)
        return { product: line.product, qty: paid, promo_free_qty: 0 }
      }),
    )
  }

  async function lookupBarcode() {
    const code = query.trim()
    if (!code) return
    try {
      const { data } = await api.get<ApiOk<Product>>(`/products/barcode/${encodeURIComponent(code)}`)
      addProduct(data.data)
      return
    } catch {
      const local = products.find(
        (p) =>
          p.barcode === code ||
          p.sku === code ||
          (p.sku ?? '').toLowerCase() === code.toLowerCase() ||
          p.name.toLowerCase() === code.toLowerCase(),
      )
      if (local) {
        addProduct(local)
        return
      }
    }
    const matches = visible
    if (matches.length === 1) {
      addProduct(matches[0])
      return
    }
    feedback.warning(t('productNotFound'))
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void lookupBarcode()
    }
  }

  function clearPromoSelection(options?: { suppressAuto?: boolean }) {
    setPromotionId('')
    setPromoCodeInput('')
    setPromoCodeApplied(null)
    if (options?.suppressAuto !== false) {
      setSuppressAutoPromo(true)
      suppressAtPaidFingerprintRef.current = paidFingerprintRef.current
    } else {
      setSuppressAutoPromo(false)
      suppressAtPaidFingerprintRef.current = null
    }
  }

  function onDiscountChange(value: number | '') {
    setDiscountId(value)
    if (value) clearPromoSelection({ suppressAuto: true })
  }

  function onPromotionChange(value: number | '') {
    setPromotionId(value)
    setPromoCodeInput('')
    setPromoCodeApplied(null)
    if (value) {
      setDiscountId('')
      setSuppressAutoPromo(false)
      suppressAtPaidFingerprintRef.current = null
    } else {
      setSuppressAutoPromo(true)
      suppressAtPaidFingerprintRef.current = paidFingerprintRef.current
    }
  }

  function openPromoModal() {
    setPromoModalOpen(true)
  }

  function openDiscountModal() {
    if (discounts.length === 0) {
      feedback.warning(t('posDiscountEmpty'))
      return
    }
    setDiscountModalOpen(true)
  }

  function openHoldModal() {
    refreshHolds()
    setHoldModalOpen(true)
  }

  function resetTxnState() {
    setCart([])
    setPayAmount('')
    setDiscountId('')
    clearPromoSelection({ suppressAuto: false })
    setSuppressAutoPromo(false)
    setMethod('cash')
  }

  function parkCurrentCart(silent = false) {
    if (!holdScope) return false
    if (cart.length === 0) {
      if (!silent) feedback.warning(t('posHoldEmptyCart'))
      return false
    }
    const lines = cartToHoldLines(cart)
    savePosHold(holdScope, {
      label: formatHoldLabel(lines),
      lines,
      method,
      discountId,
      promotionId,
      promoCodeInput,
      promoCodeAppliedId: promoCodeApplied?.id ?? null,
      suppressAutoPromo,
      channelCode,
      payAmount,
    })
    resetTxnState()
    refreshHolds()
    if (!silent) feedback.success(t('posHoldSaved'))
    return true
  }

  async function resumeHold(id: string) {
    if (!holdScope) return
    const hold = getPosHold(holdScope, id)
    if (!hold) return

    if (cart.length > 0) {
      const ok = await feedback.confirm({
        title: t('posHoldListTitle'),
        message: t('posHoldReplaceHint'),
      })
      if (!ok) return
      parkCurrentCart(true)
    }

    const { cart: nextCart, missing } = holdLinesToCart(hold.lines, products)
    if (nextCart.length === 0) {
      feedback.warning(t('posHoldMissingItems'))
      return
    }

    setCart(nextCart)
    setMethod(hold.method)
    setDiscountId(hold.discountId)
    setPromotionId(hold.promotionId)
    setPromoCodeInput(hold.promoCodeInput)
    setPromoCodeApplied(
      hold.promoCodeAppliedId
        ? promotions.find((item) => item.id === hold.promoCodeAppliedId) ?? null
        : null,
    )
    setSuppressAutoPromo(hold.suppressAutoPromo)
    suppressAtPaidFingerprintRef.current = hold.suppressAutoPromo
      ? paidPromoLines(nextCart, sellPrice)
          .map((line) => `${line.product_id}:${line.qty}`)
          .join('|')
      : null
    setChannelCode(hold.channelCode || 'pos')
    setPayAmount(hold.payAmount)
    deletePosHold(holdScope, id)
    refreshHolds()
    setHoldModalOpen(false)
    if (missing.length) feedback.warning(t('posHoldMissingItems'))
    else feedback.success(t('posHoldResumed'))
  }

  function removeHold(id: string) {
    if (!holdScope) return
    deletePosHold(holdScope, id)
    refreshHolds()
  }

  function applyPromoCode(codeOverride?: string) {
    const code = (codeOverride ?? promoCodeInput).trim().toUpperCase()
    setPromoCodeInput(code)
    if (!code) {
      setPromoCodeApplied(null)
      return
    }
    const found = promotions.find((item) => (item.code ?? '').toUpperCase() === code)
    if (!found) {
      setPromoCodeApplied(null)
      feedback.warning(t('posPromoInvalid'))
      return
    }
    setPromoCodeApplied(found)
    setPromotionId('')
    setDiscountId('')
    setSuppressAutoPromo(false)
  }

  async function checkout(event?: FormEvent) {
    event?.preventDefault()
    if (cart.length === 0) return
    setBusy(true)
    const amount = method === 'cash' ? Math.max(pay, checkoutTotals.total) : checkoutTotals.total
    const clientUuid = crypto.randomUUID()

    try {
      const { data } = await api.post<ApiOk<Sale>>('/sales', {
        client_uuid: clientUuid,
        channel: channelCode || 'pos',
        discount_id: effectivePromotion ? undefined : discountId || undefined,
        promotion_id: effectivePromotion && !promoCodeApplied ? effectivePromotion.id : undefined,
        promo_code: promoCodeApplied?.code ?? undefined,
        items: cart.map((line) => ({ product_id: line.product.id, qty: line.qty })),
        payments: [{ method, amount, client_uuid: `${clientUuid}-p0` }],
      })
      const receiptRes = await api.get<ApiOk<ReceiptPayload>>(`/sales/${data.data.id}/receipt`)
      setReceipt(receiptRes.data.data)
      setCart([])
      setPayAmount('')
      setDiscountId('')
      clearPromoSelection({ suppressAuto: false })
      setSuppressAutoPromo(false)
      const refreshed = await api.get<ApiOk<Product[]>>('/products', { params: { per_page: 100, for_pos: 1 } })
      setProducts(refreshed.data.data)
      feedback.success(t('saleOk'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saleFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function clearCart() {
    if (cart.length === 0) return
    const ok = await feedback.confirm({
      title: t('posClearCart'),
      message: t('posClearCartHint'),
      tone: 'danger',
    })
    if (ok) {
      setCart([])
      setPayAmount('')
      setDiscountId('')
      clearPromoSelection({ suppressAuto: false })
      setSuppressAutoPromo(false)
    }
  }

  async function printSettlement() {
    if (settling) return
    setSettling(true)
    try {
      const { data } = await api.get<ApiOk<PosSettlement>>('/sales/settlement')
      setReceipt(null)
      setSettlement(data.data)
    } catch (err) {
      feedback.error(apiMessage(err, t('posSettlementFailed')))
    } finally {
      setSettling(false)
    }
  }

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'F8') {
        event.preventDefault()
        void printSettlement()
      }
      if (event.key === 'F3') {
        event.preventDefault()
        if (promoEnabled) openPromoModal()
      }
      if (event.key === 'F6') {
        event.preventDefault()
        openDiscountModal()
      }
      if (event.key === 'F7') {
        event.preventDefault()
        openHoldModal()
      }
      if (event.key === 'F9') {
        event.preventDefault()
        parkCurrentCart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (retail) {
    return (
      <PageEnter className="h-full min-h-0">
        <RetailRegister
          cashier={me?.user.name ?? '—'}
          outlet={me?.outlet?.name ?? me?.company?.name ?? '—'}
          query={query}
          onQuery={setQuery}
          products={visible}
          cart={cart}
          onAdd={addProduct}
          onQty={setQty}
          priceOf={sellPrice}
          onScan={() => void lookupBarcode()}
          onVoidLast={() => setCart((current) => current.slice(0, -1))}
          onClear={() => void clearCart()}
          highlightId={highlightId}
          highlightSeq={highlightSeq}
          method={method}
          onMethod={setMethod}
          payAmount={payAmount}
          onPayAmount={setPayAmount}
          subtotal={paidSubtotal}
          discountAmount={checkoutTotals.discountTotal}
          discountSource={checkoutTotals.source}
          taxAmount={checkoutTotals.tax}
          total={checkoutTotals.total}
          change={change}
          onOpenDiscountList={openDiscountModal}
          onClearDiscount={() => setDiscountId('')}
          formatDiscountLabel={(item) =>
            `${item.name} (${formatDiscountValue(item, (value) => formatRupiah(value, locale))})`
          }
          selectedDiscount={selectedDiscount}
          promotionId={promotionId}
          onOpenPromoList={promoEnabled ? openPromoModal : undefined}
          onClearPromo={() => clearPromoSelection()}
          onParkCart={() => parkCurrentCart()}
          onOpenHoldList={openHoldModal}
          holdCount={holds.length}
          autoPromotion={autoPromotion}
          effectivePromotion={effectivePromotion}
          promoCodeActive={Boolean(promoCodeApplied)}
          formatPromotionLabel={(item) => formatPromotionLabel(item, (value) => formatRupiah(value, locale))}
          busy={busy}
          settling={settling}
          onCheckout={() => void checkout()}
          onSettlement={() => void printSettlement()}
        />
        <PromoSelectModal
          open={promoModalOpen}
          promotions={selectablePromotions}
          value={promotionId || (promoCodeApplied?.id ?? (autoPromotion?.id ?? ''))}
          onSelect={(value) => {
            if (value === '') {
              clearPromoSelection()
              return
            }
            onPromotionChange(value)
          }}
          onClose={() => setPromoModalOpen(false)}
          formatLabel={(item) => formatPromotionLabel(item, (amount) => formatRupiah(amount, locale))}
          promoCode={promoCodeInput}
          onPromoCodeChange={setPromoCodeInput}
          onApplyPromoCode={(code) => applyPromoCode(code)}
        />
        <DiscountSelectModal
          open={discountModalOpen}
          discounts={discounts}
          value={discountId}
          onSelect={onDiscountChange}
          onClose={() => setDiscountModalOpen(false)}
          formatLabel={(item) =>
            `${item.name} (${formatDiscountValue(item, (value) => formatRupiah(value, locale))})`
          }
        />
        <HoldSelectModal
          open={holdModalOpen}
          holds={holds}
          onResume={(id) => void resumeHold(id)}
          onDelete={removeHold}
          onClose={() => setHoldModalOpen(false)}
          formatMoney={(value) => formatRupiah(value, locale)}
          formatWhen={(iso) =>
            new Date(iso).toLocaleString(locale, {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          }
        />
        <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
        <SettlementModal data={settlement} onClose={() => setSettlement(null)} />
      </PageEnter>
    )
  }

  return (
    <PageEnter className="p-4">
      <PageHeader
        eyebrow={t('posEyebrow')}
        title={t('posTitle')}
        subtitle={`${posModeLabel} · ${t('posSubtitle')}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost" onClick={() => parkCurrentCart()}>
              {t('posHoldShortcut')}
            </button>
            <button type="button" className="btn-ghost" onClick={openHoldModal}>
              {t('posHoldListShortcut')}
              {holds.length > 0 ? ` (${holds.length})` : ''}
            </button>
            <button type="button" className="btn-ghost" onClick={openDiscountModal}>
              {t('posDiscountShortcut')}
            </button>
            {promoEnabled ? (
              <button type="button" className="btn-ghost" onClick={openPromoModal}>
                {t('posPromoShortcut')}
              </button>
            ) : null}
            <button type="button" className="btn-ghost" disabled={settling} onClick={() => void printSettlement()}>
              {t('posSettlement')} · F8
            </button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <section>
          {channels.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChannelCode('pos')}
                className={`rounded-xl px-3 py-2 text-sm ${
                  channelCode === 'pos' ? 'bg-mint text-ink font-semibold' : 'bg-fill text-muted'
                }`}
              >
                {t('posChannelPos')}
              </button>
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setChannelCode(channel.code)}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    channelCode === channel.code ? 'bg-mint text-ink font-semibold' : 'bg-fill text-muted'
                  }`}
                >
                  {channel.name}
                </button>
              ))}
            </div>
          ) : null}
          <input
            autoFocus
            className="field mb-4 py-3 text-base"
            placeholder={t('posSearch')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((product, index) => (
              <motion.button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.2) }}
                whileTap={{ scale: 0.98 }}
                className="glass rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-mint/40"
              >
                {product.images?.find((image) => image.is_primary)?.url ?? product.images?.[0]?.url ? (
                  <img
                    src={product.images.find((image) => image.is_primary)?.url ?? product.images[0].url}
                    alt=""
                    className="mb-3 h-28 w-full rounded-xl object-cover"
                  />
                ) : null}
                <div className="font-medium text-fg">{product.name}</div>
                <div className="mt-1 font-display text-lg text-mint">{formatRupiah(sellPrice(product), locale)}</div>
                <div className="mt-2 text-xs text-muted">
                  {t('stock')} {product.stock_qty}
                  {product.stock_qty <= product.min_stock ? (
                    <span className="ml-2 text-gold">{t('lowStock')}</span>
                  ) : null}
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        <aside className="glass sticky top-4 h-fit rounded-3xl p-5">
          <div className="mb-3 font-display text-lg font-bold">{t('cart')}</div>
          <div className="max-h-[40vh] space-y-2 overflow-auto pr-1">
            {cart.length === 0 ? (
              <p className="text-sm text-muted">{t('cartEmpty')}</p>
            ) : (
              cart.map((line) => (
                <div key={line.product.id} className="flex items-center justify-between gap-2 rounded-2xl bg-fill p-2.5">
                  <div>
                    <div className="text-sm font-medium">
                      {line.product.name}
                      {(line.promo_free_qty ?? 0) > 0 ? (
                        <span className="ml-2 rounded bg-mint/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mint">
                          {t('posPromoFreeBadge')}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted">
                      {formatRupiah(
                        (line.promo_free_qty ?? 0) >= line.qty ? 0 : sellPrice(line.product),
                        locale,
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg bg-fill"
                      onClick={() => setQty(line.product.id, line.qty - 1)}
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm">{line.qty}</span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg bg-fill"
                      onClick={() => setQty(line.product.id, line.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 space-y-2 border-t border-line pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">{t('receiptSubtotal')}</span>
              <span className="tabular-nums">{formatRupiah(subtotal, locale)}</span>
            </div>
            {checkoutTotals.discountTotal > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted">{checkoutTotals.source === 'promotion' ? t('receiptPromo') : t('receiptDiscount')}</span>
                <span className="tabular-nums text-rose-300">-{formatRupiah(checkoutTotals.discountTotal, locale)}</span>
              </div>
            ) : null}
            {checkoutTotals.tax > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted">{t('receiptTax')}</span>
                <span className="tabular-nums">{formatRupiah(checkoutTotals.tax, locale)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted">{t('total')}</span>
              <span className="font-display text-xl font-bold text-mint">{formatRupiah(checkoutTotals.total, locale)}</span>
            </div>
          </div>

          <form onSubmit={(e) => void checkout(e)} className="mt-4 space-y-3">
            {autoPromotion && !promotionId && !promoCodeApplied ? (
              <div className="rounded-xl bg-mint/10 px-3 py-2 text-xs text-mint">
                <div className="font-medium">{t('posPromoAutoApplied')}</div>
                <div>{formatPromotionLabel(autoPromotion, (value) => formatRupiah(value, locale))}</div>
                <button type="button" className="mt-1 text-xs text-rose-300" onClick={() => clearPromoSelection()}>
                  {t('posClearPromo')}
                </button>
              </div>
            ) : null}
            {effectivePromotion && (promotionId || promoCodeApplied) ? (
              <div className="rounded-xl bg-fill px-3 py-2 text-sm">
                <div className="text-muted">{t('receiptPromo')}</div>
                <div className="font-medium">{effectivePromotion.name}</div>
                <button type="button" className="mt-1 text-xs text-rose-300" onClick={() => clearPromoSelection()}>
                  {t('posClearPromo')}
                </button>
              </div>
            ) : null}
            {selectedDiscount && !effectivePromotion ? (
              <div className="rounded-xl bg-fill px-3 py-2 text-sm">
                <div className="text-muted">{t('receiptDiscount')}</div>
                <div className="font-medium">{selectedDiscount.name}</div>
                <button type="button" className="mt-1 text-xs text-rose-300" onClick={() => setDiscountId('')}>
                  {t('posNoDiscount')}
                </button>
              </div>
            ) : null}
            <div className="flex gap-2">
              {methods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMethod(item.id)}
                  className={`flex-1 rounded-xl px-2 py-2 text-sm ${
                    method === item.id ? 'bg-mint text-ink font-semibold' : 'bg-fill text-muted'
                  }`}
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
                  className="field"
                  placeholder={t('cashReceived')}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
                <div className="text-sm text-muted">{t('change')} {formatRupiah(change, locale)}</div>
              </>
            ) : null}
            <button type="submit" disabled={busy || cart.length === 0} className="btn-primary w-full py-3">
              {busy ? t('processing') : t('pay')}
            </button>
          </form>
        </aside>
      </div>

      <PromoSelectModal
        open={promoModalOpen}
        promotions={selectablePromotions}
        value={promotionId || (promoCodeApplied?.id ?? (autoPromotion?.id ?? ''))}
        onSelect={(value) => {
          if (value === '') {
            clearPromoSelection()
            return
          }
          onPromotionChange(value)
        }}
        onClose={() => setPromoModalOpen(false)}
        formatLabel={(item) => formatPromotionLabel(item, (amount) => formatRupiah(amount, locale))}
        promoCode={promoCodeInput}
        onPromoCodeChange={setPromoCodeInput}
        onApplyPromoCode={(code) => applyPromoCode(code)}
      />
      <DiscountSelectModal
        open={discountModalOpen}
        discounts={discounts}
        value={discountId}
        onSelect={onDiscountChange}
        onClose={() => setDiscountModalOpen(false)}
        formatLabel={(item) =>
          `${item.name} (${formatDiscountValue(item, (value) => formatRupiah(value, locale))})`
        }
      />
      <HoldSelectModal
        open={holdModalOpen}
        holds={holds}
        onResume={(id) => void resumeHold(id)}
        onDelete={removeHold}
        onClose={() => setHoldModalOpen(false)}
        formatMoney={(value) => formatRupiah(value, locale)}
        formatWhen={(iso) =>
          new Date(iso).toLocaleString(locale, {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        }
      />
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      <SettlementModal data={settlement} onClose={() => setSettlement(null)} />
    </PageEnter>
  )
}
