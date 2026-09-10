import type { Product, ProductUnitLevel } from '../../types'
import { productUnitOptions } from '../purchase/purchaseLineUtils'

export type InventoryUnitOption = {
  level: ProductUnitLevel
  label: string
  factor_to_base: number
}

/** Unit conversions saved on the product; falls back to its base unit. */
export function inventoryUnitOptions(product?: Product | null): InventoryUnitOption[] {
  return productUnitOptions(product).map((option) => ({
    level: option.level as ProductUnitLevel,
    label: option.label,
    factor_to_base: Math.max(1, option.factor_to_base),
  }))
}

export function unitFactor(product: Product | undefined | null, level: ProductUnitLevel): number {
  const picked = inventoryUnitOptions(product).find((option) => option.level === level)
  return Math.max(1, picked?.factor_to_base ?? 1)
}

export function unitLabel(product: Product | undefined | null, level: ProductUnitLevel): string {
  const options = inventoryUnitOptions(product)
  const picked = options.find((option) => option.level === level) ?? options[0]
  return picked?.label ?? product?.unit ?? 'pcs'
}

/** Base (smallest) unit label of a product. */
export function baseUnitLabel(product?: Product | null): string {
  const options = inventoryUnitOptions(product)
  const small = options.find((option) => option.level === 'small') ?? options[0]
  return small?.label ?? product?.unit ?? 'pcs'
}

export function toBaseQty(qty: number, factor: number): number {
  return qty * Math.max(1, factor)
}

/**
 * "2 box (24 pcs)" — the entered qty plus its base equivalent, and just
 * "24 pcs" when the line is already in base unit.
 */
export function formatUnitQty(
  qtyInput: number,
  unit: string | null | undefined,
  qtyBase: number,
  baseUnit: string | null | undefined,
  factor = 1,
): string {
  const label = unit || baseUnit || ''
  const head = `${qtyInput}${label ? ` ${label}` : ''}`
  if (Math.max(1, factor) <= 1) return head
  return `${head} (${qtyBase}${baseUnit ? ` ${baseUnit}` : ''})`
}
