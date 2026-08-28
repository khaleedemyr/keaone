import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Settings } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAuth } from '../../auth'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'

type PurchaseSettingsForm = Pick<
  Settings,
  'purchase_flow' | 'purchase_update_cost' | 'pr_need_approval' | 'po_need_approval'
>

export default function PurchaseSettings() {
  const { t } = useI18n()
  const { refresh, me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canEdit = can('purchasesettings', 'edit')
  const [form, setForm] = useState<PurchaseSettingsForm>({
    purchase_flow: 'direct',
    purchase_update_cost: true,
    pr_need_approval: false,
    po_need_approval: false,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api
      .get<ApiOk<{ settings: Settings }>>('/company/settings')
      .then(({ data }) => {
        const settings = data.data.settings
        setForm({
          purchase_flow: settings.purchase_flow ?? 'direct',
          purchase_update_cost: settings.purchase_update_cost ?? true,
          pr_need_approval: settings.pr_need_approval ?? false,
          po_need_approval: settings.po_need_approval ?? false,
        })
      })
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setError('')
    try {
      await api.put('/company/settings', {
        settings: {
          purchase_flow: form.purchase_flow ?? 'direct',
          purchase_update_cost: Boolean(form.purchase_update_cost),
          pr_need_approval: Boolean(form.pr_need_approval),
          po_need_approval: Boolean(form.po_need_approval),
        },
      })
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

  return (
    <div>
      <PageHeader eyebrow={t('appPurchase')} title={t('purchaseSettingsTitle')} subtitle={t('purchaseSettingsHint')} />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className="glass max-w-xl space-y-3 rounded-3xl p-5">
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
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={Boolean(form.purchase_update_cost)}
              onChange={(e) => setForm({ ...form, purchase_update_cost: e.target.checked })}
            />
            {t('purchaseUpdateCost')}
          </label>
          {showPrApproval ? (
            <label className="flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1"
                disabled={!canEdit}
                checked={Boolean(form.pr_need_approval)}
                onChange={(e) => setForm({ ...form, pr_need_approval: e.target.checked })}
              />
              <span>
                <span className="text-fg">{t('purchasePrNeedApproval')}</span>
                <span className="mt-0.5 block text-xs">{t('purchasePrNeedApprovalHint')}</span>
              </span>
            </label>
          ) : null}
          {showPoApproval ? (
            <label className="flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1"
                disabled={!canEdit}
                checked={Boolean(form.po_need_approval)}
                onChange={(e) => setForm({ ...form, po_need_approval: e.target.checked })}
              />
              <span>
                <span className="text-fg">{t('purchasePoNeedApproval')}</span>
                <span className="mt-0.5 block text-xs">{t('purchasePoNeedApprovalHint')}</span>
              </span>
            </label>
          ) : null}
        </div>
        {canEdit ? (
          <button type="submit" disabled={saving} className="btn-primary">
            {t('save')}
          </button>
        ) : null}
      </form>
    </div>
  )
}
