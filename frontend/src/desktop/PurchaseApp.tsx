import { lazy, useMemo, useState } from 'react'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useAuth } from '../auth'
import { useI18n, type MsgKey } from '../i18n'
import { AppNavShell } from './AppNavShell'

type Section = 'pr' | 'po' | 'gr' | 'direct' | 'settings'

type PurchaseNavDef = { id: Section; label: MsgKey; menu: string }

export function getPurchaseNavDefs(flow: 'strict_pr_po_gr' | 'po_gr' | 'direct'): PurchaseNavDef[] {
  const items: PurchaseNavDef[] = []
  if (flow === 'strict_pr_po_gr') {
    items.push({ id: 'pr', label: 'purchasePrTitle', menu: 'purchaserequisitions' })
  }
  if (flow === 'strict_pr_po_gr' || flow === 'po_gr') {
    items.push({ id: 'po', label: 'purchasePoTitle', menu: 'purchaseorders' })
  }
  if (flow === 'strict_pr_po_gr' || flow === 'po_gr') {
    items.push({ id: 'gr', label: 'purchaseGrTitle', menu: 'goodsreceipts' })
  }
  if (flow === 'direct') {
    items.push({ id: 'direct', label: 'purchaseDirectTitle', menu: 'goodsreceipts' })
  }
  items.push({ id: 'settings', label: 'navPurchaseSettings', menu: 'purchasesettings' })
  return items
}

const PurchaseDocs = lazy(() => import('../pages/purchase/PurchaseDocs'))
const PurchaseSettings = lazy(() => import('../pages/purchase/PurchaseSettings'))

export default function PurchaseApp() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const flow = (me?.settings?.purchase_flow ?? 'direct') as 'strict_pr_po_gr' | 'po_gr' | 'direct'

  const nav = useMemo(() => {
    const defs = getPurchaseNavDefs(flow)
    return defs.filter((item) => {
      if (item.id === 'settings') return can(item.menu, 'view')
      return can(item.menu, 'view')
    })
  }, [can, flow])

  const items = nav.map((item) => ({ id: item.id, label: t(item.label) }))
  const [section, setSection] = useState<Section | null>(null)
  const current = section && items.some((item) => item.id === section) ? section : null

  if (items.length === 0) return null

  return (
    <AppNavShell
      items={items}
      current={current}
      onSelect={(id) => {
        setSection(id)
        logActivity('open_section', `purchase:${id}`)
      }}
    >
      {current === 'pr' ? <PurchaseDocs kind="pr" /> : null}
      {current === 'po' ? <PurchaseDocs kind="po" /> : null}
      {current === 'gr' ? <PurchaseDocs kind="gr" /> : null}
      {current === 'direct' ? <PurchaseDocs kind="direct" /> : null}
      {current === 'settings' ? <PurchaseSettings /> : null}
    </AppNavShell>
  )
}
