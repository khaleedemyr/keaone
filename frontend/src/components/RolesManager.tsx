import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, apiMessage } from '../api/client'
import { FormAlert, useFeedback } from './feedback'
import { PageHeader } from './ui'
import { MasterFilters, MasterPager, useListQuery } from './MasterListBar'
import { useAccess } from '../access'
import { useI18n, type MsgKey } from '../i18n'
import { createPortal } from 'react-dom'
import type { AclAction, ApiOk, MenuAcl, RoleCatalogPayload, RoleMenu, RoleRecord } from '../types'

const MENU_LABEL: Record<string, MsgKey> = {
  insight: 'menuInsight',
  chat: 'menuChat',
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
  blog: 'menuBlog',
  operators: 'menuOperators',
}

const ACTIONS: { id: AclAction; label: MsgKey }[] = [
  { id: 'view', label: 'aclView' },
  { id: 'create', label: 'aclCreate' },
  { id: 'edit', label: 'aclEdit' },
  { id: 'delete', label: 'aclDelete' },
]

const ROLE_GROUPS: { id: string; label: MsgKey; menus: string[] }[] = [
  { id: 'insight', label: 'appInsight', menus: ['insight'] },
  { id: 'chat', label: 'appChat', menus: ['chat'] },
  { id: 'overview', label: 'appOverview', menus: ['overview'] },
  { id: 'pos', label: 'appPos', menus: ['pos'] },
  { id: 'master', label: 'appMaster', menus: ['products', 'categories', 'subcategories', 'units', 'itemtypes', 'pricechannels', 'discounts', 'promotions', 'customfields', 'choicetypes', 'choices', 'warehouses', 'suppliers', 'customers', 'stock', 'stockcard'] },
  { id: 'sales', label: 'appSales', menus: ['sales', 'salesreportsummary', 'salesreportproducts', 'salesreportcashiers', 'salesreportmethods', 'salesreportchannels', 'salesreportdaily'] },
  { id: 'purchase', label: 'appPurchase', menus: ['purchaserequisitions', 'purchaseorders', 'goodsreceipts'] },
  { id: 'stock', label: 'menuStock', menus: ['stock', 'stockcard'] },
  { id: 'contacts', label: 'menuContacts', menus: ['contacts'] },
  { id: 'tenants', label: 'appTenants', menus: ['tenants'] },
  { id: 'billing', label: 'appBilling', menus: ['billing', 'catalog'] },
  { id: 'blog', label: 'appBlog', menus: ['blog'] },
  { id: 'admin', label: 'appAdmin', menus: ['users', 'roles', 'company', 'outlets', 'modules', 'ops', 'logs', 'operators'] },
  { id: 'settings', label: 'appSettings', menus: ['settings', 'possettings', 'cafetables'] },
]

function emptyAcl(): MenuAcl {
  return { view: false, create: false, edit: false, delete: false }
}

function emptyMatrix(menus: RoleMenu[]): Record<string, MenuAcl> {
  const next: Record<string, MenuAcl> = {}
  for (const menu of menus) {
    next[menu.key] = { view: false, create: false, edit: false, delete: false }
  }
  return next
}

function fullMatrix(menus: RoleMenu[]): Record<string, MenuAcl> {
  const next: Record<string, MenuAcl> = {}
  for (const menu of menus) {
    next[menu.key] = {
      view: menu.actions.includes('view'),
      create: menu.actions.includes('create'),
      edit: menu.actions.includes('edit'),
      delete: menu.actions.includes('delete'),
    }
  }
  return next
}

