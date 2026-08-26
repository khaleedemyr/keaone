import type { Promotion } from '../types'

export type PromoLine = { qty: number; price: number; product_id: number; category_id?: number | null }

export type AppliedPromo = {
  itemDiscounts: number[]
  saleDiscount: number
  promoTotal: number
}

function lineAmount(promotion: Promotion, lineSubtotal: number, useMaxCap: boolean) {
  if (lineSubtotal <= 0) return 0
  if (promotion.type === 'percent') {
    let amount = Math.round((lineSubtotal * promotion.value) / 100)
    if (useMaxCap && promotion.max_discount) amount = Math.min(amount, promotion.max_discount)
    return Math.min(amount, lineSubtotal)
  }
  if (promotion.type === 'fixed') {
    return Math.min(promotion.value, lineSubtotal)
  }
  return 0
}

function scaleAmounts(amounts: number[], cap: number, indexes: number[]) {
  const eligible = indexes.map((index) => amounts[index] ?? 0)
  const total = eligible.reduce((sum, value) => sum + value, 0)
  if (total <= 0 || total <= cap) return amounts
  const scaled = [...amounts]
  let remaining = cap
  const last = indexes.length - 1
  indexes.forEach((index, i) => {
    const amount = amounts[index] ?? 0
    if (i === last) {
      scaled[index] = remaining
      return
    }
    const part = Math.floor((cap * amount) / total)
    scaled[index] = part
    remaining -= part
  })
  return scaled
}

function relatedProductIds(promotion: Promotion) {
  return promotion.products?.map((p) => p.id) ?? []
}

function bogoBuyProductIds(promotion: Promotion) {
  const config = promotion.config ?? {}
  if (config.buy_product_ids && config.buy_product_ids.length > 0) {
    return config.buy_product_ids.map(Number)
  }
  return relatedProductIds(promotion)
}

function bogoGetProductIds(promotion: Promotion) {
  const config = promotion.config ?? {}
  if (config.get_product_ids && config.get_product_ids.length > 0) {
    return config.get_product_ids.map(Number)
  }
  return bogoBuyProductIds(promotion)
}

function sameIdSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

function isCrossItemBogo(promotion: Promotion) {
  const config = promotion.config ?? {}
  if (!config.get_product_ids || config.get_product_ids.length === 0) return false
  return !sameIdSet(bogoBuyProductIds(promotion), bogoGetProductIds(promotion))
}

export function isCrossItemBogoPromotion(promotion: Promotion) {
  return isCrossItemBogo(promotion)
}

export function crossBogoGetProductIds(promotion: Promotion) {
  return bogoGetProductIds(promotion)
}

/** How many free get-units a cross-item B1G1 should grant from current buy lines. */
export function crossBogoNeededFreeQty(promotion: Promotion, lines: PromoLine[]) {
  if (!isCrossItemBogo(promotion)) return 0
  const config = promotion.config ?? {}
  const buyQty = Math.max(1, Number(config.buy_qty ?? 1))
  const getQty = Math.max(1, Number(config.get_qty ?? 1))
  const buyIndexes = indexesMatchingProducts(lines, bogoBuyProductIds(promotion))
  const buyTotal = buyIndexes.reduce((sum, index) => sum + lines[index].qty, 0)
  return Math.floor(buyTotal / buyQty) * getQty
}

function indexesMatchingProducts(
  lines: PromoLine[],
  productIds: number[],
  categoryIds: number[] = [],
) {
  if (productIds.length === 0 && categoryIds.length === 0) {
    return lines.map((_, index) => index)
  }
  const indexes: number[] = []
  lines.forEach((line, index) => {
    if (productIds.includes(line.product_id)) {
      indexes.push(index)
      return
    }
    if (line.category_id && categoryIds.includes(line.category_id)) indexes.push(index)
  })
  return indexes
}

function eligibleIndexes(promotion: Promotion, lines: PromoLine[]) {
  const productIds = relatedProductIds(promotion)
  const categoryIds = promotion.categories?.map((c) => c.id) ?? []
  return indexesMatchingProducts(lines, productIds, categoryIds)
}

function bundleCount(promotion: Promotion, lines: PromoLine[]) {
  const config = promotion.config ?? {}
  let items = config.items ?? []
  if (items.length === 0 && promotion.products?.length) {
    items = promotion.products.map((p) => ({ product_id: p.id, qty: 1 }))
  }
  if (items.length === 0) return 0

  const counts = items.map((item) => {
    const productId = Number(item.product_id ?? 0)
    const needQty = Math.max(1, Number(item.qty ?? 1))
    const line = lines.find((row) => row.product_id === productId)
    return line ? Math.floor(line.qty / needQty) : 0
  })
  return Math.min(...counts)
}

