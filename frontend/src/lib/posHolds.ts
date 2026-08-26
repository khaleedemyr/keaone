import type { CartLine, Product } from '../types'

export type PosHoldLine = {
  product_id: number
  qty: number
  promo_free_qty?: number
  name: string
  sku?: string | null
  sell_price: number
}

export type PosHoldSnapshot = {
  id: string
  label: string
  savedAt: string
  lines: PosHoldLine[]
  method: 'cash' | 'transfer' | 'qris'
  discountId: number | ''
  promotionId: number | ''
  promoCodeInput: string
  promoCodeAppliedId: number | null
  suppressAutoPromo: boolean
  channelCode: string
  payAmount: string
}

export type PosHoldScope = {
  companyId: number
  outletId: number
  userId: number
}

const MAX_HOLDS = 20

function storageKey(scope: PosHoldScope) {
  return `kea_pos_holds:${scope.companyId}:${scope.outletId}:${scope.userId}`
}

export function readPosHolds(scope: PosHoldScope): PosHoldSnapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw) as PosHoldSnapshot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePosHolds(scope: PosHoldScope, holds: PosHoldSnapshot[]) {
  localStorage.setItem(storageKey(scope), JSON.stringify(holds.slice(0, MAX_HOLDS)))
}

export function cartToHoldLines(cart: CartLine[]): PosHoldLine[] {
  return cart.map((line) => ({
    product_id: line.product.id,
    qty: line.qty,
    promo_free_qty: line.promo_free_qty ?? 0,
    name: line.product.name,
    sku: line.product.sku,
    sell_price: line.product.sell_price,
  }))
}

export function holdLinesToCart(lines: PosHoldLine[], catalog: Product[]): {
  cart: CartLine[]
  missing: string[]
} {
  const cart: CartLine[] = []
  const missing: string[] = []
  lines.forEach((line) => {
    const product = catalog.find((item) => item.id === line.product_id)
    if (!product) {
      missing.push(line.name)
      return
    }
    cart.push({
      product,
      qty: line.qty,
      promo_free_qty: line.promo_free_qty ?? 0,
    })
  })
  return { cart, missing }
}

export function savePosHold(
  scope: PosHoldScope,
  hold: Omit<PosHoldSnapshot, 'id' | 'savedAt'> & { id?: string; savedAt?: string },
): PosHoldSnapshot {
  const next: PosHoldSnapshot = {
    ...hold,
    id: hold.id ?? crypto.randomUUID(),
    savedAt: hold.savedAt ?? new Date().toISOString(),
  }
  const holds = [next, ...readPosHolds(scope).filter((item) => item.id !== next.id)]
  writePosHolds(scope, holds)
  return next
}

export function deletePosHold(scope: PosHoldScope, id: string) {
  writePosHolds(
    scope,
    readPosHolds(scope).filter((item) => item.id !== id),
  )
}

export function getPosHold(scope: PosHoldScope, id: string) {
  return readPosHolds(scope).find((item) => item.id === id) ?? null
}

export function formatHoldLabel(lines: PosHoldLine[], at = new Date()) {
  const count = lines.reduce((sum, line) => sum + Math.max(0, line.qty - (line.promo_free_qty ?? 0)), 0)
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const first = lines[0]?.name
  if (first) return `${time} · ${first}${count > 1 ? ` (+${count - 1})` : ''}`
  return `${time} · Draft`
}
