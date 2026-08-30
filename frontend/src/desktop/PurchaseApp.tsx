import { lazy, useMemo, useState } from 'react'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useAuth } from '../auth'
import { useI18n, type MsgKey } from '../i18n'
import { AppNavShell, type AppNavGroup } from './AppNavShell'

export type PurchaseSection =
  | 'dashboard'
  | 'pr'
  | 'po'
  | 'gr'
  | 'direct'
  | 'return'
  | 'adjustments'
  | 'delivery'
  | 'invoices'
  | 'match'
  | 'payments'
  | 'prepayments'
  | 'withholding'
  | 'journals'
  | 'budgets'
  | 'assets'
  | 'rfqs'
  | 'vendorpricelists'
  | 'contracts'
  | 'plans'
  | 'approvalmatrix'
  | 'approvaldelegations'
  | 'reports'
  | 'settings'

type PurchaseFlow = 'strict_pr_po_gr' | 'po_gr' | 'direct'

type PurchaseNavContext = {
  flow: PurchaseFlow
  returnEnabled: boolean
  adjustmentEnabled: boolean
  deliveryEnabled: boolean
  rfqEnabled: boolean
  priceListEnabled: boolean
  contractEnabled: boolean
  planEnabled: boolean
  autoReorderEnabled: boolean
  demandPlanningEnabled: boolean
}

type PurchaseNavDef = {
  id: PurchaseSection
  label: MsgKey
  menu: string
  visible?: (ctx: PurchaseNavContext) => boolean
}

export const PROCUREMENT_NAV_GROUPS: { id: string; label: MsgKey; items: PurchaseNavDef[] }[] = [
  {
    id: 'overview',
    label: 'procurementGroupOverview',
    items: [
      { id: 'dashboard', label: 'procurementDashTitle', menu: 'procurementdashboard' },
      { id: 'reports', label: 'procurementReportsTitle', menu: 'procurementreports' },
    ],
  },
  {
    id: 'sourcing',
    label: 'procurementGroupSourcing',
    items: [
      {
        id: 'rfqs',
        label: 'procurementRfqTitle',
        menu: 'rfqs',
        visible: (ctx) => ctx.rfqEnabled,
      },
      {
        id: 'vendorpricelists',
        label: 'procurementVendorPriceListTitle',
        menu: 'supplierpricelists',
        visible: (ctx) => ctx.priceListEnabled,
      },
      {
        id: 'contracts',
        label: 'procurementContractTitle',
        menu: 'procurementcontracts',
        visible: (ctx) => ctx.contractEnabled,
      },
    ],
  },
  {
    id: 'planning',
    label: 'procurementGroupPlanning',
    items: [
      {
        id: 'plans',
        label: 'procurementPlanTitle',
        menu: 'procurementplans',
        visible: (ctx) => ctx.planEnabled,
      },
    ],
  },
  {
    id: 'operations',
    label: 'procurementGroupOperations',
    items: [
      {
        id: 'pr',
        label: 'purchasePrTitle',
        menu: 'purchaserequisitions',
        visible: (ctx) => ctx.flow === 'strict_pr_po_gr',
      },
      {
        id: 'po',
        label: 'purchasePoTitle',
        menu: 'purchaseorders',
        visible: (ctx) => ctx.flow === 'strict_pr_po_gr' || ctx.flow === 'po_gr',
      },
      {
        id: 'gr',
        label: 'purchaseGrTitle',
        menu: 'goodsreceipts',
        visible: (ctx) => ctx.flow === 'strict_pr_po_gr' || ctx.flow === 'po_gr',
      },
      {
        id: 'direct',
        label: 'purchaseDirectTitle',
        menu: 'goodsreceipts',
        visible: (ctx) => ctx.flow === 'direct',
      },
      {
        id: 'return',
        label: 'procurementReturnTitle',
        menu: 'purchasereturns',
        visible: (ctx) => ctx.returnEnabled,
      },
      {
        id: 'adjustments',
        label: 'procurementAdjustmentTitle',
        menu: 'vendoradjustmentnotes',
        visible: (ctx) => ctx.adjustmentEnabled,
      },
      {
        id: 'delivery',
        label: 'procurementDeliveryTitle',
        menu: 'deliveryschedules',
        visible: (ctx) =>
          ctx.deliveryEnabled && (ctx.flow === 'strict_pr_po_gr' || ctx.flow === 'po_gr'),
      },
    ],
  },
  {
    id: 'ap',
    label: 'procurementGroupAp',
    items: [
      { id: 'invoices', label: 'procurementInvoiceTitle', menu: 'vendorinvoices' },
      { id: 'match', label: 'procurementMatchTitle', menu: 'matchexceptions' },
      { id: 'payments', label: 'procurementPaymentTitle', menu: 'vendorpaymentbatches' },
      { id: 'prepayments', label: 'procurementPrepaymentTitle', menu: 'vendorprepayments' },
      { id: 'withholding', label: 'procurementWithholdingTitle', menu: 'vendorwithholding' },
    ],
  },
  {
    id: 'finance',
    label: 'procurementGroupFinance',
    items: [
      { id: 'journals', label: 'glJournalTitle', menu: 'gljournals' },
      { id: 'budgets', label: 'procurementBudgetTitle', menu: 'procurementbudgets' },
      { id: 'assets', label: 'procurementFixedAssetTitle', menu: 'fixedassets' },
    ],
  },
  {
    id: 'settings',
    label: 'procurementGroupSettings',
    items: [
      { id: 'approvalmatrix', label: 'procurementApprovalMatrixTitle', menu: 'approvalmatrix' },
      { id: 'approvaldelegations', label: 'procurementApprovalDelegationTitle', menu: 'approvaldelegations' },
      { id: 'settings', label: 'navPurchaseSettings', menu: 'purchasesettings' },
    ],
  },
]

