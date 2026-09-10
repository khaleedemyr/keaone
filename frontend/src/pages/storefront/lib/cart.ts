export type StorefrontSelectedOption = {
  attribute_id: number
  attribute_name: string
  option_id: number
  option_name: string
  extra_price?: number
  image_url?: string | null
}

export type StorefrontCartLine = {
  product_id: number
  /** Stable key so same product with different options stays separate. */
  line_key: string
  name: string
  price: number
  qty: number
  image_url?: string | null
  available_qty?: number | null
  selected_options?: StorefrontSelectedOption[]
  variant_label?: string | null
}

const PREFIX = 'kea_storefront_cart:'

function storageKey(scope: string): string {
  return PREFIX + (scope || 'preview')
}

export function variantLineKey(
  productId: number,
  selectedOptions?: Array<{ attribute_id: number; option_id: number }> | null,
): string {
  if (!selectedOptions || selectedOptions.length === 0) return String(productId)
  const parts = [...selectedOptions]
    .map((row) => `${row.attribute_id}:${row.option_id}`)
    .sort()
  return `${productId}|${parts.join(',')}`
}

export function readCart(scope: string): StorefrontCartLine[] {
  try {
    const raw = localStorage.getItem(storageKey(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row) => row && typeof row.product_id === 'number' && row.product_id > 0)
      .map((row) => {
        const selected_options = Array.isArray(row.selected_options)
          ? row.selected_options
              .filter((opt: unknown) => opt && typeof opt === 'object')
              .map((opt: Record<string, unknown>) => ({
                attribute_id: Number(opt.attribute_id) || 0,
                attribute_name: String(opt.attribute_name || ''),
                option_id: Number(opt.option_id) || 0,
                option_name: String(opt.option_name || ''),
                extra_price: Math.max(0, Number(opt.extra_price) || 0),
                image_url: typeof opt.image_url === 'string' ? opt.image_url : null,
              }))
              .filter((opt: StorefrontSelectedOption) => opt.attribute_id > 0 && opt.option_id > 0)
          : []
        const product_id = Number(row.product_id)
        return {
          product_id,
          line_key: typeof row.line_key === 'string' && row.line_key
            ? row.line_key
            : variantLineKey(product_id, selected_options),
          name: String(row.name || 'Produk'),
          price: Math.max(0, Number(row.price) || 0),
          qty: Math.max(1, Math.min(999, Number(row.qty) || 1)),
          image_url: typeof row.image_url === 'string' ? row.image_url : null,
          available_qty:
            row.available_qty == null || row.available_qty === ''
              ? null
              : Math.max(0, Number(row.available_qty) || 0),
          selected_options,
          variant_label: typeof row.variant_label === 'string' ? row.variant_label : null,
        }
      })
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
  next: Omit<StorefrontCartLine, 'qty' | 'line_key'> & { qty?: number; line_key?: string },
): StorefrontCartLine[] {
  if (next.available_qty != null && next.available_qty <= 0) {
    return lines
  }
  const qty = Math.max(1, next.qty ?? 1)
  const line_key = next.line_key || variantLineKey(next.product_id, next.selected_options)
  const idx = lines.findIndex((line) => line.line_key === line_key)
  if (idx < 0) {
    return [...lines, { ...next, line_key, qty }]
  }
  const copy = [...lines]
  const current = copy[idx]
  const max = current.available_qty == null ? 999 : current.available_qty
  if (max <= 0) return lines
  copy[idx] = { ...current, ...next, line_key, qty: Math.min(max, current.qty + qty) }
  return copy
}

export function setCartLineQty(lines: StorefrontCartLine[], lineKey: string, qty: number): StorefrontCartLine[] {
  if (qty <= 0) return lines.filter((line) => line.line_key !== lineKey)
  return lines.map((line) => {
    if (line.line_key !== lineKey) return line
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
