import { useMemo } from 'react'
import { useAccess } from '../access'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import { SALES_REPORT_MENUS } from './SalesApp'
import type { AppId, TenantAppId } from './DesktopContext'

export function useTenantApps() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can, canAny } = useAccess()

  const canAdmin =
    me?.user.is_platform ||
    canAny(['roles', 'company', 'outlets', 'modules', 'ops', 'billing', 'logs'])

  const apps: TenantAppId[] = useMemo(
    () => [
      'beranda',
      ...(can('insight') ? (['insight'] as TenantAppId[]) : []),
      ...(me?.modules?.pos && can('pos') ? (['pos'] as TenantAppId[]) : []),
      ...(canAny(
        [
          'products',
          'categories',
          'subcategories',
          'units',
          'itemtypes',
          'pricechannels',
          'discounts',
          'promotions',
          'customfields',
          'choicetypes',
          'choices',
          'warehouses',
          'suppliers',
          'customers',
          'stock',
          'stockcard',
        ],
        'view',
      )
        ? (['master'] as TenantAppId[])
        : []),
      ...(can('sales') || canAny([...SALES_REPORT_MENUS], 'view') ? (['sales'] as TenantAppId[]) : []),
      ...(me?.modules?.purchase &&
      canAny(['procurementdashboard', 'procurementreports', 'purchaserequisitions', 'purchaseorders', 'goodsreceipts', 'purchasereturns', 'vendoradjustmentnotes', 'deliveryschedules', 'vendorinvoices', 'matchexceptions', 'vendorpaymentbatches', 'vendorprepayments', 'purchasesettings'], 'view')
        ? (['purchase'] as TenantAppId[])
        : []),
      ...(canAny(['departments', 'positions', 'joblevels', 'users'], 'view') ? (['hr'] as TenantAppId[]) : []),
      ...(can('approvals', 'view') ? (['approvals'] as TenantAppId[]) : []),
      ...(canAdmin ? (['admin'] as TenantAppId[]) : []),
      ...(canAny(['settings', 'possettings', 'cafetables']) ? (['settings'] as TenantAppId[]) : []),
    ],
    [can, canAny, canAdmin, me?.modules?.pos, me?.modules?.purchase],
  )

  const titles = useMemo<Partial<Record<AppId, string>>>(
    () => ({
      beranda: t('appBeranda'),
      insight: t('appInsight'),
      pos: t('appPos'),
      master: t('appMaster'),
      sales: t('appSales'),
      purchase: t('appProcurement'),
      hr: t('appHr'),
      approvals: t('appApprovals'),
      admin: t('appAdmin'),
      settings: t('appSettings'),
    }),
    [t],
  )

  return { apps, titles }
}
