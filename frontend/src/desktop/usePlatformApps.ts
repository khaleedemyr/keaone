import { useMemo } from 'react'
import { useI18n } from '../i18n'
import { usePlatformAccess } from '../platform/access'
import type { AppId, PlatformAppId } from './DesktopContext'

export function usePlatformApps() {
  const { t } = useI18n()
  const { canManage, canUsers, can } = usePlatformAccess()

  const apps: PlatformAppId[] = useMemo(
    () => [
      ...(can('overview') ? (['overview'] as PlatformAppId[]) : []),
      ...(can('tenants') ? (['tenants'] as PlatformAppId[]) : []),
      ...(canManage ? (['billing'] as PlatformAppId[]) : []),
      ...(can('blog') ? (['blog'] as PlatformAppId[]) : []),
      ...(canUsers ? (['admin'] as PlatformAppId[]) : []),
      ...(can('settings') ? (['settings'] as PlatformAppId[]) : []),
    ],
    [can, canManage, canUsers],
  )

  const titles = useMemo<Partial<Record<AppId, string>>>(
    () => ({
      overview: t('appOverview'),
      tenants: t('appTenants'),
      billing: t('appBilling'),
      blog: t('appBlog'),
      admin: t('appAdmin'),
      settings: t('appSettings'),
    }),
    [t],
  )

  return { apps, titles }
}
