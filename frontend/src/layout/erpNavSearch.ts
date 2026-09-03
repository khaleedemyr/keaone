import type { AppId } from '../desktop/DesktopContext'
import { MASTER_NAV_GROUPS } from '../desktop/MasterApp'
import { INVENTORY_NAV_ITEMS } from '../desktop/InventoryApp'
import { HR_NAV_ITEMS } from '../desktop/HrApp'
import { SALES_NAV_ITEMS } from '../desktop/SalesApp'
import { PROCUREMENT_NAV_GROUPS } from '../desktop/PurchaseApp'
import type { MsgKey } from '../i18n'
import { moduleForMenu } from '../lib/modules'
import type { Settings, UserPreferences } from '../types'

export type ErpSearchEntry = {
  id: string
  appId: AppId
  sectionId: string | null
  appLabel: string
  label: string
  breadcrumb: string
  searchText: string
}

type CanFn = (menu: string, action?: 'view' | 'create' | 'edit' | 'delete') => boolean
type HasModuleFn = (module: string) => boolean

const ADMIN_SECTIONS: { id: string; label: MsgKey }[] = [
  { id: 'roles', label: 'navRoles' },
  { id: 'company', label: 'navCompany' },
  { id: 'outlets', label: 'navOutlets' },
  { id: 'modules', label: 'navModules' },
  { id: 'ops', label: 'navOps' },
  { id: 'billing', label: 'navBilling' },
  { id: 'logs', label: 'navLogs' },
]

function usesCafeTables(mode?: Settings['pos_mode']) {
  return mode === 'restaurant'
}

function pushEntry(
  list: ErpSearchEntry[],
  appId: AppId,
  appLabel: string,
  sectionId: string | null,
  label: string,
  groupLabel?: string,
) {
  const breadcrumb = sectionId ? `${appLabel} · ${label}` : appLabel
  list.push({
    id: sectionId ? `${appId}:${sectionId}` : `${appId}:__root__`,
    appId,
    sectionId,
    appLabel,
    label: sectionId ? label : appLabel,
    breadcrumb,
    searchText: `${appLabel} ${groupLabel ?? ''} ${label}`.toLowerCase(),
  })
}

export function buildErpSearchEntries(
  apps: AppId[],
  titles: Partial<Record<AppId, string>>,
  t: (key: MsgKey) => string,
  can: CanFn,
  hasModule: HasModuleFn,
  settings?: Settings | null,
): ErpSearchEntry[] {
  const entries: ErpSearchEntry[] = []

  for (const appId of apps) {
    const appLabel = titles[appId] ?? appId

    if (appId === 'beranda' || appId === 'insight' || appId === 'pos' || appId === 'approvals') {
      pushEntry(entries, appId, appLabel, null, appLabel)
      continue
    }

    if (appId === 'master') {
      for (const group of MASTER_NAV_GROUPS) {
        const groupLabel = t(group.label)
        for (const item of group.items) {
          if (!can(item.id, 'view')) continue
          const mod = moduleForMenu(item.id)
          if (mod && !hasModule(mod)) continue
          pushEntry(entries, appId, appLabel, item.id, t(item.label), groupLabel)
        }
      }
      continue
    }

    if (appId === 'inventory') {
      for (const item of INVENTORY_NAV_ITEMS) {
        if (!can(item.menu, 'view')) continue
        const mod = moduleForMenu(item.menu)
        if (mod && !hasModule(mod)) continue
        pushEntry(entries, appId, appLabel, item.id, t(item.label))
      }
      continue
    }

    if (appId === 'sales') {
      for (const item of SALES_NAV_ITEMS) {
        if (!can(item.menu, 'view')) continue
        pushEntry(entries, appId, appLabel, item.id, t(item.label))
      }
      continue
    }

    if (appId === 'purchase') {
      const flow = (settings?.purchase_flow ?? 'direct') as 'strict_pr_po_gr' | 'po_gr' | 'direct'
      const returnEnabled = settings?.return_enabled !== false
      const adjustmentEnabled = settings?.vendor_adjustment_enabled !== false
      const deliveryEnabled = settings?.delivery_schedule_enabled !== false
      const rfqEnabled = settings?.procurement_rfq_enabled === true
      const priceListEnabled = settings?.procurement_vendor_price_list_enabled === true
      const ctx = { flow, returnEnabled, adjustmentEnabled, deliveryEnabled, rfqEnabled, priceListEnabled }
      for (const group of PROCUREMENT_NAV_GROUPS) {
        const groupLabel = t(group.label)
        for (const item of group.items) {
          if (item.visible && !item.visible(ctx)) continue
          if (!can(item.menu, 'view')) continue
          pushEntry(entries, appId, appLabel, item.id, t(item.label), groupLabel)
        }
      }
      continue
    }

    if (appId === 'hr') {
      for (const item of HR_NAV_ITEMS) {
        if (!can(item.menu, 'view')) continue
        pushEntry(entries, appId, appLabel, item.id, t(item.label))
      }
      continue
    }

    if (appId === 'admin') {
      for (const item of ADMIN_SECTIONS) {
        if (!can(item.id, 'view')) continue
        pushEntry(entries, appId, appLabel, item.id, t(item.label))
      }
      continue
    }

    if (appId === 'settings') {
      if (can('settings')) pushEntry(entries, appId, appLabel, 'account', t('navProfile'))
      if (can('possettings')) pushEntry(entries, appId, appLabel, 'possettings', t('navPosSettings'))
      if (usesCafeTables(settings?.pos_mode) && can('cafetables')) {
        pushEntry(entries, appId, appLabel, 'cafetables', t('navCafeTables'))
      }
      continue
    }

    pushEntry(entries, appId, appLabel, null, appLabel)
  }

  return entries
}

export function filterErpSearchEntries(entries: ErpSearchEntry[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return entries.slice(0, 12)
  return entries.filter((entry) => entry.searchText.includes(q)).slice(0, 16)
}
