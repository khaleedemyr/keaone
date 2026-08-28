import { lazy, useMemo, useState } from 'react'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useI18n, type MsgKey } from '../i18n'
import { AppNavShell } from './AppNavShell'

type Section = 'employees' | 'departments' | 'positions' | 'joblevels'

const Employees = lazy(() => import('../pages/hr/Employees'))
const Departments = lazy(() => import('../pages/hr/Departments'))
const Positions = lazy(() => import('../pages/hr/Positions'))
const JobLevels = lazy(() => import('../pages/hr/JobLevels'))

export const HR_NAV_ITEMS: { id: Section; label: MsgKey; menu: string }[] = [
  { id: 'employees', label: 'navEmployees', menu: 'users' },
  { id: 'departments', label: 'navDepartments', menu: 'departments' },
  { id: 'positions', label: 'navPositions', menu: 'positions' },
  { id: 'joblevels', label: 'navJobLevels', menu: 'joblevels' },
]

export default function HrApp() {
  const { t } = useI18n()
  const { can } = useAccess()
  const [section, setSection] = useState<Section | null>(null)

  const items = useMemo(
    () => HR_NAV_ITEMS.filter((item) => can(item.menu, 'view')).map((item) => ({ id: item.id, label: t(item.label) })),
    [can, t],
  )

  const current = section && items.some((item) => item.id === section) ? section : null

  return (
    <AppNavShell
      items={items}
      current={current}
      onSelect={(id) => {
        setSection(id as Section)
        logActivity('open_section', id)
      }}
    >
      {current === 'employees' ? <Employees /> : null}
      {current === 'departments' ? <Departments /> : null}
      {current === 'positions' ? <Positions /> : null}
      {current === 'joblevels' ? <JobLevels /> : null}
    </AppNavShell>
  )
}
