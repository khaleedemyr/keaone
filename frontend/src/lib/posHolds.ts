import { api } from '../api/client'
import type { ApiOk, CartLine, Product } from '../types'
import type { PosTenderRow } from './posTender'

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
  splitPay?: boolean
  tenders?: PosTenderRow[]
  user_id?: number | null
  user_name?: string | null
}

export type PosHoldScope = {
  companyId: number
  outletId: number
  userId: number
}

const MAX_HOLDS = 20

function storageKey(scope: PosHoldScope) {
  // Outlet-scoped cache so multi-cashier devices share the same offline fallback.
  return `kea_pos_holds:${scope.companyId}:${scope.outletId}`
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
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(holds.slice(0, MAX_HOLDS)))
  } catch {
    // Quota / private mode
  }
}

function normalizeHold(row: PosHoldSnapshot): PosHoldSnapshot {
  return {
    ...row,
    id: String(row.id),
    lines: Array.isArray(row.lines) ? row.lines : [],
    method: row.method || 'cash',
    discountId: row.discountId ?? '',
    promotionId: row.promotionId ?? '',
    promoCodeInput: row.promoCodeInput ?? '',
    promoCodeAppliedId: row.promoCodeAppliedId ?? null,
    suppressAutoPromo: Boolean(row.suppressAutoPromo),
    channelCode: row.channelCode || 'pos',
    payAmount: row.payAmount ?? '',
    splitPay: Boolean(row.splitPay),
    tenders: Array.isArray(row.tenders) ? row.tenders : [],
  }
}

export function cartToHoldLines(
  cart: CartLine[],
  priceOf: (product: Product) => number = (product) => product.sell_price,
): PosHoldLine[] {
  return cart.map((line) => ({
    product_id: line.product.id,
    qty: line.qty,
    promo_free_qty: line.promo_free_qty ?? 0,
    name: line.product.name,
    sku: line.product.sku,
    sell_price: priceOf(line.product),
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

/** List holds from server (outlet-shared). Falls back to local cache offline. */
export async function listPosHolds(scope: PosHoldScope): Promise<PosHoldSnapshot[]> {
  try {
    const { data } = await api.get<ApiOk<PosHoldSnapshot[]>>('/pos/holds', { silent: true })
    const rows = (data.data ?? []).map(normalizeHold)
    writePosHolds(scope, rows)
    return rows
  } catch {
    return readPosHolds(scope).map(normalizeHold)
  }
}

export async function savePosHold(
  scope: PosHoldScope,
  hold: Omit<PosHoldSnapshot, 'id' | 'savedAt'> & { id?: string; savedAt?: string },
): Promise<PosHoldSnapshot> {
  const localId = hold.id ?? crypto.randomUUID()
  const local: PosHoldSnapshot = normalizeHold({
    ...hold,
    id: localId,
    savedAt: hold.savedAt ?? new Date().toISOString(),
  })

  try {
    const { data } = await api.post<ApiOk<PosHoldSnapshot>>('/pos/holds', {
      uuid: localId,
      label: local.label,
      lines: local.lines,
      method: local.method,
      discountId: local.discountId,
      promotionId: local.promotionId,
      promoCodeInput: local.promoCodeInput,
      promoCodeAppliedId: local.promoCodeAppliedId,
      suppressAutoPromo: local.suppressAutoPromo,
      channelCode: local.channelCode,
      payAmount: local.payAmount,
      splitPay: local.splitPay,
      tenders: local.tenders,
    })
    const saved = normalizeHold(data.data)
    const cached = [saved, ...readPosHolds(scope).filter((item) => item.id !== saved.id)]
    writePosHolds(scope, cached)
    return saved
  } catch {
    const holds = [local, ...readPosHolds(scope).filter((item) => item.id !== local.id)]
    writePosHolds(scope, holds)
    return local
  }
}

export async function deletePosHold(scope: PosHoldScope, id: string): Promise<void> {
  try {
    await api.delete(`/pos/holds/${encodeURIComponent(id)}`)
  } catch {
    // Still drop from local cache so UI stays consistent offline.
  }
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
