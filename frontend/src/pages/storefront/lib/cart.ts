export type StorefrontCartLine = {
  product_id: number
  name: string
  price: number
  qty: number
  image_url?: string | null
  available_qty?: number | null
}

const PREFIX = 'kea_storefront_cart:'

function storageKey(scope: string): string {
  return PREFIX + (scope || 'preview')
}

export function readCart(scope: string): StorefrontCartLine[] {
  try {
    const raw = localStorage.getItem(storageKey(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row) => row && typeof row.product_id === 'number' && row.product_id > 0)
      .map((row) => ({
        product_id: Number(row.product_id),
        name: String(row.name || 'Produk'),
        price: Math.max(0, Number(row.price) || 0),
        qty: Math.max(1, Math.min(999, Number(row.qty) || 1)),
        image_url: typeof row.image_url === 'string' ? row.image_url : null,
        available_qty:
          row.available_qty == null || row.available_qty === ''
            ? null
            : Math.max(0, Number(row.available_qty) || 0),
      }))
  } catch {
    return []
  }
}

export function writeCart(scope: string, lines: StorefrontCartLine[]): void {
  localStorage.setItem(storageKey(scope), JSON.stringify(lines))
}

export function cartCount(lines: StorefrontCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0)
}

export function cartSubtotal(lines: StorefrontCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0)
}

export function upsertCartLine(
  lines: StorefrontCartLine[],
  next: Omit<StorefrontCartLine, 'qty'> & { qty?: number },
): StorefrontCartLine[] {
  if (next.available_qty != null && next.available_qty <= 0) {
    return lines
  }
  const qty = Math.max(1, next.qty ?? 1)
  const idx = lines.findIndex((line) => line.product_id === next.product_id)
  if (idx < 0) {
    return [...lines, { ...next, qty }]
  }
  const copy = [...lines]
  const current = copy[idx]
  const max = current.available_qty == null ? 999 : current.available_qty
  if (max <= 0) return lines
  copy[idx] = { ...current, ...next, qty: Math.min(max, current.qty + qty) }
  return copy
}

export function setCartLineQty(lines: StorefrontCartLine[], productId: number, qty: number): StorefrontCartLine[] {
  if (qty <= 0) return lines.filter((line) => line.product_id !== productId)
  return lines.map((line) => {
    if (line.product_id !== productId) return line
    const max = line.available_qty == null ? 999 : line.available_qty
    return { ...line, qty: Math.min(max, Math.max(1, qty)) }
  })
}

export function newClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
