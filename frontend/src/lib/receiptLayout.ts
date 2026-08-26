import type { ReceiptPayload } from '../types'

export type ReceiptAlign = 'left' | 'center' | 'right'
export type ReceiptSize = 'sm' | 'md' | 'lg'
export type ReceiptBlockKind =
  | 'logo'
  | 'company'
  | 'outlet'
  | 'address'
  | 'phone'
  | 'divider'
  | 'number'
  | 'datetime'
  | 'cashier'
  | 'channel'
  | 'items'
  | 'totals'
  | 'payments'
  | 'footer'
  | 'text'
  | 'spacer'

export type ReceiptBlock = {
  id: string
  kind: ReceiptBlockKind
  enabled: boolean
  align: ReceiptAlign
  size: ReceiptSize
  bold: boolean
  text: string | null
}

export type ReceiptLayout = {
  width: number
  blocks: ReceiptBlock[]
}

export const RECEIPT_KINDS: ReceiptBlockKind[] = [
  'logo',
  'company',
  'outlet',
  'address',
  'phone',
  'divider',
  'number',
  'datetime',
  'cashier',
  'channel',
  'items',
  'totals',
  'payments',
  'footer',
  'text',
  'spacer',
]

const CUSTOM_KINDS = new Set<ReceiptBlockKind>(['text', 'divider', 'spacer'])

function block(
  id: string,
  kind: ReceiptBlockKind,
  enabled: boolean,
  align: ReceiptAlign = 'left',
  size: ReceiptSize = 'md',
  bold = false,
  text: string | null = null,
): ReceiptBlock {
  return { id, kind, enabled, align, size, bold, text }
}

export function defaultReceiptLayout(settings?: { receipt_width?: number; receipt_footer?: string }): ReceiptLayout {
  const footer = settings?.receipt_footer || 'Terima kasih'
  const width = settings?.receipt_width === 58 ? 58 : 80
  return {
    width,
    blocks: [
      block('logo', 'logo', true, 'center', 'md'),
      block('company', 'company', true, 'center', 'lg', true),
      block('outlet', 'outlet', true, 'center', 'sm'),
      block('address', 'address', true, 'center', 'sm'),
      block('phone', 'phone', true, 'center', 'sm'),
      block('div-1', 'divider', true),
      block('number', 'number', true, 'left', 'md', true),
      block('datetime', 'datetime', true, 'left', 'sm'),
      block('cashier', 'cashier', true, 'left', 'sm'),
      block('channel', 'channel', false, 'left', 'sm'),
      block('div-2', 'divider', true),
      block('items', 'items', true),
      block('div-3', 'divider', true),
      block('totals', 'totals', true),
      block('payments', 'payments', false),
      block('footer', 'footer', true, 'center', 'sm', false, footer),
    ],
  }
}

export function normalizeReceiptLayout(
  layout: ReceiptLayout | null | undefined,
  settings?: { receipt_width?: number; receipt_footer?: string },
): ReceiptLayout {
  const base = defaultReceiptLayout(settings)
  if (!layout || !Array.isArray(layout.blocks) || layout.blocks.length === 0) return base
  const width = Math.max(58, Math.min(112, Number(layout.width) || base.width))
  let blocks: ReceiptBlock[] = []
  for (const row of layout.blocks.slice(0, 40)) {
    if (!RECEIPT_KINDS.includes(row.kind)) continue
    blocks.push({
      id: String(row.id || row.kind).slice(0, 40),
      kind: row.kind,
      enabled: row.enabled !== false,
      align: row.align === 'center' || row.align === 'right' ? row.align : 'left',
      size: row.size === 'sm' || row.size === 'lg' ? row.size : 'md',
      bold: Boolean(row.bold),
      text: row.text == null ? null : String(row.text).slice(0, 500),
    })
  }
  if (!blocks.some((row) => row.kind === 'logo')) {
    blocks = [block('logo', 'logo', true, 'center', 'md'), ...blocks].slice(0, 40)
  }
  return { width, blocks: blocks.length ? blocks : base.blocks }
}

export function isCustomBlock(block: ReceiptBlock) {
  return CUSTOM_KINDS.has(block.kind) && !['div-1', 'div-2', 'div-3', 'footer'].includes(block.id)
}

export function newReceiptBlock(kind: 'text' | 'divider' | 'spacer'): ReceiptBlock {
  const id = `custom-${kind}-${Math.random().toString(36).slice(2, 8)}`
  if (kind === 'text') return block(id, 'text', true, 'center', 'sm', false, '')
  if (kind === 'spacer') return block(id, 'spacer', true)
  return block(id, 'divider', true)
}

export function sampleReceiptPayload(input: {
  company: string
  outlet?: string | null
  address?: string | null
  phone?: string | null
  logo?: string | null
  cashier?: string | null
  footer: string
  width: number
  layout: ReceiptLayout
}): ReceiptPayload {
  return {
    company: {
      name: input.company,
      phone: input.phone ?? null,
      address: input.address ?? null,
      logo: input.logo ?? null,
    },
    outlet: input.outlet ? { id: 1, name: input.outlet, address: null, is_default: true, is_active: true } : null,
    cashier: input.cashier ?? 'Kasir',
    footer: input.footer,
    receipt_width: input.width,
    layout: input.layout,
    sale: {
      id: 0,
      number: 'POS-0001',
      client_uuid: '',
      status: 'paid',
      channel: 'pos',
      sold_at: new Date().toISOString(),
      contact: null,
      cashier: input.cashier ? { id: 1, name: input.cashier } : null,
      outlet: input.outlet ? { id: 1, name: input.outlet, address: null, is_default: true, is_active: true } : null,
      subtotal: 35000,
      discount: 0,
      tax: 0,
      total: 35000,
      paid_amount: 50000,
      change_amount: 15000,
      note: null,
      items: [
        { id: 1, product_id: 1, name: 'Air mineral', qty: 2, unit: 'pcs', price: 5000, discount: 0, tax: 0, total: 10000 },
        { id: 2, product_id: 2, name: 'Kopi sachet', qty: 1, unit: 'pcs', price: 25000, discount: 0, tax: 0, total: 25000 },
      ],
      payments: [{ id: 1, method: 'cash', amount: 50000, paid_at: new Date().toISOString(), client_uuid: null, note: null }],
    },
  }
}