export function RolesManager({
  endpoint,
  eyebrow,
  subtitle,
}: {
  endpoint: '/roles' | '/platform/roles'
  eyebrow: string
  subtitle: string
}) {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [menus, setMenus] = useState<RoleMenu[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RoleRecord | null>(null)
  const [name, setName] = useState('')
  const [matrix, setMatrix] = useState<Record<string, MenuAcl>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState(ROLE_GROUPS[0].id)

  const groups = useMemo(
    () => ROLE_GROUPS.filter((group) => menus.some((menu) => group.menus.includes(menu.key))),
    [menus],
  )
  const tabMenus = useMemo(
    () => menus.filter((menu) => (groups.find((group) => group.id === tab) ?? groups[0])?.menus.includes(menu.key)),
    [menus, groups, tab],
  )

  function rowFilled(menu: RoleMenu, current = matrix) {
    return menu.actions.every((action) => Boolean(current[menu.key]?.[action as AclAction]))
  }

  function setEnabled(target: RoleMenu[], enabled: boolean) {
    if (ownerLocked) return
    setMatrix((current) => {
      const next = { ...current }
      for (const menu of target) {
        const row = emptyAcl()
        if (enabled) {
          for (const action of menu.actions) {
            row[action as AclAction] = true
          }
        }
        next[menu.key] = row
      }
      return next
    })
  }

  async function load() {
    try {
      const { data } = await api.get<ApiOk<RoleCatalogPayload>>(endpoint, {
        params: {
          search: list.search || undefined,
          status: list.status,
          page: list.page,
          per_page: list.perPage,
        },
      })
      setMenus(data.data.menus)
      setRoles(data.data.roles)
      list.applyMeta(data.meta, data.data.roles.length)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [endpoint, list.search, list.status, list.page, list.perPage])

  function openCreate() {
    setEditing(null)
    setName('')
    setMatrix(emptyMatrix(menus))
    setError('')
    setTab(groups[0]?.id ?? ROLE_GROUPS[0].id)
    setOpen(true)
  }

  function openEdit(role: RoleRecord) {
    setEditing(role)
    setName(role.name)
    setMatrix({ ...emptyMatrix(menus), ...role.permissions, ...(role.is_owner ? fullMatrix(menus) : {}) })
    setError('')
    setTab(groups[0]?.id ?? ROLE_GROUPS[0].id)
    setOpen(true)
  }

  function toggle(menu: string, action: AclAction, allowed: boolean) {
    if (editing?.is_owner || !allowed) return
    setMatrix((current) => {
      const row = { ...(current[menu] ?? { view: false, create: false, edit: false, delete: false }) }
      const next = !row[action]
      row[action] = next
      if (action !== 'view' && next) row.view = true
      if (action === 'view' && !next) {
        row.create = false
        row.edit = false
        row.delete = false
      }
      return { ...current, [menu]: row }
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) await api.put(`${endpoint}/${editing.id}`, { name, permissions: matrix })
      else await api.post(endpoint, { name, permissions: matrix })
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(role: RoleRecord) {
    const ok = await feedback.confirm({
      title: t('deleteRoleTitle'),
      message: t('deleteConfirm', { name: role.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`${endpoint}/${role.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(role: RoleRecord) {
    try {
      await api.put(`${endpoint}/${role.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const canCreate = can('roles', 'create')
  const canEdit = can('roles', 'edit')
  const canDelete = can('roles', 'delete')
  const ownerLocked = Boolean(editing?.is_owner)
  const allChecked = menus.length > 0 && menus.every((menu) => rowFilled(menu))
  const tabChecked = tabMenus.length > 0 && tabMenus.every((menu) => rowFilled(menu))

  useEffect(() => {
    if (!groups.some((group) => group.id === tab) && groups[0]) {
      setTab(groups[0].id)
    }
  }, [groups, tab])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={t('navRoles')}
        subtitle={subtitle}
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('addRole')}
            </button>
          ) : null
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('searchRole')} />

      <div className="grid gap-3 md:grid-cols-2">
        {roles.map((role) => (
          <div key={role.id} className="glass rounded-3xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg font-bold">{role.name}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-muted">
                  {role.is_owner ? t('roleOwner') : role.is_system ? t('roleSystem') : t('roleCustom')}
                  {' · '}
                  <span className={role.is_active ? 'text-mint' : 'text-rose-300'}>
                    {role.is_active ? t('active') : t('inactive')}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 text-sm">
                {canEdit ? (
                  <button type="button" className="text-mint" onClick={() => openEdit(role)}>
                    {t('edit')}
                  </button>
                ) : null}
                {canDelete && !role.is_system && role.is_active ? (
                  <button type="button" className="text-rose-300" onClick={() => void remove(role)}>
                    {t('delete')}
                  </button>
                ) : null}
                {canEdit && !role.is_system && !role.is_active ? (
                  <button type="button" className="text-mint" onClick={() => void activate(role)}>
                    {t('activate')}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {menus
                .filter((menu) => role.is_owner || role.permissions[menu.key]?.view)
                .map((menu) => (
                  <span key={menu.key} className="rounded-full border border-line bg-fill px-2.5 py-1 text-[11px] text-muted">
                    {t(MENU_LABEL[menu.key] ?? 'menuSettings')}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
      {roles.length === 0 ? <p className="text-sm text-muted">{t('emptyMaster')}</p> : null}
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false)
              }}
            >
              <motion.form
                onSubmit={(event) => void onSubmit(event)}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="glass flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl p-6"
              >
                <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-bold">{editing ? t('editRole') : t('addRole')}</h2>
                  {ownerLocked ? null : (
                    <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => setEnabled(menus, !allChecked)}>
                      {allChecked ? t('aclUncheckAll') : t('aclCheckAll')}
                    </button>
                  )}
                </div>
                {error ? <FormAlert>{error}</FormAlert> : null}
                {ownerLocked ? <p className="mt-2 shrink-0 text-sm text-muted">{t('roleOwnerLocked')}</p> : null}
                <label className="mt-4 shrink-0 text-sm text-muted">
                  {t('roleName')}
                  <input required className="field" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <div className="mt-4 shrink-0">
                  <div className="os-acl-tabs">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className={`os-acl-tab ${tab === group.id ? 'is-active' : ''}`}
                        onClick={() => setTab(group.id)}
                      >
                        {t(group.label)}
                      </button>
                    ))}
                  </div>
                  {ownerLocked || tabMenus.length === 0 ? null : (
                    <div className="mt-2 flex justify-end">
                      <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => setEnabled(tabMenus, !tabChecked)}>
                        {tabChecked ? t('aclUncheckTab') : t('aclCheckTab')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                  <table className="os-acl-table">
                    <thead>
                      <tr>
                        <th>{t('aclMenu')}</th>
                        <th>{t('aclRowAll')}</th>
                        {ACTIONS.map((action) => (
                          <th key={action.id}>{t(action.label)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tabMenus.map((menu) => {
                        const filled = rowFilled(menu)
                        const some = menu.actions.some((action) => Boolean(matrix[menu.key]?.[action as AclAction]))
                        return (
                          <tr key={menu.key}>
                            <td>{t(MENU_LABEL[menu.key] ?? 'menuSettings')}</td>
                            <td>
                              <input
                                type="checkbox"
                                disabled={ownerLocked}
                                checked={filled}
                                ref={(el) => {
                                  if (el) el.indeterminate = some && !filled
                                }}
                                onChange={() => setEnabled([menu], !filled)}
                                aria-label={t('aclRowAll')}
                              />
                            </td>
                            {ACTIONS.map((action) => {
                              const enabled = menu.actions.includes(action.id)
                              const checked = Boolean(matrix[menu.key]?.[action.id])
                              return (
                                <td key={action.id}>
                                  <input
                                    type="checkbox"
                                    disabled={!enabled || ownerLocked}
                                    checked={enabled && checked}
                                    onChange={() => toggle(menu.key, action.id, enabled)}
                                  />
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 flex shrink-0 justify-end gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                    {t('cancel')}
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {t('save')}
                  </button>
                </div>
              </motion.form>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

export function useRoleOptions(endpoint: '/roles' | '/platform/roles') {
  const [roles, setRoles] = useState<RoleRecord[]>([])
  useEffect(() => {
    void api
      .get<ApiOk<RoleCatalogPayload>>(endpoint, { params: { for_select: 1, status: 'all' } })
      .then(({ data }) => setRoles(data.data.roles))
      .catch(() => {})
  }, [endpoint])
  return roles
}

export { MENU_LABEL }
