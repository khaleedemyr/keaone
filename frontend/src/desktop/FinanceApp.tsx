import { lazy, useMemo, useState } from 'react'
import { logActivity } from '../api/activity'
import { useAccess } from '../access'
import { useI18n, type MsgKey } from '../i18n'
import { AppNavShell, type AppNavGroup } from './AppNavShell'

export type FinanceSection =
  | 'glaccounts'
  | 'gljournals'
  | 'invoices'
  | 'match'
  | 'payments'
  | 'prepayments'
  | 'withholding'
  | 'budgets'
  | 'assets'
  | 'settings'

type FinanceNavDef = {
  id: FinanceSection
  label: MsgKey
  menu: string
}

export const FINANCE_NAV_GROUPS: { id: string; label: MsgKey; items: FinanceNavDef[] }[] = [
  {
    id: 'ledger',
    label: 'financeGroupLedger',
    items: [
      { id: 'glaccounts', label: 'navGlAccounts', menu: 'glaccounts' },
      { id: 'gljournals', label: 'glJournalTitle', menu: 'gljournals' },
    ],
  },
  {
    id: 'ap',
    label: 'financeGroupAp',
    items: [
      { id: 'invoices', label: 'procurementInvoiceTitle', menu: 'vendorinvoices' },
      { id: 'match', label: 'procurementMatchTitle', menu: 'matchexceptions' },
      { id: 'payments', label: 'procurementPaymentTitle', menu: 'vendorpaymentbatches' },
      { id: 'prepayments', label: 'procurementPrepaymentTitle', menu: 'vendorprepayments' },
      { id: 'withholding', label: 'procurementWithholdingTitle', menu: 'vendorwithholding' },
    ],
  },
  {
    id: 'control',
    label: 'financeGroupControl',
    items: [
      { id: 'budgets', label: 'procurementBudgetTitle', menu: 'procurementbudgets' },
      { id: 'assets', label: 'procurementFixedAssetTitle', menu: 'fixedassets' },
    ],
  },
  {
    id: 'settings',
    label: 'financeGroupSettings',
    items: [{ id: 'settings', label: 'navFinanceSettings', menu: 'financesettings' }],
  },
]

/** Flat list for ERP search (all section defs). */
export const FINANCE_NAV_ITEMS = FINANCE_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ id: item.id, label: item.label, menu: item.menu })),
)

const GlAccounts = lazy(() => import('../pages/GlAccounts'))
const GlJournalDocs = lazy(() => import('../pages/purchase/GlJournalDocs'))
const VendorInvoiceDocs = lazy(() => import('../pages/purchase/VendorInvoiceDocs'))
const MatchExceptionDocs = lazy(() => import('../pages/purchase/MatchExceptionDocs'))
const VendorPaymentBatchDocs = lazy(() => import('../pages/purchase/VendorPaymentBatchDocs'))
const VendorPrepaymentDocs = lazy(() => import('../pages/purchase/VendorPrepaymentDocs'))
const WithholdingTaxDocs = lazy(() => import('../pages/purchase/WithholdingTaxDocs'))
const BudgetDocs = lazy(() => import('../pages/purchase/BudgetDocs'))
const AssetDocs = lazy(() => import('../pages/purchase/AssetDocs'))
const FinanceSettings = lazy(() => import('../pages/finance/FinanceSettings'))

export default function FinanceApp() {
  const { t } = useI18n()
  const { can } = useAccess()

  const groups = useMemo<AppNavGroup<FinanceSection>[]>(
    () =>
      FINANCE_NAV_GROUPS.map((group) => ({
        id: group.id,
        label: t(group.label),
        items: group.items
          .filter((item) => can(item.menu, 'view'))
          .map((item) => ({ id: item.id, label: t(item.label) })),
      })).filter((group) => group.items.length > 0),
    [can, t],
  )

  const [section, setSection] = useState<FinanceSection | null>(null)
  const current =
    section && groups.some((group) => group.items.some((item) => item.id === section)) ? section : null

  if (groups.length === 0) return null

  return (
    <AppNavShell
      groups={groups}
      current={current}
      onSelect={(id) => {
        setSection(id)
        logActivity('open_section', `finance:${id}`)
      }}
    >
      {current === 'glaccounts' ? <GlAccounts /> : null}
      {current === 'gljournals' ? <GlJournalDocs /> : null}
      {current === 'invoices' ? <VendorInvoiceDocs /> : null}
      {current === 'match' ? <MatchExceptionDocs /> : null}
      {current === 'payments' ? <VendorPaymentBatchDocs /> : null}
      {current === 'prepayments' ? <VendorPrepaymentDocs /> : null}
      {current === 'withholding' ? <WithholdingTaxDocs /> : null}
      {current === 'budgets' ? <BudgetDocs /> : null}
      {current === 'assets' ? <AssetDocs /> : null}
      {current === 'settings' ? <FinanceSettings /> : null}
    </AppNavShell>
  )
}
