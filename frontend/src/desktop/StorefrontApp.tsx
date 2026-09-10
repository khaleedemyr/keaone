import { lazy, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useI18n, type MsgKey } from '../i18n'
import type { ApiOk } from '../types'
import type { StorefrontAdmin, StorefrontSiteKind } from '../pages/storefront/types'
import StorefrontHub from '../pages/storefront/StorefrontHub'
import { AppNavShell } from './AppNavShell'

type Section = 'storefrontsetup' | 'storefrontdomain' | 'storefrontproducts' | 'storefrontorders'

const StorefrontSetup = lazy(() => import('../pages/storefront/StorefrontSetup'))
const StorefrontDomain = lazy(() => import('../pages/storefront/StorefrontDomain'))
const StorefrontProducts = lazy(() => import('../pages/storefront/StorefrontProducts'))
const StorefrontOrders = lazy(() => import('../pages/storefront/StorefrontOrders'))

export const STOREFRONT_NAV_ITEMS: {
  id: Section
  label: MsgKey
  menu: string
  /** Only show when storefront site_kind is shop */
  shopOnly?: boolean
}[] = [
  { id: 'storefrontsetup', label: 'navStorefrontSetup', menu: 'storefrontsetup' },
  { id: 'storefrontdomain', label: 'navStorefrontDomain', menu: 'storefrontdomain' },
  { id: 'storefrontproducts', label: 'navStorefrontProducts', menu: 'storefrontproducts', shopOnly: true },
  { id: 'storefrontorders', label: 'navStorefrontOrders', menu: 'storefrontorders', shopOnly: true },
]

export default function StorefrontApp() {
  const { t } = useI18n()
  const { can } = useAccess()
  const [siteKind, setSiteKind] = useState<StorefrontSiteKind | null>(null)
  const [section, setSection] = useState<Section | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<ApiOk<StorefrontAdmin>>('/storefront', { silent: true })
        setSiteKind(data.data.site_kind)
      } catch {
        setSiteKind(null)
      }
    })()
  }, [])

  const visibleNav = useMemo(
    () =>
      STOREFRONT_NAV_ITEMS.filter((item) => {
        if (!can(item.menu, 'view')) return false
        if (item.shopOnly && siteKind === 'landing') return false
        return true
      }),
    [can, siteKind],
  )
  const items = visibleNav.map((item) => ({ id: item.id, label: t(item.label) }))
  const current = section && items.some((item) => item.id === section) ? section : null

  function openSection(id: Section) {
    setSection(id)
    logActivity('open_section', `storefront:${id}`)
  }

  if (items.length === 0) return null

  return (
    <AppNavShell
      items={items}
      current={current}
      onSelect={(id) => openSection(id)}
      hub={<StorefrontHub siteKind={siteKind} menuItems={items} onOpen={openSection} />}
    >
      {current === 'storefrontsetup' ? <StorefrontSetup /> : null}
      {current === 'storefrontdomain' ? <StorefrontDomain /> : null}
      {current === 'storefrontproducts' ? <StorefrontProducts /> : null}
      {current === 'storefrontorders' ? <StorefrontOrders /> : null}
    </AppNavShell>
  )
}
