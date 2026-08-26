import type { CartLine, Product, Promotion } from '../types'
import {
  crossBogoGetProductIds,
  crossBogoNeededFreeQty,
  isCrossItemBogoPromotion,
  type PromoLine,
} from './promoCalc'

export function promoGetProductIds(promotions: Promotion[]) {
  const ids = new Set<number>()
  promotions.forEach((promotion) => {
    if (promotion.type !== 'bogo') return
    crossBogoGetProductIds(promotion).forEach((id) => ids.add(id))
  })
  return [...ids]
}

export function cartFingerprint(cart: CartLine[]) {
  return cart.map((line) => `${line.product.id}:${line.qty}:${line.promo_free_qty ?? 0}`).join('|')
}

export function paidPromoLines(
  cart: CartLine[],
  priceOf: (product: Product) => number,
): PromoLine[] {
  return cart
    .map((line) => {
      const paidQty = Math.max(0, line.qty - (line.promo_free_qty ?? 0))
      return {
        qty: paidQty,
        price: priceOf(line.product),
        product_id: line.product.id,
        category_id: line.product.category_id,
      }
    })
    .filter((line) => line.qty > 0)
}

/** Keep paid lines; re-attach free get-items required by a cross-item B1G1. */
export function syncCrossPromoFree(
  cart: CartLine[],
  promotion: Promotion | null,
  catalog: Product[],
  priceOf: (product: Product) => number,
): CartLine[] {
  const paidOnly: CartLine[] = []
  cart.forEach((line) => {
    const free = line.promo_free_qty ?? 0
    const paid = line.qty - free
    if (paid > 0) paidOnly.push({ product: line.product, qty: paid, promo_free_qty: 0 })
  })

  if (!promotion || !isCrossItemBogoPromotion(promotion)) return paidOnly

  const need = crossBogoNeededFreeQty(promotion, paidPromoLines(paidOnly, priceOf))
  if (need <= 0) return paidOnly

  const getId = crossBogoGetProductIds(promotion)[0]
  if (!getId) return paidOnly

  const product =
    catalog.find((item) => item.id === getId) ?? cart.find((line) => line.product.id === getId)?.product
  if (!product) return paidOnly

  const existing = paidOnly.find((line) => line.product.id === getId)
  if (existing) {
    return paidOnly.map((line) =>
      line.product.id === getId ? { ...line, qty: line.qty + need, promo_free_qty: need } : line,
    )
  }

  return [...paidOnly, { product, qty: need, promo_free_qty: need }]
}
