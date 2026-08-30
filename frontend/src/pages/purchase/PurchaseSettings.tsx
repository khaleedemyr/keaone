import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Settings, GlAccount } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAuth } from '../../auth'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'

type ProcurementSettingsForm = Pick<
  Settings,
  | 'purchase_flow'
  | 'purchase_update_cost'
  | 'po_auto_close_on_full_receive'
  | 'pr_need_approval'
  | 'po_need_approval'
  | 'return_enabled'
  | 'return_need_approval'
  | 'gr_reversal_enabled'
  | 'vendor_adjustment_enabled'
  | 'delivery_schedule_enabled'
  | 'procurement_attachments_enabled'
  | 'procurement_cost_center_enabled'
  | 'vendor_invoice_enabled'
  | 'vendor_invoice_need_approval'
  | 'vendor_payment_batch_need_approval'
  | 'vendor_prepayment_need_approval'
  | 'procurement_match_enabled'
  | 'procurement_two_way_match_enabled'
  | 'vendor_payment_batch_enabled'
  | 'vendor_prepayment_enabled'
  | 'procurement_withholding_tax_enabled'
  | 'procurement_gl_posting_enabled'
  | 'procurement_budget_check_enabled'
  | 'procurement_rfq_enabled'
  | 'procurement_vendor_price_list_enabled'
  | 'procurement_contract_enabled'
  | 'procurement_auto_reorder_enabled'
  | 'procurement_demand_planning_enabled'
  | 'procurement_annual_plan_enabled'
  | 'procurement_landed_cost_enabled'
  | 'procurement_approval_mode'
  | 'procurement_approval_parallel_enabled'
  | 'procurement_approval_delegation_enabled'
  | 'procurement_approval_escalation_enabled'
  | 'procurement_approval_sla_days'
  | 'procurement_sod_creator_approver'
  | 'procurement_sod_approver_receiver'
  | 'procurement_field_audit_enabled'
  | 'gl_procurement_inventory_account_id'
  | 'gl_procurement_grni_account_id'
  | 'gl_procurement_ap_account_id'
  | 'gl_procurement_vat_input_account_id'
  | 'gl_procurement_cash_account_id'
  | 'gl_procurement_bank_account_id'
  | 'gl_procurement_wht_payable_account_id'
  | 'gl_procurement_expense_account_id'
  | 'gl_procurement_fixed_asset_account_id'
  | 'procurement_match_qty_tolerance'
  | 'procurement_match_price_tolerance'
>

const DEFAULT_FORM: ProcurementSettingsForm = {
  purchase_flow: 'direct',
  purchase_update_cost: true,
  po_auto_close_on_full_receive: true,
  pr_need_approval: false,
  po_need_approval: false,
  return_enabled: true,
  return_need_approval: false,
  gr_reversal_enabled: false,
  vendor_adjustment_enabled: true,
  delivery_schedule_enabled: true,
  procurement_attachments_enabled: true,
  procurement_cost_center_enabled: true,
  vendor_invoice_enabled: false,
  vendor_invoice_need_approval: false,
  vendor_payment_batch_need_approval: false,
  vendor_prepayment_need_approval: false,
  procurement_match_enabled: false,
  procurement_two_way_match_enabled: false,
  vendor_payment_batch_enabled: false,
  vendor_prepayment_enabled: false,
  procurement_withholding_tax_enabled: false,
  procurement_gl_posting_enabled: false,
  procurement_budget_check_enabled: false,
  procurement_rfq_enabled: false,
  procurement_vendor_price_list_enabled: false,
  procurement_contract_enabled: false,
  procurement_auto_reorder_enabled: false,
  procurement_demand_planning_enabled: false,
  procurement_annual_plan_enabled: false,
  procurement_landed_cost_enabled: false,
  procurement_approval_mode: 'manual',
  procurement_approval_parallel_enabled: false,
  procurement_approval_delegation_enabled: false,
  procurement_approval_escalation_enabled: false,
  procurement_approval_sla_days: 3,
  procurement_sod_creator_approver: true,
  procurement_sod_approver_receiver: false,
  procurement_field_audit_enabled: true,
  gl_procurement_inventory_account_id: null,
  gl_procurement_grni_account_id: null,
  gl_procurement_ap_account_id: null,
  gl_procurement_vat_input_account_id: null,
  gl_procurement_cash_account_id: null,
  gl_procurement_bank_account_id: null,
  gl_procurement_wht_payable_account_id: null,
  gl_procurement_expense_account_id: null,
  gl_procurement_fixed_asset_account_id: null,
  procurement_match_qty_tolerance: 0,
  procurement_match_price_tolerance: 0,
}

