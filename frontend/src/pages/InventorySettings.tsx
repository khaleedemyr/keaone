import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import type { ApiOk, InventoryCostingMethod, Settings } from '../types'
import { FormAlert, useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { useAuth } from '../auth'
import { useAccess } from '../access'
import { useI18n, type MsgKey } from '../i18n'

const METHODS: { id: InventoryCostingMethod; title: MsgKey; hint: MsgKey }[] = [
  { id: 'fifo', title: 'inventoryCostingFifo', hint: 'inventoryCostingFifoHint' },
  { id: 'average', title: 'inventoryCostingAverage', hint: 'inventoryCostingAverageHint' },
  { id: 'moving_average', title: 'inventoryCostingMovingAverage', hint: 'inventoryCostingMovingAverageHint' },
]

function resolveMethod(value: string | undefined): InventoryCostingMethod {
  if (value === 'fifo' || value === 'average' || value === 'moving_average') return value
  return 'moving_average'
}

export default function InventorySettings() {
  const { t } = useI18n()
  const { refresh } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const [method, setMethod] = useState<InventoryCostingMethod>('moving_average')
  const [allowNegative, setAllowNegative] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const canEdit = can('stocksettings', 'edit')

  useEffect(() => {
    void api
      .get<ApiOk<{ settings: Settings }>>('/company/settings')
      .then(({ data }) => {
        setMethod(resolveMethod(data.data.settings.inventory_costing_method))
        setAllowNegative(Boolean(data.data.settings.inventory_allow_negative_stock))
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
          inventory_costing_method: method,
          inventory_allow_negative_stock: allowNegative,
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
      <PageHeader eyebrow={t('appInventory')} title={t('inventorySettingsTitle')} subtitle={t('inventorySettingsHint')} />
      <form onSubmit={(e) => void onSubmit(e)} className="glass max-w-xl space-y-4 rounded-3xl p-5">
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className="text-sm text-muted">{t('inventoryCostingMethod')}</div>
        <p className="text-xs text-muted">{t('inventoryCostingHint')}</p>
        <div className="grid gap-3">
          {METHODS.map((item) => {
            const active = method === item.id
            return (
              <button
                key={item.id}
                type="button"
                disabled={!canEdit}
                onClick={() => setMethod(item.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  active ? 'border-mint bg-mint/10' : 'border-line hover:border-mint/40'
                } ${canEdit ? '' : 'cursor-default opacity-80'}`}
              >
                <div className="font-medium text-fg">{t(item.title)}</div>
                <div className="mt-1 text-xs text-muted">{t(item.hint)}</div>
              </button>
            )
          })}
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3">
          <input
            type="checkbox"
            className="mt-1"
            disabled={!canEdit}
            checked={allowNegative}
            onChange={(e) => setAllowNegative(e.target.checked)}
          />
          <span>
            <span className="block font-medium text-fg">{t('inventoryAllowNegative')}</span>
            <span className="mt-1 block text-xs text-muted">{t('inventoryAllowNegativeHint')}</span>
          </span>
        </label>

        {canEdit ? (
          <button type="submit" disabled={saving} className="btn-primary">
            {t('save')}
          </button>
        ) : null}
      </form>
    </div>
  )
}