function isWithinDates(promotion: Promotion, at = new Date()) {
  if (promotion.starts_at && at < new Date(promotion.starts_at)) return false
  if (promotion.ends_at && at > new Date(promotion.ends_at)) return false
  return true
}

function bogoSetsAvailable(promotion: Promotion, lines: PromoLine[]) {
  const config = promotion.config ?? {}
  const buyQty = Math.max(1, Number(config.buy_qty ?? 1))
  const getQty = Math.max(1, Number(config.get_qty ?? 1))
  if (!isCrossItemBogo(promotion)) {
    const setSize = buyQty + getQty
    const indexes = indexesMatchingProducts(lines, bogoBuyProductIds(promotion))
    let sets = 0
    indexes.forEach((index) => {
      sets += Math.floor(lines[index].qty / setSize)
    })
    return sets
  }

  const buyIndexes = indexesMatchingProducts(lines, bogoBuyProductIds(promotion))
  const buyTotal = buyIndexes.reduce((sum, index) => sum + lines[index].qty, 0)
  return Math.floor(buyTotal / buyQty)
}

export function isPromotionEligible(promotion: Promotion, lines: PromoLine[], subtotal: number, at = new Date()) {
  if (!promotion.is_active || !isWithinDates(promotion, at)) return false
  if (promotion.min_subtotal && subtotal < promotion.min_subtotal) return false
  if (promotion.type === 'bundle') return bundleCount(promotion, lines) > 0
  if (promotion.type === 'bogo') return bogoSetsAvailable(promotion, lines) > 0
  if ((promotion.products?.length ?? 0) > 0 || (promotion.categories?.length ?? 0) > 0) {
    return eligibleIndexes(promotion, lines).length > 0
  }
  return true
}

function applyBogoSameItem(promotion: Promotion, lines: PromoLine[]) {
  const config = promotion.config ?? {}
  const buyQty = Math.max(1, Number(config.buy_qty ?? 1))
  const getQty = Math.max(1, Number(config.get_qty ?? 1))
  const setSize = buyQty + getQty
  const itemDiscounts = lines.map(() => 0)
  const eligible = indexesMatchingProducts(lines, bogoBuyProductIds(promotion))

  eligible.forEach((index) => {
    const line = lines[index]
    const sets = Math.floor(line.qty / setSize)
    const freeUnits = sets * getQty
    itemDiscounts[index] = Math.round(freeUnits * line.price)
  })

  let total = itemDiscounts.reduce((sum, value) => sum + value, 0)
  if (promotion.max_discount && total > promotion.max_discount) {
    const scaled = scaleAmounts(itemDiscounts, promotion.max_discount, eligible)
    total = scaled.reduce((sum, value) => sum + value, 0)
    return { itemDiscounts: scaled, saleDiscount: 0, promoTotal: total }
  }

  return { itemDiscounts, saleDiscount: 0, promoTotal: total }
}

function applyBogoCrossItem(promotion: Promotion, lines: PromoLine[]) {
  const config = promotion.config ?? {}
  const buyQty = Math.max(1, Number(config.buy_qty ?? 1))
  const getQty = Math.max(1, Number(config.get_qty ?? 1))
  const buyIndexes = indexesMatchingProducts(lines, bogoBuyProductIds(promotion))
  const getIndexes = indexesMatchingProducts(lines, bogoGetProductIds(promotion))
  const itemDiscounts = lines.map(() => 0)

  const buyTotal = buyIndexes.reduce((sum, index) => sum + lines[index].qty, 0)
  const sets = Math.floor(buyTotal / buyQty)
  let freeUnits = sets * getQty
  if (freeUnits <= 0 || getIndexes.length === 0) {
    return { itemDiscounts, saleDiscount: 0, promoTotal: 0 }
  }

  // Apply free units to cheapest get lines first.
  const ordered = [...getIndexes].sort((a, b) => lines[a].price - lines[b].price || a - b)
  ordered.forEach((index) => {
    if (freeUnits <= 0) return
    const line = lines[index]
    const take = Math.min(freeUnits, line.qty)
    itemDiscounts[index] = Math.round(take * line.price)
    freeUnits -= take
  })

  const discountedIndexes = ordered.filter((index) => (itemDiscounts[index] ?? 0) > 0)
  let total = itemDiscounts.reduce((sum, value) => sum + value, 0)
  if (promotion.max_discount && total > promotion.max_discount) {
    const scaled = scaleAmounts(itemDiscounts, promotion.max_discount, discountedIndexes)
    total = scaled.reduce((sum, value) => sum + value, 0)
    return { itemDiscounts: scaled, saleDiscount: 0, promoTotal: total }
  }

  return { itemDiscounts, saleDiscount: 0, promoTotal: total }
}

function applyBogo(promotion: Promotion, lines: PromoLine[]) {
  if (isCrossItemBogo(promotion)) return applyBogoCrossItem(promotion, lines)
  return applyBogoSameItem(promotion, lines)
}