function settingsToForm(settings: Settings): ProcurementSettingsForm {
  return {
    ...DEFAULT_FORM,
    purchase_flow: settings.purchase_flow ?? 'direct',
    purchase_update_cost: settings.purchase_update_cost ?? true,
    po_auto_close_on_full_receive: settings.po_auto_close_on_full_receive ?? true,
    pr_need_approval: settings.pr_need_approval ?? false,
    po_need_approval: settings.po_need_approval ?? false,
    return_enabled: settings.return_enabled ?? true,
    return_need_approval: settings.return_need_approval ?? false,
    gr_reversal_enabled: settings.gr_reversal_enabled ?? false,
    vendor_adjustment_enabled: settings.vendor_adjustment_enabled ?? true,
    delivery_schedule_enabled: settings.delivery_schedule_enabled ?? true,
    procurement_attachments_enabled: settings.procurement_attachments_enabled ?? true,
    procurement_cost_center_enabled: settings.procurement_cost_center_enabled ?? true,
    vendor_invoice_enabled: settings.vendor_invoice_enabled ?? false,
    vendor_invoice_need_approval: settings.vendor_invoice_need_approval ?? false,
    vendor_payment_batch_need_approval: settings.vendor_payment_batch_need_approval ?? false,
    vendor_prepayment_need_approval: settings.vendor_prepayment_need_approval ?? false,
    procurement_match_enabled: settings.procurement_match_enabled ?? false,
    procurement_two_way_match_enabled: settings.procurement_two_way_match_enabled ?? false,
    vendor_payment_batch_enabled: settings.vendor_payment_batch_enabled ?? false,
    vendor_prepayment_enabled: settings.vendor_prepayment_enabled ?? false,
    procurement_withholding_tax_enabled: settings.procurement_withholding_tax_enabled ?? false,
    procurement_gl_posting_enabled: settings.procurement_gl_posting_enabled ?? false,
    procurement_budget_check_enabled: settings.procurement_budget_check_enabled ?? false,
    procurement_rfq_enabled: settings.procurement_rfq_enabled ?? false,
    procurement_vendor_price_list_enabled: settings.procurement_vendor_price_list_enabled ?? false,
    procurement_contract_enabled: settings.procurement_contract_enabled ?? false,
    procurement_auto_reorder_enabled: settings.procurement_auto_reorder_enabled ?? false,
    procurement_demand_planning_enabled: settings.procurement_demand_planning_enabled ?? false,
    procurement_annual_plan_enabled: settings.procurement_annual_plan_enabled ?? false,
    procurement_landed_cost_enabled: settings.procurement_landed_cost_enabled ?? false,
    procurement_approval_mode: (settings.procurement_approval_mode as 'manual' | 'matrix') ?? 'manual',
    procurement_approval_parallel_enabled: settings.procurement_approval_parallel_enabled ?? false,
    procurement_approval_delegation_enabled: settings.procurement_approval_delegation_enabled ?? false,
    procurement_approval_escalation_enabled: settings.procurement_approval_escalation_enabled ?? false,
    procurement_approval_sla_days: settings.procurement_approval_sla_days ?? 3,
    procurement_sod_creator_approver: settings.procurement_sod_creator_approver ?? true,
    procurement_sod_approver_receiver: settings.procurement_sod_approver_receiver ?? false,
    procurement_field_audit_enabled: settings.procurement_field_audit_enabled ?? true,
    gl_procurement_inventory_account_id: settings.gl_procurement_inventory_account_id ?? null,
    gl_procurement_grni_account_id: settings.gl_procurement_grni_account_id ?? null,
    gl_procurement_ap_account_id: settings.gl_procurement_ap_account_id ?? null,
    gl_procurement_vat_input_account_id: settings.gl_procurement_vat_input_account_id ?? null,
    gl_procurement_cash_account_id: settings.gl_procurement_cash_account_id ?? null,
    gl_procurement_bank_account_id: settings.gl_procurement_bank_account_id ?? null,
    gl_procurement_wht_payable_account_id: settings.gl_procurement_wht_payable_account_id ?? null,
    gl_procurement_expense_account_id: settings.gl_procurement_expense_account_id ?? null,
    gl_procurement_fixed_asset_account_id: settings.gl_procurement_fixed_asset_account_id ?? null,
    procurement_match_qty_tolerance: settings.procurement_match_qty_tolerance ?? 0,
    procurement_match_price_tolerance: settings.procurement_match_price_tolerance ?? 0,
  }
}

