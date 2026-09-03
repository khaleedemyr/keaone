import type { Modules } from '../types'
import type { MsgKey } from '../i18n'

export type ModuleKey = keyof Modules

export const MODULE_KEYS: ModuleKey[] = [
  'pos',
  'stock',
  'invoice',
  'purchase',
  'work_order',
  'promotions',
  'choices',
]

export const MODULE_LABELS: Record<ModuleKey, MsgKey> = {
  pos: 'modPos',
  stock: 'modStock',
  invoice: 'modInvoice',
  purchase: 'modPurchase',
  work_order: 'modWorkOrder',
  promotions: 'modPromotions',
  choices: 'modChoices',
}

export const DEFAULT_MODULES: Modules = {
  pos: true,
  stock: true,
  invoice: true,
  purchase: false,
  work_order: false,
  promotions: true,
  choices: true,
}

/** Master menu section → product module (null = always available). */
export function moduleForMenu(menu: string): ModuleKey | null {
  if (menu === 'promotions') return 'promotions'
  if (menu === 'choicetypes' || menu === 'choices') return 'choices'
  if (menu === 'warehouses' || menu === 'stock' || menu === 'stockcard' || menu === 'stocksettings' || menu === 'stocktransfers' || menu === 'stockopnames' || menu === 'stockadjustments' || menu === 'stockwaste' || menu === 'stockproduction' || menu === 'stockvaluation') return 'stock'
  if (
    menu === 'purchaserequisitions' ||
    menu === 'purchaseorders' ||
    menu === 'goodsreceipts' ||
    menu === 'purchasereturns' ||
    menu === 'vendoradjustmentnotes' ||
    menu === 'deliveryschedules' ||
    menu === 'vendorinvoices' ||
    menu === 'matchexceptions' ||
    menu === 'vendorpaymentbatches' ||
    menu === 'vendorprepayments' ||
    menu === 'vendorwithholding' ||
    menu === 'glaccounts' ||
    menu === 'gljournals' ||
    menu === 'procurementbudgets' ||
    menu === 'procurementcontracts' ||
    menu === 'procurementplans' ||
    menu === 'fixedassets' ||
    menu === 'rfqs' ||
    menu === 'supplierpricelists' ||
    menu === 'procurementdashboard' ||
    menu === 'procurementreports' ||
    menu === 'purchasesettings'
  ) {
    return 'purchase'
  }
  return null
}
