import type { Product, ProductUnitLevel } from '../../types'

export type PurchaseLineDraft = {
  key: string
  product_id: number
  name: string
  /** Receive qty (GR) or line qty (PR/PO). */
  qty: number
  /** PO line ordered qty — read-only when receiving from PO. */
  po_qty?: number
  /** Max receivable on this PO line (remaining open qty). */
  po_qty_remaining?: number
  unit: string
  unit_level: ProductUnitLevel
  unit_cost: number
  purchase_order_item_id?: number
  purchase_requisition_item_id?: number
}

export type LineCol = 'product' | 'qty' | 'unit' | 'cost'

export function purchaseLineUuid() {
  return crypto.randomUUID()
}

export function emptyPurchaseLine(): PurchaseLineDraft {
  return {
    key: purchaseLineUuid(),
    product_id: 0,
    name: '',
    qty: 1,
    unit: '',
    unit_level: 'small',
    unit_cost: 0,
  }
}

export function ensureTrailingEmptyPurchaseLine(rows: PurchaseLineDraft[]) {
  if (rows.length === 0) return [emptyPurchaseLine()]
  const last = rows[rows.length - 1]
  if (last.product_id > 0) return [...rows, emptyPurchaseLine()]
  return rows
}

export function productUnitOptions(product?: Product | null) {
  if (product?.units && product.units.length > 0) {
    return product.units.map((u) => ({
      level: u.level,
      label: u.label,
      factor_to_base: u.factor_to_base,
    }))
  }
  const label = product?.unit || 'pcs'
  return [{ level: 'small' as const, label, factor_to_base: 1 }]
}

export function parseQtyInput(raw: string) {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits === '') return 0
  return Number.parseInt(digits, 10) || 0
}

export function parseCostInput(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (cleaned === '' || cleaned === '.') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

export function defaultUnitPick(product: Product) {
  const options = productUnitOptions(product)
  const small = options.find((o) => o.level === 'small') ?? options[0]
  return { unit: small.label, unit_level: small.level as ProductUnitLevel }
}

export function focusLineCell(rowKey: string, col: LineCol) {
  window.requestAnimationFrame(() => {
    const root = document.querySelector(`[data-line="${rowKey}"][data-col="${col}"]`)
    if (!root) return
    const target =
      (root as HTMLElement).matches('input,select,button')
        ? (root as HTMLElement)
        : (root.querySelector('input,select,button') as HTMLElement | null)
    target?.focus()
  })
}

export function findProductByScan(query: string, products: Product[]) {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  return products.find(
    (p) =>
      p.barcode?.toLowerCase() === q ||
      p.sku?.toLowerCase() === q ||
      String(p.id) === q,
  )
}

export function productPurchaseCost(product?: Product | null) {
  if (product?.suggested_unit_cost && product.suggested_unit_cost > 0) {
    return product.suggested_unit_cost
  }
  return product?.cost_price ?? 0
}

export function resolveProductFromScan(
  code: string,
  products: Product[],
  productOptions: Array<{ value: string; label: string; keywords?: string }>,
) {
  const exact = findProductByScan(code, products)
  if (exact) return exact
  const q = code.trim().toLowerCase()
  if (!q) return undefined
  const match = productOptions.find((item) => {
    const hay = `${item.label} ${item.keywords ?? ''}`.toLowerCase()
    return hay.includes(q)
  })
  if (!match) return undefined
  return products.find((p) => String(p.id) === match.value)
}

export function buildProductOptions(products: Product[]) {
  return products.map((p) => ({
    value: String(p.id),
    label: p.name,
    keywords: `${p.sku ?? ''} ${p.barcode ?? ''}`,
  }))
}
