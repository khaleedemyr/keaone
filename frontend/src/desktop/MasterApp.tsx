import { lazy, useMemo, useState } from 'react'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useI18n, type MsgKey } from '../i18n'
import { moduleForMenu } from '../lib/modules'
import { AppNavShell, type AppNavGroup } from './AppNavShell'

type Section =
  | 'products'
  | 'categories'
  | 'subcategories'
  | 'units'
  | 'itemtypes'
  | 'pricechannels'
  | 'discounts'
  | 'promotions'
  | 'customfields'
  | 'choicetypes'
  | 'choices'
  | 'warehouses'
  | 'suppliers'
  | 'customers'
  | 'stock'
  | 'stockcard'

const Products = lazy(() => import('../pages/Products'))
const Categories = lazy(() => import('../pages/Categories'))
const SubCategories = lazy(() => import('../pages/SubCategories'))
const Units = lazy(() => import('../pages/Units'))
const ItemTypes = lazy(() => import('../pages/ItemTypes'))
const PriceChannels = lazy(() => import('../pages/PriceChannels'))
const Discounts = lazy(() => import('../pages/Discounts'))
const Promotions = lazy(() => import('../pages/Promotions'))
const CustomFields = lazy(() => import('../pages/CustomFields'))
const ChoiceTypes = lazy(() => import('../pages/ChoiceTypes'))
const Choices = lazy(() => import('../pages/Choices'))
const Warehouses = lazy(() => import('../pages/Warehouses'))
const Parties = lazy(() => import('../pages/Parties'))
const StockPage = lazy(() => import('../pages/Stock'))
const StockCardPage = lazy(() => import('../pages/StockCard'))

const NAV_GROUPS: { id: string; label: MsgKey; items: { id: Section; label: MsgKey }[] }[] = [
  {
    id: 'catalog',
    label: 'masterGroupCatalog',
    items: [
      { id: 'products', label: 'navProducts' },
      { id: 'categories', label: 'navCategories' },
      { id: 'subcategories', label: 'navSubCategories' },
      { id: 'units', label: 'navUnits' },
      { id: 'itemtypes', label: 'navItemTypes' },
    ],
  },
  {
    id: 'pricing',
    label: 'masterGroupPricing',
    items: [
      { id: 'pricechannels', label: 'navPriceChannels' },
      { id: 'discounts', label: 'navDiscounts' },
      { id: 'promotions', label: 'navPromotions' },
      { id: 'customfields', label: 'navCustomFields' },
    ],
  },
  {
    id: 'modifiers',
    label: 'masterGroupModifiers',
    items: [
      { id: 'choicetypes', label: 'navChoiceTypes' },
      { id: 'choices', label: 'navChoices' },
    ],
  },
  {
    id: 'inventory',
    label: 'masterGroupInventory',
    items: [
      { id: 'stock', label: 'navStock' },
      { id: 'stockcard', label: 'navStockCard' },
      { id: 'warehouses', label: 'navWarehouses' },
    ],
  },
  {
    id: 'partners',
    label: 'masterGroupPartners',
    items: [
      { id: 'suppliers', label: 'navSuppliers' },
      { id: 'customers', label: 'navCustomers' },
    ],
  },
]

export default function MasterApp() {
  const { t } = useI18n()
  const { can, hasModule } = useAccess()
  const [cardFocus, setCardFocus] = useState<{ productId: number; warehouseId: number } | null>(null)
  const groups = useMemo<AppNavGroup<Section>[]>(
    () =>
      NAV_GROUPS.map((group) => ({
        id: group.id,
        label: t(group.label),
        items: group.items
          .filter((item) => {
            if (!can(item.id, 'view')) return false
            const mod = moduleForMenu(item.id)
            return !mod || hasModule(mod)
          })
          .map((item) => ({ id: item.id, label: t(item.label) })),
      })).filter((group) => group.items.length > 0),
    [can, hasModule, t],
  )
  const [section, setSection] = useState<Section | null>(null)
  const current =
    section && groups.some((group) => group.items.some((item) => item.id === section)) ? section : null

  return (
    <AppNavShell
      groups={groups}
      current={current}
      onSelect={(id) => {
        setSection(id)
        if (id !== 'stockcard') setCardFocus(null)
        logActivity('open_section', id)
      }}
    >
      {current === 'products' ? <Products /> : null}
      {current === 'categories' ? <Categories /> : null}
      {current === 'subcategories' ? <SubCategories /> : null}
      {current === 'units' ? <Units /> : null}
      {current === 'itemtypes' ? <ItemTypes /> : null}
      {current === 'pricechannels' ? <PriceChannels /> : null}
      {current === 'discounts' ? <Discounts /> : null}
      {current === 'promotions' ? <Promotions /> : null}
      {current === 'customfields' ? <CustomFields /> : null}
      {current === 'choicetypes' ? <ChoiceTypes /> : null}
      {current === 'choices' ? <Choices /> : null}
      {current === 'warehouses' ? <Warehouses /> : null}
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
      {current === 'suppliers' ? (
        <Parties
          menu="suppliers"
          endpoint="/suppliers"
          title="navSuppliers"
          subtitle="suppliersSubtitle"
          addLabel="addSupplier"
          newLabel="newSupplier"
          editLabel="editSupplier"
          deleteTitle="deleteSupplierTitle"
          searchPlaceholder="searchSupplier"
        />
      ) : null}
      {current === 'customers' ? (
        <Parties
          menu="customers"
          endpoint="/customers"
          title="navCustomers"
          subtitle="customersSubtitle"
          addLabel="addCustomer"
          newLabel="newCustomer"
          editLabel="editCustomer"
          deleteTitle="deleteCustomerTitle"
          searchPlaceholder="searchCustomer"
        />
      ) : null}
    </AppNavShell>
  )
}
