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
    canAny(['users', 'roles', 'company', 'outlets', 'modules', 'ops', 'billing', 'logs'])

  const apps: TenantAppId[] = useMemo(
    () => [
      ...(can('insight') ? (['insight'] as TenantAppId[]) : []),
      ...(can('chat') ? (['chat'] as TenantAppId[]) : []),
      ...(me?.modules.pos && can('pos') ? (['pos'] as TenantAppId[]) : []),
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
        ],
        'view',
      )
        ? (['master'] as TenantAppId[])
        : []),
      ...(can('sales') || canAny([...SALES_REPORT_MENUS], 'view') ? (['sales'] as TenantAppId[]) : []),
      ...(canAdmin ? (['admin'] as TenantAppId[]) : []),
      ...(canAny(['settings', 'possettings', 'cafetables']) ? (['settings'] as TenantAppId[]) : []),
    ],
    [can, canAny, canAdmin, me?.modules.pos],
  )

  const titles = useMemo<Partial<Record<AppId, string>>>(
    () => ({
      insight: t('appInsight'),
      chat: t('appChat'),
      pos: t('appPos'),
      master: t('appMaster'),
      sales: t('appSales'),
      admin: t('appAdmin'),
      settings: t('appSettings'),
    }),
    [t],
  )

  return { apps, titles }
}