export function getPurchaseNavDefs(
  flow: PurchaseFlow,
  returnEnabled: boolean,
  adjustmentEnabled: boolean,
  deliveryEnabled: boolean,
  rfqEnabled: boolean,
  priceListEnabled: boolean,
  contractEnabled: boolean,
  planEnabled: boolean,
): PurchaseNavDef[] {
  const ctx: PurchaseNavContext = { flow, returnEnabled, adjustmentEnabled, deliveryEnabled, rfqEnabled, priceListEnabled, contractEnabled, planEnabled, autoReorderEnabled: false, demandPlanningEnabled: false }

  return PROCUREMENT_NAV_GROUPS.flatMap((group) =>
    group.items.filter((item) => !item.visible || item.visible(ctx)),
  )
}

const PurchaseDocs = lazy(() => import('../pages/purchase/PurchaseDocs'))
const PurchaseReturnDocs = lazy(() => import('../pages/purchase/PurchaseReturnDocs'))
const VendorAdjustmentDocs = lazy(() => import('../pages/purchase/VendorAdjustmentDocs'))
const DeliveryScheduleDocs = lazy(() => import('../pages/purchase/DeliveryScheduleDocs'))
const VendorInvoiceDocs = lazy(() => import('../pages/purchase/VendorInvoiceDocs'))
const MatchExceptionDocs = lazy(() => import('../pages/purchase/MatchExceptionDocs'))
const VendorPaymentBatchDocs = lazy(() => import('../pages/purchase/VendorPaymentBatchDocs'))
const VendorPrepaymentDocs = lazy(() => import('../pages/purchase/VendorPrepaymentDocs'))
const WithholdingTaxDocs = lazy(() => import('../pages/purchase/WithholdingTaxDocs'))
const GlJournalDocs = lazy(() => import('../pages/purchase/GlJournalDocs'))
const BudgetDocs = lazy(() => import('../pages/purchase/BudgetDocs'))
const AssetDocs = lazy(() => import('../pages/purchase/AssetDocs'))
const RfqDocs = lazy(() => import('../pages/purchase/RfqDocs'))
const VendorPriceListDocs = lazy(() => import('../pages/purchase/VendorPriceListDocs'))
const ContractDocs = lazy(() => import('../pages/purchase/ContractDocs'))
const PlanDocs = lazy(() => import('../pages/purchase/PlanDocs'))
const ApprovalMatrixDocs = lazy(() => import('../pages/purchase/ApprovalMatrixDocs'))
const ApprovalDelegationDocs = lazy(() => import('../pages/purchase/ApprovalDelegationDocs'))
const PurchaseSettings = lazy(() => import('../pages/purchase/PurchaseSettings'))
const ProcurementDashboard = lazy(() => import('../pages/purchase/ProcurementDashboard'))
const ProcurementReports = lazy(() => import('../pages/purchase/ProcurementReports'))

