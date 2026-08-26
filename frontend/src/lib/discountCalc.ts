import type { Discount, Promotion } from '../types'
import { applyPromotion, type PromoLine } from './promoCalc'

export type DiscountLine = { qty: number; price: number }

export type AppliedDiscount = {
  itemDiscounts: number[]
  saleDiscount: number
  discountTotal: number
}

function lineAmount(discount: Discount, lineSubtotal: number, useMaxCap: boolean) {
  if (lineSubtotal <= 0) return 0
  if (discount.value_type === 'percent') {
    let amount = Math.round((lineSubtotal * discount.value) / 100)
    if (useMaxCap && discount.max_discount) amount = Math.min(amount, discount.max_discount)
    return Math.min(amount, lineSubtotal)
  }
  return Math.min(discount.value, lineSubtotal)
}

function scaleAmounts(amounts: number[], cap: number) {
  const total = amounts.reduce((sum, value) => sum + value, 0)
  if (total <= 0 || total <= cap) return amounts
  const scaled: number[] = []
  let remaining = cap
  const lastIndex = amounts.length - 1
  amounts.forEach((amount, index) => {
    if (index === lastIndex) {
      scaled.push(remaining)
      return
    }
    const part = Math.floor((cap * amount) / total)
    scaled.push(part)
    remaining -= part
  })
  return scaled
}

export function applyDiscount(discount: Discount | null, lines: DiscountLine[], subtotal: number): AppliedDiscount {
  if (!discount || subtotal <= 0) {
    return { itemDiscounts: lines.map(() => 0), saleDiscount: 0, discountTotal: 0 }
  }

  if (discount.min_subtotal && subtotal < discount.min_subtotal) {
    return { itemDiscounts: lines.map(() => 0), saleDiscount: 0, discountTotal: 0 }
  }

  if (discount.scope === 'item') {
    let itemDiscounts = lines.map((line) => lineAmount(discount, line.qty * line.price, false))
    let total = itemDiscounts.reduce((sum, value) => sum + value, 0)
    if (discount.max_discount && total > discount.max_discount) {
      itemDiscounts = scaleAmounts(itemDiscounts, discount.max_discount)
      total = itemDiscounts.reduce((sum, value) => sum + value, 0)
    }
    return { itemDiscounts, saleDiscount: 0, discountTotal: total }
  }

  const saleDiscount = lineAmount(discount, subtotal, true)
  return { itemDiscounts: lines.map(() => 0), saleDiscount, discountTotal: saleDiscount }
}

export function computeCheckoutTotals(
  lines: PromoLine[],
  discount: Discount | null,
  promotion: Promotion | null,
  taxPercent: number,
) {
  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.price, 0)
  const promoApplied = promotion ? applyPromotion(promotion, lines, subtotal) : null
  const discountApplied =
    !promotion && discount ? applyDiscount(discount, lines, subtotal) : { itemDiscounts: lines.map(() => 0), saleDiscount: 0, discountTotal: 0 }

  const discountTotal = promoApplied?.promoTotal ?? discountApplied.discountTotal
  const taxable = Math.max(0, subtotal - discountTotal)
  const tax = Math.round((taxable * taxPercent) / 100)
  const total = taxable + tax

  return {
    subtotal,
    taxable,
    tax,
    total,
    discountTotal,
    itemDiscounts: promoApplied?.itemDiscounts ?? discountApplied.itemDiscounts,
    saleDiscount: promoApplied?.saleDiscount ?? discountApplied.saleDiscount,
    source: promotion ? 'promotion' as const : discount ? 'discount' as const : null,
  }
}

export function formatDiscountValue(discount: Discount, formatMoney: (value: number) => string) {
  if (discount.value_type === 'percent') return `${discount.value}%`
  return formatMoney(discount.value)
}
