import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, GlAccount, Settings } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAuth } from '../../auth'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'

type FinanceSettingsForm = {
  sales_gl_posting_enabled: boolean
  gl_sales_cash_account_id: number | null
  gl_sales_bank_account_id: number | null
  gl_sales_ar_account_id: number | null
  gl_sales_revenue_account_id: number | null
  gl_sales_vat_output_account_id: number | null
  gl_sales_cogs_account_id: number | null
  gl_sales_inventory_account_id: number | null
  procurement_gl_posting_enabled: boolean
  procurement_budget_check_enabled: boolean
  procurement_fixed_asset_auto_serial_enabled: boolean
  gl_procurement_inventory_account_id: number | null
  gl_procurement_grni_account_id: number | null
  gl_procurement_ap_account_id: number | null
  gl_procurement_vat_input_account_id: number | null
  gl_procurement_cash_account_id: number | null
  gl_procurement_bank_account_id: number | null
  gl_procurement_wht_payable_account_id: number | null
  gl_procurement_expense_account_id: number | null
  gl_procurement_fixed_asset_account_id: number | null
}

const EMPTY: FinanceSettingsForm = {
  sales_gl_posting_enabled: false,
  gl_sales_cash_account_id: null,
  gl_sales_bank_account_id: null,
  gl_sales_ar_account_id: null,
  gl_sales_revenue_account_id: null,
  gl_sales_vat_output_account_id: null,
  gl_sales_cogs_account_id: null,
  gl_sales_inventory_account_id: null,
  procurement_gl_posting_enabled: false,
  procurement_budget_check_enabled: false,
  procurement_fixed_asset_auto_serial_enabled: false,
  gl_procurement_inventory_account_id: null,
  gl_procurement_grni_account_id: null,
  gl_procurement_ap_account_id: null,
  gl_procurement_vat_input_account_id: null,
  gl_procurement_cash_account_id: null,
  gl_procurement_bank_account_id: null,
  gl_procurement_wht_payable_account_id: null,
  gl_procurement_expense_account_id: null,
  gl_procurement_fixed_asset_account_id: null,
}

function fromSettings(settings: Settings): FinanceSettingsForm {
  return {
    sales_gl_posting_enabled: Boolean(settings.sales_gl_posting_enabled),
    gl_sales_cash_account_id: settings.gl_sales_cash_account_id ?? null,
    gl_sales_bank_account_id: settings.gl_sales_bank_account_id ?? null,
    gl_sales_ar_account_id: settings.gl_sales_ar_account_id ?? null,
    gl_sales_revenue_account_id: settings.gl_sales_revenue_account_id ?? null,
    gl_sales_vat_output_account_id: settings.gl_sales_vat_output_account_id ?? null,
    gl_sales_cogs_account_id: settings.gl_sales_cogs_account_id ?? null,
    gl_sales_inventory_account_id: settings.gl_sales_inventory_account_id ?? null,
    procurement_gl_posting_enabled: Boolean(settings.procurement_gl_posting_enabled),
    procurement_budget_check_enabled: Boolean(settings.procurement_budget_check_enabled),
    procurement_fixed_asset_auto_serial_enabled: Boolean(settings.procurement_fixed_asset_auto_serial_enabled),
    gl_procurement_inventory_account_id: settings.gl_procurement_inventory_account_id ?? null,
    gl_procurement_grni_account_id: settings.gl_procurement_grni_account_id ?? null,
    gl_procurement_ap_account_id: settings.gl_procurement_ap_account_id ?? null,
    gl_procurement_vat_input_account_id: settings.gl_procurement_vat_input_account_id ?? null,
    gl_procurement_cash_account_id: settings.gl_procurement_cash_account_id ?? null,
    gl_procurement_bank_account_id: settings.gl_procurement_bank_account_id ?? null,
    gl_procurement_wht_payable_account_id: settings.gl_procurement_wht_payable_account_id ?? null,
    gl_procurement_expense_account_id: settings.gl_procurement_expense_account_id ?? null,
    gl_procurement_fixed_asset_account_id: settings.gl_procurement_fixed_asset_account_id ?? null,
  }
}

