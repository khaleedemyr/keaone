import { lazy, useState } from 'react'
import { useAccess } from '../access'
import { useI18n } from '../i18n'
import { logActivity } from '../api/activity'
import { AppNavShell } from './AppNavShell'

type Section = 'users' | 'roles' | 'company' | 'outlets' | 'modules' | 'ops' | 'billing' | 'logs'

const AdminBilling = lazy(() => import('../pages/admin/Billing'))
const AdminCompany = lazy(() => import('../pages/admin/Company'))
const AdminLogs = lazy(() => import('../pages/admin/ActivityLogs'))
const AdminModules = lazy(() => import('../pages/admin/Modules'))
const AdminOperations = lazy(() => import('../pages/admin/Operations'))
const AdminOutlets = lazy(() => import('../pages/admin/Outlets'))
const AdminRoles = lazy(() => import('../pages/admin/Roles'))
const AdminUsers = lazy(() => import('../pages/admin/Users'))

export default function AdminApp() {
  const { t } = useI18n()
  const { can } = useAccess()
  const [section, setSection] = useState<Section | null>(null)

  const allItems: { id: Section; label: string }[] = [
    { id: 'users', label: t('navUsers') },
    { id: 'roles', label: t('navRoles') },
    { id: 'company', label: t('navCompany') },
    { id: 'outlets', label: t('navOutlets') },
    { id: 'modules', label: t('navModules') },
    { id: 'ops', label: t('navOps') },
    { id: 'billing', label: t('navBilling') },
    { id: 'logs', label: t('navLogs') },
  ]
  const items = allItems.filter((item) => can(item.id, 'view'))

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
      {current === 'users' ? <AdminUsers /> : null}
      {current === 'roles' ? <AdminRoles /> : null}
      {current === 'company' ? <AdminCompany /> : null}
      {current === 'outlets' ? <AdminOutlets /> : null}
      {current === 'modules' ? <AdminModules /> : null}
      {current === 'ops' ? <AdminOperations /> : null}
      {current === 'billing' ? <AdminBilling /> : null}
      {current === 'logs' ? <AdminLogs endpoint="/activity-logs" /> : null}
    </AppNavShell>
  )
}
