import { lazy, useState } from 'react'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useI18n } from '../i18n'
import { AppNavShell } from '../desktop/AppNavShell'

type Section = 'users' | 'roles' | 'logs'

const ActivityLogs = lazy(() => import('../pages/admin/ActivityLogs'))
const PlatformRoles = lazy(() => import('../pages/platform/Roles'))
const PlatformUsers = lazy(() => import('../pages/platform/Users'))

export default function PlatformAdminApp() {
  const { t } = useI18n()
  const { can } = useAccess()
  const allItems: { id: Section; label: string }[] = [
    { id: 'users', label: t('navUsers') },
    { id: 'roles', label: t('navRoles') },
    { id: 'logs', label: t('navLogs') },
  ]
  const items = allItems.filter((item) => can(item.id === 'users' ? 'operators' : item.id))
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
      {current === 'users' ? <PlatformUsers /> : null}
      {current === 'roles' ? <PlatformRoles /> : null}
      {current === 'logs' ? <ActivityLogs endpoint="/platform/activity-logs" showCompany /> : null}
    </AppNavShell>
  )
}
