import { lazy, useMemo, useState } from 'react'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useI18n, type MsgKey } from '../i18n'
import { AppNavShell } from './AppNavShell'

type Section = 'tickets' | 'summary' | 'products' | 'cashiers' | 'methods' | 'channels' | 'daily'

const Sales = lazy(() => import('../pages/Sales'))
const SalesReports = lazy(() => import('../pages/SalesReports'))

export const SALES_NAV_ITEMS: { id: Section; label: MsgKey; menu: string }[] = [
  { id: 'tickets', label: 'salesTickets', menu: 'sales' },
  { id: 'summary', label: 'salesReportSummary', menu: 'salesreportsummary' },
  { id: 'products', label: 'salesReportProducts', menu: 'salesreportproducts' },
  { id: 'cashiers', label: 'salesReportCashiers', menu: 'salesreportcashiers' },
  { id: 'methods', label: 'salesReportMethods', menu: 'salesreportmethods' },
  { id: 'channels', label: 'salesReportChannels', menu: 'salesreportchannels' },
  { id: 'daily', label: 'salesReportDaily', menu: 'salesreportdaily' },
]

export const SALES_REPORT_MENUS = SALES_NAV_ITEMS.filter((item) => item.id !== 'tickets').map((item) => item.menu)

export default function SalesApp() {
  const { t } = useI18n()
  const { can } = useAccess()
  const visibleNav = useMemo(() => SALES_NAV_ITEMS.filter((item) => can(item.menu, 'view')), [can])
  const items = visibleNav.map((item) => ({ id: item.id, label: t(item.label) }))
  const [section, setSection] = useState<Section | null>(null)
  const current = section && items.some((item) => item.id === section) ? section : null

  if (items.length === 0) return null

  return (
    <AppNavShell
      items={items}
      current={current}
      onSelect={(id) => {
        setSection(id)
        logActivity('open_section', `sales:${id}`)
      }}
    >
      {current === 'tickets' ? <Sales /> : null}
      {current && current !== 'tickets' ? <SalesReports kind={current} /> : null}
    </AppNavShell>
  )
}
