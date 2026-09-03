import type { Product } from '../types'

export type ProductScanOption = { value: string; label: string; keywords?: string }

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

export function resolveProductFromScan(code: string, products: Product[], productOptions: ProductScanOption[]) {
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

export function buildTrackableProductOptions(products: Product[]): ProductScanOption[] {
  return products
    .filter((p) => p.track_stock)
    .map((p) => ({
      value: String(p.id),
      label: p.sku ? `${p.name} (${p.sku})` : p.name,
      keywords: [p.sku, p.barcode].filter(Boolean).join(' '),
    }))
}

export function productVariantLabel(product: { name: string; sku?: string | null; barcode?: string | null }) {
  const bits = [product.name]
  if (product.sku) bits.push(product.sku)
  return bits.join(' · ')
}