export default function PurchaseApp() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const flow = (me?.settings?.purchase_flow ?? 'direct') as PurchaseFlow
  const returnEnabled = me?.settings?.return_enabled !== false
  const adjustmentEnabled = me?.settings?.vendor_adjustment_enabled !== false
  const deliveryEnabled = me?.settings?.delivery_schedule_enabled !== false
  const rfqEnabled = me?.settings?.procurement_rfq_enabled === true
  const priceListEnabled = me?.settings?.procurement_vendor_price_list_enabled === true
  const contractEnabled = me?.settings?.procurement_contract_enabled === true
  const planEnabled = me?.settings?.procurement_annual_plan_enabled === true
  const autoReorderEnabled = me?.settings?.procurement_auto_reorder_enabled === true
  const demandPlanningEnabled = me?.settings?.procurement_demand_planning_enabled === true

  const navContext = useMemo<PurchaseNavContext>(
    () => ({ flow, returnEnabled, adjustmentEnabled, deliveryEnabled, rfqEnabled, priceListEnabled, contractEnabled, planEnabled, autoReorderEnabled, demandPlanningEnabled }),
    [flow, returnEnabled, adjustmentEnabled, deliveryEnabled, rfqEnabled, priceListEnabled, contractEnabled, planEnabled, autoReorderEnabled, demandPlanningEnabled],
  )

  const groups = useMemo<AppNavGroup<PurchaseSection>[]>(
    () =>
      PROCUREMENT_NAV_GROUPS.map((group) => ({
        id: group.id,
        label: t(group.label),
        items: group.items
          .filter((item) => !item.visible || item.visible(navContext))
          .filter((item) => can(item.menu, 'view'))
          .map((item) => ({ id: item.id, label: t(item.label) })),
      })).filter((group) => group.items.length > 0),
    [can, navContext, t],
  )

  const [section, setSection] = useState<PurchaseSection | null>(null)
  const current =
    section && groups.some((group) => group.items.some((item) => item.id === section)) ? section : null

  function go(sectionId: PurchaseSection) {
    setSection(sectionId)
    logActivity('open_section', `procurement:${sectionId}`)
  }

  if (groups.length === 0) return null

  return (
    <AppNavShell groups={groups} current={current} onSelect={go}>
      {current === 'dashboard' ? <ProcurementDashboard onNavigate={go} /> : null}
      {current === 'reports' ? <ProcurementReports /> : null}
      {current === 'pr' ? <PurchaseDocs kind="pr" /> : null}
      {current === 'po' ? <PurchaseDocs kind="po" /> : null}
      {current === 'gr' ? <PurchaseDocs kind="gr" /> : null}
      {current === 'direct' ? <PurchaseDocs kind="direct" /> : null}
      {current === 'return' ? <PurchaseReturnDocs /> : null}
      {current === 'adjustments' ? <VendorAdjustmentDocs /> : null}
      {current === 'delivery' ? <DeliveryScheduleDocs /> : null}
      {current === 'invoices' ? <VendorInvoiceDocs /> : null}
      {current === 'match' ? <MatchExceptionDocs /> : null}
      {current === 'payments' ? <VendorPaymentBatchDocs /> : null}
      {current === 'prepayments' ? <VendorPrepaymentDocs /> : null}
      {current === 'withholding' ? <WithholdingTaxDocs /> : null}
      {current === 'journals' ? <GlJournalDocs /> : null}
      {current === 'budgets' ? <BudgetDocs /> : null}
      {current === 'assets' ? <AssetDocs /> : null}
      {current === 'rfqs' ? <RfqDocs /> : null}
      {current === 'contracts' ? <ContractDocs /> : null}
      {current === 'plans' ? <PlanDocs /> : null}
      {current === 'approvalmatrix' ? <ApprovalMatrixDocs /> : null}
      {current === 'approvaldelegations' ? <ApprovalDelegationDocs /> : null}
      {current === 'vendorpricelists' ? <VendorPriceListDocs /> : null}
      {current === 'settings' ? <PurchaseSettings /> : null}
    </AppNavShell>
  )
}