export default function FinanceSettings() {
  const { t } = useI18n()
  const { refresh } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const [form, setForm] = useState<FinanceSettingsForm>(EMPTY)
  const [accounts, setAccounts] = useState<GlAccount[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const canEdit = can('financesettings', 'edit')

  useEffect(() => {
    void api
      .get<ApiOk<{ settings: Settings }>>('/company/settings')
      .then(({ data }) => setForm(fromSettings(data.data.settings)))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
    void api
      .get<ApiOk<GlAccount[]>>('/gl-accounts', { params: { for_select: 1, status: 'active' }, silent: true })
      .then(({ data }) => setAccounts(data.data ?? []))
      .catch(() => setAccounts([]))
  }, [feedback, t])

  function toggle(key: keyof FinanceSettingsForm) {
    setForm((current) => ({ ...current, [key]: !current[key] }))
  }

  function accountSelect(key: keyof FinanceSettingsForm, label: MsgKey, disabled: boolean) {
    const value = form[key]
    return (
      <label className="block space-y-1 text-sm">
        <span className="text-muted">{t(label)}</span>
        <select
          className="w-full rounded-xl border border-line bg-fill px-3 py-2"
          disabled={!canEdit || disabled}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) =>
            setForm((current) => ({
              ...current,
              [key]: e.target.value ? Number(e.target.value) : null,
            }))
          }
        >
          <option value="">{t('glMappingNone')}</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.code} · {acc.name}
            </option>
          ))}
        </select>
      </label>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setError('')
    try {
      await api.put('/company/settings', { settings: form })
      await refresh()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('appFinance')} title={t('navFinanceSettings')} subtitle={t('financeSettingsSubtitle')} />
      <form onSubmit={(e) => void onSubmit(e)} className="max-w-3xl space-y-5">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('posSalesGlTitle')}</h3>
          <p className="text-xs text-muted">{t('posSalesGlHint')}</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={form.sales_gl_posting_enabled}
              onChange={() => toggle('sales_gl_posting_enabled')}
            />
            <span>{t('posSalesGlEnabled')}</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {accountSelect('gl_sales_cash_account_id', 'glMappingCash', !form.sales_gl_posting_enabled)}
            {accountSelect('gl_sales_bank_account_id', 'glMappingBank', !form.sales_gl_posting_enabled)}
            {accountSelect('gl_sales_ar_account_id', 'glMappingAr', !form.sales_gl_posting_enabled)}
            {accountSelect('gl_sales_revenue_account_id', 'glMappingRevenue', !form.sales_gl_posting_enabled)}
            {accountSelect('gl_sales_vat_output_account_id', 'glMappingVatOutput', !form.sales_gl_posting_enabled)}
            {accountSelect('gl_sales_cogs_account_id', 'glMappingCogs', !form.sales_gl_posting_enabled)}
            {accountSelect('gl_sales_inventory_account_id', 'glMappingInventory', !form.sales_gl_posting_enabled)}
          </div>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsGl')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit}
              checked={form.procurement_gl_posting_enabled}
              onChange={() => toggle('procurement_gl_posting_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementGlPostingEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementGlPostingEnabledHint')}</span>
            </span>
          </label>
          {form.procurement_gl_posting_enabled ? (
            <div className="grid gap-3 md:grid-cols-2">
              {accountSelect('gl_procurement_inventory_account_id', 'glMappingInventory', false)}
              {accountSelect('gl_procurement_grni_account_id', 'glMappingGrni', false)}
              {accountSelect('gl_procurement_ap_account_id', 'glMappingAp', false)}
              {accountSelect('gl_procurement_vat_input_account_id', 'glMappingVatInput', false)}
              {accountSelect('gl_procurement_cash_account_id', 'glMappingCash', false)}
              {accountSelect('gl_procurement_bank_account_id', 'glMappingBank', false)}
              {accountSelect('gl_procurement_wht_payable_account_id', 'glMappingWhtPayable', false)}
              {accountSelect('gl_procurement_expense_account_id', 'glMappingExpense', false)}
              {accountSelect('gl_procurement_fixed_asset_account_id', 'glMappingFixedAsset', false)}
            </div>
          ) : null}
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsBudget')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit}
              checked={form.procurement_budget_check_enabled}
              onChange={() => toggle('procurement_budget_check_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementBudgetCheckEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementBudgetCheckEnabledHint')}</span>
            </span>
          </label>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsFixedAssets')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit}
              checked={form.procurement_fixed_asset_auto_serial_enabled}
              onChange={() => toggle('procurement_fixed_asset_auto_serial_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementFixedAssetAutoSerialEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementFixedAssetAutoSerialEnabledHint')}</span>
            </span>
          </label>
        </section>

        {canEdit ? (
          <button type="submit" disabled={saving} className="btn-primary">
            {t('save')}
          </button>
        ) : null}
      </form>
    </div>
  )
}
