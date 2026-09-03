import { lazy, useMemo, useState } from 'react'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useI18n, type MsgKey } from '../i18n'
import { AppNavShell } from './AppNavShell'

type Section =
  | 'stock'
  | 'stockcard'
  | 'stocktransfers'
  | 'stockopnames'
  | 'stockadjustments'
  | 'stockwaste'
  | 'stockproduction'
  | 'stockvaluation'
  | 'warehouses'
  | 'stocksettings'

const StockPage = lazy(() => import('../pages/Stock'))
const StockCardPage = lazy(() => import('../pages/StockCard'))
const StockTransfers = lazy(() => import('../pages/inventory/StockTransfers'))
const StockOpnames = lazy(() => import('../pages/inventory/StockOpnames'))
const StockAdjustments = lazy(() => import('../pages/inventory/StockAdjustments'))
const StockWaste = lazy(() => import('../pages/inventory/StockWaste'))
const StockProductions = lazy(() => import('../pages/inventory/StockProductions'))
const StockValuation = lazy(() => import('../pages/inventory/StockValuation'))
const Warehouses = lazy(() => import('../pages/Warehouses'))
const InventorySettings = lazy(() => import('../pages/InventorySettings'))

export const INVENTORY_NAV_ITEMS: { id: Section; label: MsgKey; menu: string }[] = [
  { id: 'stock', label: 'navStock', menu: 'stock' },
  { id: 'stockcard', label: 'navStockCard', menu: 'stockcard' },
  { id: 'stocktransfers', label: 'navStockTransfers', menu: 'stocktransfers' },
  { id: 'stockopnames', label: 'navStockOpnames', menu: 'stockopnames' },
  { id: 'stockadjustments', label: 'navStockAdjustments', menu: 'stockadjustments' },
  { id: 'stockwaste', label: 'navStockWaste', menu: 'stockwaste' },
  { id: 'stockproduction', label: 'navStockProduction', menu: 'stockproduction' },
  { id: 'stockvaluation', label: 'navStockValuation', menu: 'stockvaluation' },
  { id: 'warehouses', label: 'navWarehouses', menu: 'warehouses' },
  { id: 'stocksettings', label: 'navStockSettings', menu: 'stocksettings' },
]

export default function InventoryApp() {
  const { t } = useI18n()
  const { can } = useAccess()
  const [cardFocus, setCardFocus] = useState<{ productId: number; warehouseId: number } | null>(null)
  const visibleNav = useMemo(() => INVENTORY_NAV_ITEMS.filter((item) => can(item.menu, 'view')), [can])
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
        if (id !== 'stockcard') setCardFocus(null)
        logActivity('open_section', `inventory:${id}`)
      }}
    >
      {current === 'stock' ? (
        <StockPage
          onOpenCard={(productId, warehouseId) => {
            setCardFocus({ productId, warehouseId })
            setSection('stockcard')
          }}
        />
      ) : null}
      {current === 'stockcard' ? (
        <StockCardPage
          initialProductId={cardFocus?.productId}
          initialWarehouseId={cardFocus?.warehouseId}
        />
      ) : null}
      {current === 'stocktransfers' ? <StockTransfers /> : null}
      {current === 'stockopnames' ? <StockOpnames /> : null}
      {current === 'stockadjustments' ? <StockAdjustments /> : null}
      {current === 'stockwaste' ? <StockWaste /> : null}
      {current === 'stockproduction' ? <StockProductions /> : null}
      {current === 'stockvaluation' ? <StockValuation /> : null}
      {current === 'warehouses' ? <Warehouses /> : null}
      {current === 'stocksettings' ? <InventorySettings /> : null}
    </AppNavShell>
  )
}
