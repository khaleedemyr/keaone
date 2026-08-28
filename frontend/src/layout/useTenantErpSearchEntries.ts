import { useMemo } from 'react'
import { useAccess } from '../access'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import type { AppId } from '../desktop/DesktopContext'
import { buildErpSearchEntries } from './erpNavSearch'

export function useTenantErpSearchEntries(apps: AppId[], titles: Partial<Record<AppId, string>>) {
  const { t } = useI18n()
  const { can, hasModule } = useAccess()
  const { me } = useAuth()

  return useMemo(
    () => buildErpSearchEntries(apps, titles, t, can, hasModule, me?.settings ?? null),
    [apps, titles, t, can, hasModule, me?.settings],
  )
}