function applyBundle(promotion: Promotion, lines: PromoLine[]) {
  const count = bundleCount(promotion, lines)
  if (count <= 0) return { itemDiscounts: lines.map(() => 0), saleDiscount: 0, promoTotal: 0 }

  const config = promotion.config ?? {}
  const bundlePrice = Number(config.bundle_price ?? promotion.value)
  let items = config.items ?? []
  if (items.length === 0 && promotion.products?.length) {
    items = promotion.products.map((p) => ({ product_id: p.id, qty: 1 }))
  }

  let regular = 0
  items.forEach((item) => {
    const productId = Number(item.product_id ?? 0)
    const needQty = Math.max(1, Number(item.qty ?? 1))
    const line = lines.find((row) => row.product_id === productId)
    if (line) regular += line.price * needQty
  })

  let saleDiscount = Math.max(0, (regular - bundlePrice) * count)
  if (promotion.max_discount) saleDiscount = Math.min(saleDiscount, promotion.max_discount)

  return { itemDiscounts: lines.map(() => 0), saleDiscount, promoTotal: saleDiscount }
}

function applySimple(promotion: Promotion, lines: PromoLine[], subtotal: number) {
  const eligible = eligibleIndexes(promotion, lines)
  const itemDiscounts = lines.map(() => 0)

  if (promotion.scope === 'item') {
    eligible.forEach((index) => {
      const line = lines[index]
      itemDiscounts[index] = lineAmount(promotion, line.qty * line.price, false)
    })
    let total = itemDiscounts.reduce((sum, value) => sum + value, 0)
    if (promotion.max_discount && total > promotion.max_discount) {
      const scaled = scaleAmounts(itemDiscounts, promotion.max_discount, eligible)
      total = scaled.reduce((sum, value) => sum + value, 0)
      return { itemDiscounts: scaled, saleDiscount: 0, promoTotal: total }
    }
    return { itemDiscounts, saleDiscount: 0, promoTotal: total }
  }

  let eligibleSubtotal = 0
  eligible.forEach((index) => {
    const line = lines[index]
    eligibleSubtotal += line.qty * line.price
  })
  if (eligibleSubtotal === 0) eligibleSubtotal = subtotal
  const saleDiscount = lineAmount(promotion, eligibleSubtotal, true)
  return { itemDiscounts, saleDiscount, promoTotal: saleDiscount }
}

export function applyPromotion(promotion: Promotion | null, lines: PromoLine[], subtotal: number): AppliedPromo {
  if (!promotion || subtotal <= 0 || !isPromotionEligible(promotion, lines, subtotal)) {
    return { itemDiscounts: lines.map(() => 0), saleDiscount: 0, promoTotal: 0 }
  }

  if (promotion.type === 'bogo') return applyBogo(promotion, lines)
  if (promotion.type === 'bundle') return applyBundle(promotion, lines)
  return applySimple(promotion, lines, subtotal)
}

export function bestAutoPromotion(
  promotions: Promotion[],
  lines: PromoLine[],
  subtotal: number,
  estimateUnitPrice?: (productId: number) => number,
): Promotion | null {
  let best: Promotion | null = null
  let bestAmount = 0
  for (const promotion of promotions) {
    if (promotion.apply_mode !== 'auto') continue
    const applied = applyPromotion(promotion, lines, subtotal)
    let amount = applied.promoTotal
    if (amount <= 0 && isCrossItemBogo(promotion)) {
      const freeQty = crossBogoNeededFreeQty(promotion, lines)
      if (freeQty > 0) {
        const getId = bogoGetProductIds(promotion)[0]
        const unit = getId && estimateUnitPrice ? estimateUnitPrice(getId) : 0
        if (freeQty > 0 && unit > 0) amount = freeQty * unit
      }
    }
    if (amount > bestAmount) {
      best = promotion
      bestAmount = amount
    } else if (amount === bestAmount && amount > 0 && promotion.priority > (best?.priority ?? 0)) {
      best = promotion
    }
  }
  return bestAmount > 0 ? best : null
}

export function formatPromotionLabel(promotion: Promotion, formatMoney: (value: number) => string) {
  if (promotion.type === 'percent') return `${promotion.name} (${promotion.value}%)`
  if (promotion.type === 'fixed') return `${promotion.name} (${formatMoney(promotion.value)})`
  if (promotion.type === 'bogo') {
    const config = promotion.config ?? {}
    return `${promotion.name} (B${config.buy_qty ?? 1}G${config.get_qty ?? 1})`
  }
  if (promotion.type === 'bundle') {
    const price = Number(promotion.config?.bundle_price ?? promotion.value)
    return `${promotion.name} (${formatMoney(price)})`
  }
  return promotion.name
}