export default function PurchaseSettings() {
  const { t } = useI18n()
  const { refresh, me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canEdit = can('purchasesettings', 'edit')
  const [form, setForm] = useState<ProcurementSettingsForm>(DEFAULT_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([])

  useEffect(() => {
    let cancelled = false
    void api
      .get<ApiOk<{ settings: Settings }>>('/company/settings')
      .then(({ data }) => {
        if (!cancelled) setForm(settingsToForm(data.data.settings))
      })
      .catch((err) => {
        if (!cancelled) feedback.error(apiMessage(err, t('loadFailed')))
      })
    void api
      .get<ApiOk<GlAccount[]>>('/gl-accounts', { params: { for_select: 1, status: 'active' }, silent: true })
      .then(({ data }) => {
        if (!cancelled) setGlAccounts(data.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setGlAccounts([])
      })
    return () => {
      cancelled = true
    }
  }, [feedback, t])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setError('')
    try {
      const { data } = await api.put<ApiOk<{ settings: Settings }>>('/company/settings', { settings: form })
      setForm(settingsToForm(data.data.settings))
      await refresh()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  const flow = form.purchase_flow ?? me?.settings?.purchase_flow
  const showPrApproval = flow === 'strict_pr_po_gr'
  const showPoApproval = flow === 'strict_pr_po_gr' || flow === 'po_gr'

  function toggle(key: keyof ProcurementSettingsForm) {
    setForm({ ...form, [key]: !form[key] })
  }

  function setAccountId(key: keyof ProcurementSettingsForm, value: string) {
    setForm({ ...form, [key]: value ? Number(value) : null })
  }

  function accountSelect(
    key: keyof ProcurementSettingsForm,
    label: MsgKey,
    disabled: boolean,
  ) {
    const current = form[key]
    return (
      <label className="block text-sm text-muted">
        {t(label)}
        <select
          className="field"
          disabled={!canEdit || disabled}
          value={current != null ? String(current) : ''}
          onChange={(e) => setAccountId(key, e.target.value)}
        >
          <option value="">{t('glMappingNone')}</option>
          {glAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.code} — {acc.name}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div>
      <PageHeader eyebrow={t('appProcurement')} title={t('procurementSettingsTitle')} subtitle={t('procurementSettingsHint')} />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 max-w-2xl">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsFlow')}</h3>
          <label className="block text-sm text-muted">
            {t('purchaseFlow')}
            <select
              className="field"
              disabled={!canEdit}
              value={form.purchase_flow ?? 'direct'}
              onChange={(e) => {
                const next = e.target.value as Settings['purchase_flow']
                setForm({
                  ...form,
                  purchase_flow: next,
                  pr_need_approval: next === 'strict_pr_po_gr' ? form.pr_need_approval : false,
                  po_need_approval: next === 'strict_pr_po_gr' || next === 'po_gr' ? form.po_need_approval : false,
                })
              }}
            >
              <option value="direct">{t('purchaseFlowDirect')}</option>
              <option value="po_gr">{t('purchaseFlowPoGr')}</option>
              <option value="strict_pr_po_gr">{t('purchaseFlowStrict')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" disabled={!canEdit} checked={Boolean(form.purchase_update_cost)} onChange={() => toggle('purchase_update_cost')} />
            {t('purchaseUpdateCost')}
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" disabled={!canEdit} checked={Boolean(form.po_auto_close_on_full_receive)} onChange={() => toggle('po_auto_close_on_full_receive')} />
            {t('procurementPoAutoClose')}
          </label>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsApprovals')}</h3>
          {showPrApproval ? (
            <label className="flex items-start gap-2 text-sm text-muted">
              <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.pr_need_approval)} onChange={() => toggle('pr_need_approval')} />
              <span>
                <span className="text-fg">{t('purchasePrNeedApproval')}</span>
                <span className="mt-0.5 block text-xs">{t('purchasePrNeedApprovalHint')}</span>
              </span>
            </label>
          ) : null}
          {showPoApproval ? (
            <label className="flex items-start gap-2 text-sm text-muted">
              <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.po_need_approval)} onChange={() => toggle('po_need_approval')} />
              <span>
                <span className="text-fg">{t('purchasePoNeedApproval')}</span>
                <span className="mt-0.5 block text-xs">{t('purchasePoNeedApprovalHint')}</span>
              </span>
            </label>
          ) : null}
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit || !form.return_enabled} checked={Boolean(form.return_need_approval)} onChange={() => toggle('return_need_approval')} />
            <span>
              <span className="text-fg">{t('procurementReturnNeedApproval')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementReturnNeedApprovalHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted opacity-70">
            <input type="checkbox" className="mt-1" disabled={!canEdit || !form.vendor_invoice_enabled} checked={Boolean(form.vendor_invoice_need_approval)} onChange={() => toggle('vendor_invoice_need_approval')} />
            <span>
              <span className="text-fg">{t('procurementInvoiceNeedApproval')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementInvoiceNeedApprovalHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted opacity-70">
            <input type="checkbox" className="mt-1" disabled={!canEdit || !form.vendor_payment_batch_enabled} checked={Boolean(form.vendor_payment_batch_need_approval)} onChange={() => toggle('vendor_payment_batch_need_approval')} />
            <span>
              <span className="text-fg">{t('procurementPaymentBatchNeedApproval')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementPaymentBatchNeedApprovalHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted opacity-70">
            <input type="checkbox" className="mt-1" disabled={!canEdit || !form.vendor_prepayment_enabled} checked={Boolean(form.vendor_prepayment_need_approval)} onChange={() => toggle('vendor_prepayment_need_approval')} />
            <span>
              <span className="text-fg">{t('procurementPrepaymentNeedApproval')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementPrepaymentNeedApprovalHint')}</span>
            </span>
          </label>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsGovernance')}</h3>
          <label className="block text-sm text-muted">
            <span className="text-fg">{t('procurementApprovalMode')}</span>
            <select
              className="field mt-1"
              disabled={!canEdit}
              value={form.procurement_approval_mode}
              onChange={(e) => setForm((current) => ({ ...current, procurement_approval_mode: e.target.value as 'manual' | 'matrix' }))}
            >
              <option value="manual">{t('procurementApprovalModeManual')}</option>
              <option value="matrix">{t('procurementApprovalModeMatrix')}</option>
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_approval_parallel_enabled)} onChange={() => toggle('procurement_approval_parallel_enabled')} />
            <span>
              <span className="text-fg">{t('procurementApprovalParallelEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementApprovalParallelEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_approval_delegation_enabled)} onChange={() => toggle('procurement_approval_delegation_enabled')} />
            <span>
              <span className="text-fg">{t('procurementApprovalDelegationEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementApprovalDelegationEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_approval_escalation_enabled)} onChange={() => toggle('procurement_approval_escalation_enabled')} />
            <span>
              <span className="text-fg">{t('procurementApprovalEscalationEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementApprovalEscalationEnabledHint')}</span>
            </span>
          </label>
          <label className="block text-sm text-muted">
            <span className="text-fg">{t('procurementApprovalSlaDays')}</span>
            <input
              type="number"
              min={1}
              className="field mt-1 w-32"
              disabled={!canEdit}
              value={form.procurement_approval_sla_days}
              onChange={(e) => setForm((current) => ({ ...current, procurement_approval_sla_days: Number(e.target.value || 1) }))}
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_sod_creator_approver)} onChange={() => toggle('procurement_sod_creator_approver')} />
            <span>
              <span className="text-fg">{t('procurementSodCreatorApprover')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementSodCreatorApproverHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_sod_approver_receiver)} onChange={() => toggle('procurement_sod_approver_receiver')} />
            <span>
              <span className="text-fg">{t('procurementSodApproverReceiver')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementSodApproverReceiverHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_field_audit_enabled)} onChange={() => toggle('procurement_field_audit_enabled')} />
            <span>
              <span className="text-fg">{t('procurementFieldAuditEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementFieldAuditEnabledHint')}</span>
            </span>
          </label>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsFeatures')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.return_enabled)} onChange={() => toggle('return_enabled')} />
            <span>
              <span className="text-fg">{t('procurementReturnEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementReturnEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.gr_reversal_enabled)} onChange={() => toggle('gr_reversal_enabled')} />
            <span>
              <span className="text-fg">{t('procurementGrReversalEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementGrReversalEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.vendor_adjustment_enabled)} onChange={() => toggle('vendor_adjustment_enabled')} />
            <span>
              <span className="text-fg">{t('procurementAdjustmentEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementAdjustmentEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.delivery_schedule_enabled)} onChange={() => toggle('delivery_schedule_enabled')} />
            <span>
              <span className="text-fg">{t('procurementDeliveryEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementDeliveryEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_attachments_enabled)} onChange={() => toggle('procurement_attachments_enabled')} />
            <span>
              <span className="text-fg">{t('procurementAttachmentsEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementAttachmentsEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_cost_center_enabled)} onChange={() => toggle('procurement_cost_center_enabled')} />
            <span>
              <span className="text-fg">{t('procurementCostCenterEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementCostCenterEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted opacity-70">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.vendor_invoice_enabled)} onChange={() => toggle('vendor_invoice_enabled')} />
            <span>
              <span className="text-fg">{t('procurementInvoiceEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementInvoiceEnabledHint')}</span>
            </span>
          </label>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsMatching')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_match_enabled)} onChange={() => toggle('procurement_match_enabled')} />
            <span>
              <span className="text-fg">{t('procurementMatchEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementMatchEnabledHint')}</span>
            </span>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-muted">
              {t('procurementMatchQtyTolerance')}
              <input
                className="field"
                type="number"
                min={0}
                max={100}
                disabled={!canEdit || !form.procurement_match_enabled}
                value={form.procurement_match_qty_tolerance ?? 0}
                onChange={(e) => setForm({ ...form, procurement_match_qty_tolerance: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="block text-sm text-muted">
              {t('procurementMatchPriceTolerance')}
              <input
                className="field"
                type="number"
                min={0}
                max={100}
                disabled={!canEdit || !form.procurement_match_enabled}
                value={form.procurement_match_price_tolerance ?? 0}
                onChange={(e) => setForm({ ...form, procurement_match_price_tolerance: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-muted opacity-70">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit || !form.procurement_match_enabled}
              checked={Boolean(form.procurement_two_way_match_enabled)}
              onChange={() => toggle('procurement_two_way_match_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementTwoWayMatchEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementTwoWayMatchEnabledHint')}</span>
            </span>
          </label>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsPayments')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted opacity-70">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit || !form.vendor_invoice_enabled}
              checked={Boolean(form.vendor_payment_batch_enabled)}
              onChange={() => toggle('vendor_payment_batch_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementPaymentBatchEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementPaymentBatchEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted opacity-70">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit || !form.vendor_invoice_enabled}
              checked={Boolean(form.vendor_prepayment_enabled)}
              onChange={() => toggle('vendor_prepayment_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementPrepaymentEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementPrepaymentEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted opacity-70">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit || !form.vendor_invoice_enabled}
              checked={Boolean(form.procurement_withholding_tax_enabled)}
              onChange={() => toggle('procurement_withholding_tax_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementWithholdingEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementWithholdingEnabledHint')}</span>
            </span>
          </label>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsGl')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted opacity-70">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit || !form.vendor_invoice_enabled}
              checked={Boolean(form.procurement_gl_posting_enabled)}
              onChange={() => toggle('procurement_gl_posting_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementGlPostingEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementGlPostingEnabledHint')}</span>
            </span>
          </label>
          {form.procurement_gl_posting_enabled ? (
            <div className="grid gap-3 md:grid-cols-2">
              {accountSelect('gl_procurement_inventory_account_id', 'glMappingInventory', !form.procurement_gl_posting_enabled)}
              {accountSelect('gl_procurement_grni_account_id', 'glMappingGrni', !form.procurement_gl_posting_enabled)}
              {accountSelect('gl_procurement_ap_account_id', 'glMappingAp', !form.procurement_gl_posting_enabled)}
              {accountSelect('gl_procurement_vat_input_account_id', 'glMappingVatInput', !form.procurement_gl_posting_enabled)}
              {accountSelect('gl_procurement_cash_account_id', 'glMappingCash', !form.procurement_gl_posting_enabled)}
              {accountSelect('gl_procurement_bank_account_id', 'glMappingBank', !form.procurement_gl_posting_enabled)}
              {accountSelect('gl_procurement_wht_payable_account_id', 'glMappingWhtPayable', !form.procurement_gl_posting_enabled)}
              {accountSelect('gl_procurement_expense_account_id', 'glMappingExpense', !form.procurement_gl_posting_enabled)}
              {accountSelect('gl_procurement_fixed_asset_account_id', 'glMappingFixedAsset', !form.procurement_gl_posting_enabled)}
            </div>
          ) : null}
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsSourcing')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit}
              checked={Boolean(form.procurement_rfq_enabled)}
              onChange={() => toggle('procurement_rfq_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementRfqEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementRfqEnabledHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit}
              checked={Boolean(form.procurement_vendor_price_list_enabled)}
              onChange={() => toggle('procurement_vendor_price_list_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementVendorPriceListEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementVendorPriceListEnabledHint')}</span>
            </span>
          </label>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsPlanning')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_contract_enabled)} onChange={() => toggle('procurement_contract_enabled')} />
            <span><span className="text-fg">{t('procurementContractEnabled')}</span><span className="mt-0.5 block text-xs">{t('procurementContractEnabledHint')}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_auto_reorder_enabled)} onChange={() => toggle('procurement_auto_reorder_enabled')} />
            <span><span className="text-fg">{t('procurementAutoReorderEnabled')}</span><span className="mt-0.5 block text-xs">{t('procurementAutoReorderEnabledHint')}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_demand_planning_enabled)} onChange={() => toggle('procurement_demand_planning_enabled')} />
            <span><span className="text-fg">{t('procurementDemandPlanningEnabled')}</span><span className="mt-0.5 block text-xs">{t('procurementDemandPlanningEnabledHint')}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_annual_plan_enabled)} onChange={() => toggle('procurement_annual_plan_enabled')} />
            <span><span className="text-fg">{t('procurementAnnualPlanEnabled')}</span><span className="mt-0.5 block text-xs">{t('procurementAnnualPlanEnabledHint')}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(form.procurement_landed_cost_enabled)} onChange={() => toggle('procurement_landed_cost_enabled')} />
            <span><span className="text-fg">{t('procurementLandedCostEnabled')}</span><span className="mt-0.5 block text-xs">{t('procurementLandedCostEnabledHint')}</span></span>
          </label>
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-fg">{t('procurementSettingsBudget')}</h3>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!canEdit}
              checked={Boolean(form.procurement_budget_check_enabled)}
              onChange={() => toggle('procurement_budget_check_enabled')}
            />
            <span>
              <span className="text-fg">{t('procurementBudgetCheckEnabled')}</span>
              <span className="mt-0.5 block text-xs">{t('procurementBudgetCheckEnabledHint')}</span>
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
