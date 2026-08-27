import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Settings } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAuth } from '../../auth'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import { defaultReceiptLayout, normalizeReceiptLayout } from '../../lib/receiptLayout'
import { ReceiptDesigner } from './ReceiptDesigner'

export default function AdminOperations() {
  const { t } = useI18n()
  const { refresh } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canEdit = can('ops', 'edit')
  const [form, setForm] = useState<Settings>({
    tax_percent: 0,
    allow_credit: true,
    receipt_width: 80,
    receipt_footer: '',
    receipt_layout: defaultReceiptLayout(),
    purchase_flow: 'direct',
    purchase_update_cost: true,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api
      .get<ApiOk<{ settings: Settings }>>('/company/settings')
      .then(({ data }) => {
        const settings = data.data.settings
        setForm({
          ...settings,
          receipt_layout: normalizeReceiptLayout(settings.receipt_layout, settings),
          purchase_flow: settings.purchase_flow ?? 'direct',
          purchase_update_cost: settings.purchase_update_cost ?? true,
        })
      })
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setError('')
    const footer = form.receipt_layout?.blocks.find((block) => block.kind === 'footer')?.text ?? form.receipt_footer
    try {
      await api.put('/company/settings', {
        settings: {
          tax_percent: Number(form.tax_percent),
          allow_credit: form.allow_credit,
          receipt_width: Number(form.receipt_layout?.width ?? form.receipt_width),
          receipt_footer: footer,
          receipt_layout: form.receipt_layout,
          purchase_flow: form.purchase_flow ?? 'direct',
          purchase_update_cost: Boolean(form.purchase_update_cost),
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

  return (
    <div>
      <PageHeader eyebrow={t('appAdmin')} title={t('navOps')} subtitle={t('opsSubtitle')} />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className="glass max-w-xl space-y-3 rounded-3xl p-5">
          <label className="block text-sm text-muted">
            {t('taxPercent')}
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="field"
              disabled={!canEdit}
              value={form.tax_percent}
              onChange={(e) => setForm({ ...form, tax_percent: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={form.allow_credit}
              onChange={(e) => setForm({ ...form, allow_credit: e.target.checked })}
            />
            {t('allowCredit')}
          </label>
        </div>

        <div className="glass max-w-xl space-y-3 rounded-3xl p-5">
          <div>
            <div className="font-display text-lg font-bold">{t('purchaseSettingsTitle')}</div>
            <p className="mt-1 text-sm text-muted">{t('purchaseSettingsHint')}</p>
          </div>
          <label className="block text-sm text-muted">
            {t('purchaseFlow')}
            <select
              className="field"
              disabled={!canEdit}
              value={form.purchase_flow ?? 'direct'}
              onChange={(e) =>
                setForm({
                  ...form,
                  purchase_flow: e.target.value as Settings['purchase_flow'],
                })
              }
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
        </div>

        <div className="glass space-y-3 rounded-3xl p-5">
          <div>
            <div className="font-display text-lg font-bold">{t('receiptDesigner')}</div>
            <p className="mt-1 text-sm text-muted">{t('receiptDesignerHint')}</p>
          </div>
          {form.receipt_layout ? (
            <ReceiptDesigner
              layout={form.receipt_layout}
              canEdit={canEdit}
              onChange={(receipt_layout) => setForm({ ...form, receipt_layout, receipt_width: receipt_layout.width })}
            />
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
