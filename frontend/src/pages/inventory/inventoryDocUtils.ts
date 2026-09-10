import type { MsgKey } from '../../i18n'

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export { uuid as inventoryDocUuid }

const STOCK_MOVE_TYPE_KEYS: Record<string, MsgKey> = {
  transfer_out: 'stockMoveTransferOut',
  transfer_in: 'stockMoveTransferIn',
  transfer_void_out: 'stockMoveTransferVoidOut',
  transfer_void_in: 'stockMoveTransferVoidIn',
  opname: 'stockMoveOpname',
  adjustment: 'stockMoveAdjustment',
  production_issue: 'stockMoveProductionIssue',
  production_receipt: 'stockMoveProductionReceipt',
  production_void_issue: 'stockMoveProductionVoidIssue',
  production_void_receipt: 'stockMoveProductionVoidReceipt',
  purchase: 'stockMovePurchase',
  gr_reversal: 'stockMoveGrReversal',
  purchase_return: 'stockMovePurchaseReturn',
  sale: 'stockMoveSale',
  cancel: 'stockMoveSaleCancel',
}

const CLICKABLE_REF_TYPES = new Set([
  'stock_transfer',
  'stock_opname',
  'stock_adjustment',
  'stock_production',
  'goods_receipt',
  'purchase_return',
  'sale',
])

const ADJ_REASON_KEYS: Record<string, MsgKey> = {
  damage: 'stockAdjReasonDamage',
  loss: 'stockAdjReasonLoss',
  sample: 'stockAdjReasonSample',
  write_off: 'stockAdjReasonWriteOff',
  found: 'stockAdjReasonFound',
  other: 'stockAdjReasonOther',
  expired: 'stockAdjReasonExpired',
  overcook: 'stockAdjReasonOvercook',
  complimentary: 'stockAdjReasonComplimentary',
}

export function stockMovementTypeLabel(type: string, t: (key: MsgKey) => string): string {
  const key = STOCK_MOVE_TYPE_KEYS[type]
  if (key) return t(key)
  return type
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function isStockSourceClickable(refType: string | null | undefined, refId: number | null | undefined): boolean {
  return Boolean(refType && refId && CLICKABLE_REF_TYPES.has(refType))
}

export function inventoryDocStatusLabel(status: string, t: (key: MsgKey) => string): string {
  const map: Record<string, MsgKey> = {
    draft: 'purchaseStatusDraft',
    confirmed: 'purchaseStatusConfirmed',
    cancelled: 'purchaseStatusCancelled',
    shipped: 'stockStatusShipped',
    received: 'stockStatusReceived',
    voided: 'stockStatusVoided',
    submitted: 'purchaseStatusSubmitted',
    approved: 'purchaseStatusApproved',
    rejected: 'purchaseStatusRejected',
    ordered: 'purchaseStatusOrdered',
    partial: 'purchaseStatusPartial',
  }
  const key = map[status]
  return key ? t(key) : status
}

export function stockAdjReasonLabel(reason: string, t: (key: MsgKey) => string): string {
  const key = ADJ_REASON_KEYS[reason]
  return key ? t(key) : reason
}
