import { lazy, useState } from 'react'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useI18n } from '../i18n'
import { AppNavShell } from '../desktop/AppNavShell'

type Section = 'plans' | 'invoices' | 'types'

const PlatformBusinessTypes = lazy(() => import('../pages/platform/BusinessTypes'))
const PlatformInvoices = lazy(() => import('../pages/platform/Invoices'))
const PlatformPlans = lazy(() => import('../pages/platform/Plans'))

export default function PlatformBillingApp() {
  const { t } = useI18n()
  const { can } = useAccess()
  const allItems: { id: Section; label: string }[] = [
    { id: 'plans', label: t('navPlans') },
    { id: 'invoices', label: t('invoices') },
    { id: 'types', label: t('navBusinessTypes') },
  ]
  const items = allItems.filter((item) => can(item.id === 'types' ? 'catalog' : 'billing'))
  const [section, setSection] = useState<Section | null>(null)
  const current = section && items.some((item) => item.id === section) ? section : null

  return (
    <AppNavShell
      items={items}
      current={current}
      onSelect={(id) => {
        setSection(id)
        logActivity('open_section', id)
      }}
    >
      {current === 'plans' ? <PlatformPlans /> : null}
      {current === 'invoices' ? <PlatformInvoices /> : null}
      {current === 'types' ? <PlatformBusinessTypes /> : null}
    </AppNavShell>
  )
}
