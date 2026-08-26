import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, PosMode, Settings } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAuth } from '../../auth'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'

const MODES: { id: PosMode; title: MsgKey; hint: MsgKey }[] = [
  { id: 'retail', title: 'posModeRetail', hint: 'posModeRetailHint' },
  { id: 'restaurant', title: 'posModeRestaurant', hint: 'posModeRestaurantHint' },
  { id: 'cafe', title: 'posModeCafe', hint: 'posModeCafeHint' },
]

export default function PosSettings() {
  const { t } = useI18n()
  const { refresh } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const [mode, setMode] = useState<PosMode>('retail')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const canEdit = can('possettings', 'edit')

  useEffect(() => {
    void api
      .get<ApiOk<{ settings: Settings }>>('/company/settings')
      .then(({ data }) => setMode(data.data.settings.pos_mode ?? 'retail'))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setError('')
    try {
      await api.put('/company/settings', { settings: { pos_mode: mode } })
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
      <PageHeader eyebrow={t('appSettings')} title={t('navPosSettings')} subtitle={t('posSettingsSubtitle')} />
      <form onSubmit={(e) => void onSubmit(e)} className="glass max-w-xl space-y-4 rounded-3xl p-5">
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className="text-sm text-muted">{t('posMode')}</div>
        <div className="grid gap-3">
          {MODES.map((item) => {
            const active = mode === item.id
            return (
              <button
                key={item.id}
                type="button"
                disabled={!canEdit}
                onClick={() => setMode(item.id)}
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
        {canEdit ? (
          <button type="submit" disabled={saving} className="btn-primary">
            {t('save')}
          </button>
        ) : null}
      </form>
    </div>
  )
}
