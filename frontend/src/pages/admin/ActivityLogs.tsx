import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useFeedback } from '../../components/feedback'
import { useI18n, type MsgKey } from '../../i18n'
import type { ActivityLogRow, ApiOk } from '../../types'

const MENU_LABEL: Record<string, MsgKey> = {
  auth: 'enterConsole',
  insight: 'menuInsight',
  pos: 'menuPos',
  products: 'menuProducts',
  categories: 'menuCategories',
  subcategories: 'menuSubCategories',
  units: 'menuUnits',
  itemtypes: 'menuItemTypes',
  pricechannels: 'menuPriceChannels',
  discounts: 'menuDiscounts',
  promotions: 'menuPromotions',
  customfields: 'menuCustomFields',
  choicetypes: 'menuChoiceTypes',
  choices: 'menuChoices',
  warehouses: 'menuWarehouses',
  suppliers: 'menuSuppliers',
  customers: 'menuCustomers',
  sales: 'menuSales',
  salesreportsummary: 'salesReportSummary',
  salesreportproducts: 'salesReportProducts',
  salesreportcashiers: 'salesReportCashiers',
  salesreportmethods: 'salesReportMethods',
  salesreportchannels: 'salesReportChannels',
  salesreportdaily: 'salesReportDaily',
  contacts: 'menuContacts',
  stock: 'menuStock',
  stockcard: 'menuStockCard',
  purchaserequisitions: 'menuPurchaseRequisitions',
  purchaseorders: 'menuPurchaseOrders',
  goodsreceipts: 'menuGoodsReceipts',
  purchasereturns: 'menuPurchaseReturns',
  vendoradjustmentnotes: 'menuVendorAdjustmentNotes',
  deliveryschedules: 'menuDeliverySchedules',
  vendorinvoices: 'menuVendorInvoices',
  matchexceptions: 'menuMatchExceptions',
  vendorpaymentbatches: 'menuVendorPaymentBatches',
  vendorprepayments: 'menuVendorPrepayments',
  procurementdashboard: 'menuProcurementDashboard',
  procurementreports: 'menuProcurementReports',
  purchasesettings: 'menuPurchaseSettings',
  approvals: 'menuApprovals',
  users: 'menuUsers',
  roles: 'menuRoles',
  company: 'menuCompany',
  outlets: 'menuOutlets',
  modules: 'menuModules',
  ops: 'menuOps',
  possettings: 'menuPosSettings',
  cafetables: 'menuCafeTables',
  billing: 'menuBilling',
  logs: 'menuLogs',
  settings: 'menuSettings',
  overview: 'menuOverview',
  tenants: 'menuTenants',
  catalog: 'menuCatalog',
  operators: 'menuOperators',
}

export default function ActivityLogs({
  endpoint,
  showCompany = false,
}: {
  endpoint: string
  showCompany?: boolean
}) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const list = useListQuery(40)
  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [menu, setMenu] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [endpoint, list.search, menu, list.page, list.perPage])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get<ApiOk<ActivityLogRow[]>>(endpoint, {
        params: {
          search: list.search || undefined,
          menu: menu || undefined,
          page: list.page,
          per_page: list.perPage,
        },
      })
      setRows(data.data)
      list.applyMeta(data.meta, data.data.length)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    } finally {
      setLoading(false)
    }
  }

  const menus = Object.keys(MENU_LABEL)

  function formatChangeValue(value: string | number | boolean | null | undefined) {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? t('yes') : t('no')
    if (typeof value === 'number') return value.toLocaleString(locale)
    return String(value)
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appAdmin')}
        title={t('navLogs')}
        subtitle={t('logsSubtitle')}
      />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('logsSearch')}
        hideStatus
        extra={
          <select
            className="field !mt-0 max-w-[12rem]"
            value={menu}
            onChange={(e) => {
              list.setPage(1)
              setMenu(e.target.value)
            }}
          >
            <option value="">{t('logsAllMenus')}</option>
            {menus.map((key) => (
              <option key={key} value={key}>
                {t(MENU_LABEL[key])}
              </option>
            ))}
          </select>
        }
      />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('logsTime')}</th>
              <th className="px-4 py-3 font-medium">{t('logsUser')}</th>
              {showCompany ? <th className="px-4 py-3 font-medium">{t('logsCompany')}</th> : null}
              <th className="px-4 py-3 font-medium">{t('logsAction')}</th>
              <th className="px-4 py-3 font-medium">{t('aclMenu')}</th>
              <th className="px-4 py-3 font-medium">{t('logsIp')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line hover:bg-fill">
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {row.created_at
                    ? new Date(row.created_at).toLocaleString(locale)
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.user?.name ?? '—'}</div>
                  <div className="text-xs text-muted">{row.user?.email}</div>
                </td>
                {showCompany ? (
                  <td className="px-4 py-3 text-muted">{row.company?.name ?? '—'}</td>
                ) : null}
                <td className="px-4 py-3">
                  <div>{row.summary}</div>
                  {row.target && !row.summary.includes(row.target) ? (
                    <div className="mt-0.5 text-xs text-muted">{row.target}</div>
                  ) : null}
                  {row.meta?.changes && row.meta.changes.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                      {row.meta.changes.map((change) => (
                        <li key={`${row.id}-${change.field}`}>
                          <span className="font-medium text-fg">{change.label}:</span>{' '}
                          {formatChangeValue(change.from)} → {formatChangeValue(change.to)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">
                  {row.menu_key && MENU_LABEL[row.menu_key] ? t(MENU_LABEL[row.menu_key]) : row.menu_key || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{row.ip ?? '—'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={showCompany ? 6 : 5}>
                  {t('logsEmpty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />
    </div>
  )
}
