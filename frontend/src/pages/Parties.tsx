import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import { logMasterForm } from '../api/activity'
import type { ApiOk, CustomFieldDefinition, Party } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { CustomFieldsEditor } from '../components/CustomFieldsEditor'
import { useI18n, type MsgKey } from '../i18n'
import { useAccess } from '../access'
import { SupplierVendorPanel } from './SupplierVendorPanel'

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  postal_code: '',
  npwp: '',
  bank_name: '',
  bank_account: '',
  bank_account_name: '',
  payment_term: '',
  payment_days: '',
  is_taxable: false,
  tax_percent: '',
  withholding_tax_enabled: false,
  withholding_tax_type: 'pph23',
  withholding_tax_rate: '',
  withholding_tax_base: 'subtotal',
  is_active: true,
  vendor_tier: '',
}

function blank(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const PAYMENT_TERMS: { id: string; days: number }[] = [
  { id: 'cash', days: 0 },
  { id: 'cod', days: 0 },
  { id: 'net7', days: 7 },
  { id: 'net14', days: 14 },
  { id: 'net30', days: 30 },
  { id: 'net45', days: 45 },
  { id: 'net60', days: 60 },
  { id: 'net90', days: 90 },
]

function normalizeTerm(value: string | null | undefined) {
  const raw = (value ?? '').trim().toLowerCase()
  if (!raw) return ''
  if (PAYMENT_TERMS.some((term) => term.id === raw)) return raw
  if (raw.includes('tunai') || raw === 'cash') return 'cash'
  if (raw.includes('cod')) return 'cod'
  const days = raw.match(/(\d+)/)?.[1]
  if (days && PAYMENT_TERMS.some((term) => term.id === `net${days}`)) return `net${days}`
  return ''
}

export default function Parties({
  menu,
  endpoint,
  title,
  subtitle,
  addLabel,
  newLabel,
  editLabel,
  deleteTitle,
  searchPlaceholder,
}: {
  menu: 'customers' | 'suppliers'
  endpoint: '/customers' | '/suppliers'
  title: MsgKey
  subtitle: MsgKey
  addLabel: MsgKey
  newLabel: MsgKey
  editLabel: MsgKey
  deleteTitle: MsgKey
  searchPlaceholder: MsgKey
}) {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<Party[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Party | null>(null)
  const [viewing, setViewing] = useState<Party | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([])
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean | null>>({})
  const isSupplier = menu === 'suppliers'
  const entity = isSupplier ? 'supplier' : 'customer'

  async function load() {
    try {
      const { data } = await api.get<ApiOk<Party[]>>(endpoint, {
        params: {
          search: list.search || undefined,
          status: list.status,
          page: list.page,
          per_page: list.perPage,
        },
      })
      setItems(data.data)
      list.applyMeta(data.meta, data.data.length)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage, endpoint])

  useEffect(() => {
    void api
      .get<ApiOk<CustomFieldDefinition[]>>('/custom-fields', {
        params: { for_form: 1, for_select: 1, entity },
        silent: true,
      })
      .then(({ data }) => setCustomFieldDefs(data.data))
      .catch(() => setCustomFieldDefs([]))
  }, [entity])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setCustomFields({})
    setError('')
    setOpen(true)
    logMasterForm(menu === 'customers' ? 'customer' : 'supplier', 'create')
  }

  function openEdit(item: Party) {
    setEditing(item)
    setForm({
      name: item.name,
      phone: item.phone ?? '',
      email: item.email ?? '',
      address: item.address ?? '',
      city: item.city ?? '',
      province: item.province ?? '',
      postal_code: item.postal_code ?? '',
      npwp: item.npwp ?? '',
      bank_name: item.bank_name ?? '',
      bank_account: item.bank_account ?? '',
      bank_account_name: item.bank_account_name ?? '',
      payment_term: normalizeTerm(item.payment_term),
      payment_days: item.payment_days != null ? String(item.payment_days) : '',
      is_taxable: Boolean(item.is_taxable),
      tax_percent: item.tax_percent != null ? String(item.tax_percent) : '',
      withholding_tax_enabled: Boolean(item.withholding_tax_enabled),
      withholding_tax_type: item.withholding_tax_type ?? 'pph23',
      withholding_tax_rate: item.withholding_tax_rate != null ? String(item.withholding_tax_rate) : '',
      withholding_tax_base: item.withholding_tax_base ?? 'subtotal',
      is_active: item.is_active,
      vendor_tier: item.vendor_tier ?? '',
    })
    setCustomFields({ ...(item.custom_fields ?? {}) })
    setError('')
    setOpen(true)
    logMasterForm(menu === 'customers' ? 'customer' : 'supplier', 'edit', item.name)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        phone: blank(form.phone),
        email: blank(form.email),
        address: blank(form.address),
        city: blank(form.city),
        province: blank(form.province),
        postal_code: blank(form.postal_code),
        npwp: blank(form.npwp),
        bank_name: isSupplier ? blank(form.bank_name) : undefined,
        bank_account: isSupplier ? blank(form.bank_account) : undefined,
        bank_account_name: isSupplier ? blank(form.bank_account_name) : undefined,
        payment_term: blank(form.payment_term),
        payment_days: form.payment_days === '' ? null : Number(form.payment_days),
        is_taxable: isSupplier ? form.is_taxable : undefined,
        tax_percent:
          isSupplier && form.is_taxable && form.tax_percent !== '' ? Number(form.tax_percent) : null,
        withholding_tax_enabled: isSupplier ? form.withholding_tax_enabled : undefined,
        withholding_tax_type:
          isSupplier && form.withholding_tax_enabled ? form.withholding_tax_type : null,
        withholding_tax_rate:
          isSupplier && form.withholding_tax_enabled && form.withholding_tax_rate !== ''
            ? Number(form.withholding_tax_rate)
            : null,
        withholding_tax_base:
          isSupplier && form.withholding_tax_enabled ? form.withholding_tax_base : undefined,
        is_active: form.is_active,
        vendor_tier: isSupplier && form.vendor_tier ? form.vendor_tier : undefined,
        custom_fields: customFields,
      }
      if (editing) await api.put(`${endpoint}/${editing.id}`, payload)
      else await api.post(endpoint, payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: Party) {
    const ok = await feedback.confirm({
      title: t(deleteTitle),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`${endpoint}/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: Party) {
    try {
      await api.put(`${endpoint}/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  function field<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function termLabel(id: string) {
    if (id === 'cash') return t('paymentTermCash')
    if (id === 'cod') return t('paymentTermCod')
    if (id.startsWith('net')) return t('paymentTermNet', { n: id.slice(3) })
    return ''
  }

  const vendorStatusMap: Record<string, MsgKey> = {
    active: 'vendorStatusActive',
    suspended: 'vendorStatusSuspended',
    blacklisted: 'vendorStatusBlacklisted',
  }

  const vendorTierMap: Record<string, MsgKey> = {
    strategic: 'vendorTierStrategic',
    preferred: 'vendorTierPreferred',
    one_time: 'vendorTierOneTime',
  }

  function vendorStatusLabel(status?: string | null) {
    return t(vendorStatusMap[status ?? 'active'] ?? 'vendorStatusActive')
  }

  function vendorTierLabel(tier?: string | null) {
    if (!tier) return '—'
    return t(vendorTierMap[tier] ?? 'vendorTierPreferred')
  }

  function onTermChange(id: string) {
    const term = PAYMENT_TERMS.find((item) => item.id === id)
    setForm((current) => ({
      ...current,
      payment_term: id,
      payment_days: term ? String(term.days) : '',
    }))
  }

  const locationLine = (item: Party) => [item.city, item.province].filter(Boolean).join(', ')
  const canEdit = can(menu, 'edit')
  const canDelete = can(menu, 'delete')
  const showActions = canEdit || canDelete

  return (
    <div>
      <PageHeader
        eyebrow={t('productsEyebrow')}
        title={t(title)}
        subtitle={t(subtitle)}
        action={
          can(menu, 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t(addLabel)}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t(searchPlaceholder)} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('phone')}</th>
              <th className="px-4 py-3 font-medium">{t('city')}</th>
              <th className="px-4 py-3 font-medium">{t('paymentTerm')}</th>
              {isSupplier ? <th className="px-4 py-3 font-medium">{t('vendorTierLabel')}</th> : null}
              {isSupplier ? <th className="px-4 py-3 font-medium">{t('vendorStatusLabel')}</th> : null}
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              {showActions ? <th className="px-4 py-3 font-medium"></th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3">
                  <MasterNameButton onClick={() => setViewing(item)}>{item.name}</MasterNameButton>
                  <div className="text-xs text-muted">{item.address ?? '-'}</div>
                </td>
                <td className="px-4 py-3 text-muted">{item.phone ?? '-'}</td>
                <td className="px-4 py-3 text-muted">{locationLine(item) || '-'}</td>
                <td className="px-4 py-3 text-muted">
                  {termLabel(normalizeTerm(item.payment_term)) ||
                    item.payment_term ||
                    (item.payment_days != null ? `${item.payment_days} ${t('days')}` : '-')}
                </td>
                {isSupplier ? (
                  <td className="px-4 py-3 text-muted">{vendorTierLabel(item.vendor_tier)}</td>
                ) : null}
                {isSupplier ? (
                  <td className="px-4 py-3">
                    <span
                      className={
                        item.vendor_status === 'blacklisted'
                          ? 'text-rose-300'
                          : item.vendor_status === 'suspended'
                            ? 'text-amber-300'
                            : 'text-mint'
                      }
                    >
                      {vendorStatusLabel(item.vendor_status)}
                    </span>
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <span className={item.is_active ? 'text-mint' : 'text-rose-300'}>
                    {item.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                {showActions ? (
                <td className="px-4 py-3 text-right">
                  {canEdit ? (
                    <button type="button" className="mr-3 text-mint" onClick={() => openEdit(item)}>
                      {t('edit')}
                    </button>
                  ) : null}
                  {item.is_active && canDelete ? (
                    <button type="button" className="text-rose-300" onClick={() => void remove(item)}>
                      {t('delete')}
                    </button>
                  ) : null}
                  {!item.is_active && canEdit ? (
                    <button type="button" className="text-mint" onClick={() => void activate(item)}>
                      {t('activate')}
                    </button>
                  ) : null}
                </td>
                ) : null}
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={showActions ? (isSupplier ? 8 : 6) : isSupplier ? 7 : 5}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t(editLabel) : t(newLabel)}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        size="xl"
      >
        <label className="text-sm text-muted">
          {t('name')}
          <input required className="field" value={form.name} onChange={(e) => field('name', e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-muted">
            {t('phone')}
            <input className="field" value={form.phone} onChange={(e) => field('phone', e.target.value)} />
          </label>
          <label className="text-sm text-muted">
            {t('email')}
            <input className="field" value={form.email} onChange={(e) => field('email', e.target.value)} />
          </label>
        </div>
        <label className="text-sm text-muted">
          {t('address')}
          <textarea className="field min-h-20" value={form.address} onChange={(e) => field('address', e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-muted">
            {t('city')}
            <input className="field" value={form.city} onChange={(e) => field('city', e.target.value)} />
          </label>
          <label className="text-sm text-muted">
            {t('province')}
            <input className="field" value={form.province} onChange={(e) => field('province', e.target.value)} />
          </label>
          <label className="text-sm text-muted">
            {t('postalCode')}
            <input className="field" value={form.postal_code} onChange={(e) => field('postal_code', e.target.value)} />
          </label>
          <label className="text-sm text-muted">
            {t('npwp')}
            <input className="field" value={form.npwp} onChange={(e) => field('npwp', e.target.value)} />
          </label>
          {isSupplier ? (
            <>
              <label className="text-sm text-muted">
                {t('bank')}
                <input className="field" value={form.bank_name} onChange={(e) => field('bank_name', e.target.value)} />
              </label>
              <label className="text-sm text-muted">
                {t('bankAccount')}
                <input className="field" value={form.bank_account} onChange={(e) => field('bank_account', e.target.value)} />
              </label>
              <label className="text-sm text-muted">
                {t('bankAccountName')}
                <input
                  className="field"
                  value={form.bank_account_name}
                  onChange={(e) => field('bank_account_name', e.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="text-sm text-muted">
            {t('paymentTerm')}
            <select className="field" value={form.payment_term} onChange={(e) => onTermChange(e.target.value)}>
              <option value="">{t('paymentTermNone')}</option>
              {PAYMENT_TERMS.map((term) => (
                <option key={term.id} value={term.id}>
                  {termLabel(term.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted">
            {t('paymentDays')}
            <input
              type="number"
              min={0}
              className="field"
              value={form.payment_days}
              onChange={(e) => field('payment_days', e.target.value)}
            />
          </label>
          {isSupplier ? (
            <>
              <label className="text-sm text-muted">
                {t('vendorTierLabel')}
                <select className="field" value={form.vendor_tier} onChange={(e) => field('vendor_tier', e.target.value)}>
                  <option value="">{t('vendorTierNone')}</option>
                  <option value="strategic">{t('vendorTierStrategic')}</option>
                  <option value="preferred">{t('vendorTierPreferred')}</option>
                  <option value="one_time">{t('vendorTierOneTime')}</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-fg sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_taxable}
                  onChange={(e) => field('is_taxable', e.target.checked)}
                />
                {t('supplierTaxable')}
              </label>
              {form.is_taxable ? (
                <label className="text-sm text-muted sm:col-span-2">
                  {t('supplierTaxPercent')}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    className="field"
                    value={form.tax_percent}
                    onChange={(e) => field('tax_percent', e.target.value)}
                    required
                  />
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-fg sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.withholding_tax_enabled}
                  onChange={(e) => field('withholding_tax_enabled', e.target.checked)}
                />
                {t('supplierWithholdingEnabled')}
              </label>
              {form.withholding_tax_enabled ? (
                <>
                  <label className="text-sm text-muted">
                    {t('supplierWithholdingType')}
                    <select
                      className="field"
                      value={form.withholding_tax_type}
                      onChange={(e) => field('withholding_tax_type', e.target.value)}
                    >
                      <option value="pph23">{t('supplierWithholdingTypePph23')}</option>
                      <option value="pph22">{t('supplierWithholdingTypePph22')}</option>
                      <option value="pph42">{t('supplierWithholdingTypePph42')}</option>
                    </select>
                  </label>
                  <label className="text-sm text-muted">
                    {t('supplierWithholdingRate')}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className="field"
                      value={form.withholding_tax_rate}
                      onChange={(e) => field('withholding_tax_rate', e.target.value)}
                      required
                    />
                  </label>
                  <label className="text-sm text-muted sm:col-span-2">
                    {t('supplierWithholdingBase')}
                    <select
                      className="field"
                      value={form.withholding_tax_base}
                      onChange={(e) => field('withholding_tax_base', e.target.value)}
                    >
                      <option value="subtotal">{t('supplierWithholdingBaseSubtotal')}</option>
                      <option value="total">{t('supplierWithholdingBaseTotal')}</option>
                    </select>
                  </label>
                </>
              ) : null}
            </>
          ) : null}
          <label className="text-sm text-muted">
            {t('status')}
            <select
              className="field"
              value={form.is_active ? 'active' : 'inactive'}
              onChange={(e) => field('is_active', e.target.value === 'active')}
            >
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </select>
          </label>
        </div>
        <CustomFieldsEditor fields={customFieldDefs} values={customFields} onChange={setCustomFields} />
      </MasterModal>

      <MasterViewModal
        open={Boolean(viewing)}
        title={t('viewRecord')}
        size="xl"
        onClose={() => setViewing(null)}
        onEdit={
          viewing && canEdit
            ? () => {
                const item = viewing
                setViewing(null)
                openEdit(item)
              }
            : undefined
        }
      >
        <ViewField label={t('name')} value={viewing?.name} />
        <div className="grid gap-3 sm:grid-cols-2">
          <ViewField label={t('phone')} value={viewing?.phone} />
          <ViewField label={t('email')} value={viewing?.email} />
          <ViewField label={t('address')} value={viewing?.address} />
          <ViewField label={t('city')} value={viewing?.city} />
          <ViewField label={t('province')} value={viewing?.province} />
          <ViewField label={t('postalCode')} value={viewing?.postal_code} />
          <ViewField label={t('npwp')} value={viewing?.npwp} />
          {isSupplier ? (
            <>
              <ViewField label={t('bank')} value={viewing?.bank_name} />
              <ViewField label={t('bankAccount')} value={viewing?.bank_account} />
              <ViewField label={t('bankAccountName')} value={viewing?.bank_account_name} />
            </>
          ) : null}
          <ViewField
            label={t('paymentTerm')}
            value={
              viewing
                ? termLabel(normalizeTerm(viewing.payment_term)) || viewing.payment_term
                : null
            }
          />
          <ViewField label={t('paymentDays')} value={viewing?.payment_days} />
          {isSupplier ? (
            <>
              <ViewField
                label={t('supplierTaxable')}
                value={viewing?.is_taxable ? t('yes') : t('no')}
              />
              {viewing?.is_taxable ? (
                <ViewField label={t('supplierTaxPercent')} value={`${viewing.tax_percent ?? 0}%`} />
              ) : null}
              <ViewField
                label={t('supplierWithholdingEnabled')}
                value={viewing?.withholding_tax_enabled ? t('yes') : t('no')}
              />
              {viewing?.withholding_tax_enabled ? (
                <>
                  <ViewField
                    label={t('supplierWithholdingType')}
                    value={
                      viewing.withholding_tax_type === 'pph22'
                        ? t('supplierWithholdingTypePph22')
                        : viewing.withholding_tax_type === 'pph42'
                          ? t('supplierWithholdingTypePph42')
                          : t('supplierWithholdingTypePph23')
                    }
                  />
                  <ViewField label={t('supplierWithholdingRate')} value={`${viewing.withholding_tax_rate ?? 0}%`} />
                  <ViewField
                    label={t('supplierWithholdingBase')}
                    value={
                      viewing.withholding_tax_base === 'total'
                        ? t('supplierWithholdingBaseTotal')
                        : t('supplierWithholdingBaseSubtotal')
                    }
                  />
                </>
              ) : null}
            </>
          ) : null}
          <ViewField label={t('status')} value={viewing?.is_active ? t('active') : t('inactive')} />
        </div>
        {customFieldDefs.length > 0 && viewing ? (
          <div className="mt-3 space-y-2 rounded-2xl border border-line bg-fill/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('customFieldsSection')}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {customFieldDefs.map((field) => {
                const raw = viewing.custom_fields?.[field.key]
                const display =
                  field.type === 'boolean'
                    ? raw
                      ? t('active')
                      : t('inactive')
                    : raw == null || raw === ''
                      ? '-'
                      : String(raw)
                return <ViewField key={field.key} label={field.label} value={display} />
              })}
            </div>
          </div>
        ) : null}
        {isSupplier && viewing ? <SupplierVendorPanel supplierId={viewing.id} canEdit={canEdit} /> : null}
      </MasterViewModal>
    </div>
  )
}
