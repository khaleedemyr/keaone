import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAccess } from '../access'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import type { AppId } from '../desktop/DesktopContext'
import type { ApiOk } from '../types'
import type { StorefrontAdmin, StorefrontSiteKind } from '../pages/storefront/types'
import { buildErpSearchEntries } from './erpNavSearch'

export function useTenantErpSearchEntries(apps: AppId[], titles: Partial<Record<AppId, string>>) {
  const { t } = useI18n()
  const { can, hasModule } = useAccess()
  const { me } = useAuth()
  const [siteKind, setSiteKind] = useState<StorefrontSiteKind | null>(null)
  const [hasNews, setHasNews] = useState(false)

  useEffect(() => {
    if (!hasModule('storefront')) {
      setSiteKind(null)
      setHasNews(false)
      return
    }
    void (async () => {
      try {
        const { data } = await api.get<ApiOk<StorefrontAdmin>>('/storefront', { silent: true })
        setSiteKind(data.data.site_kind)
        setHasNews(Boolean(data.data.has_news))
      } catch {
        setSiteKind(null)
        setHasNews(false)
      }
    })()
  }, [hasModule])

  return useMemo(
    () => buildErpSearchEntries(apps, titles, t, can, hasModule, me?.settings ?? null, siteKind, hasNews),
    [apps, titles, t, can, hasModule, me?.settings, siteKind, hasNews],
  )
}
