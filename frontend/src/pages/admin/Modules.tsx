import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Modules } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'
import { MODULE_KEYS, MODULE_LABELS } from '../../lib/modules'

export default function AdminModules() {
  const { t } = useI18n()
  const { refresh, me } = useAuth()
  const feedback = useFeedback()
  const [modules, setModules] = useState<Modules | null>(null)
  const [saving, setSaving] = useState(false)
  const allowed = me?.billing?.plan?.modules

  useEffect(() => {
    void api
      .get<ApiOk<{ modules: Modules }>>('/company/settings')
      .then(({ data }) => setModules(data.data.modules))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  async function toggle(id: keyof Modules) {
    if (!modules) return
    if (allowed && !allowed[id]) {
      feedback.warning(t('moduleLocked'))
      return
    }
    const next = { ...modules, [id]: !modules[id] }
    setModules(next)
    setSaving(true)
    try {
      await api.put('/company/settings', { modules: next })
      await refresh()
      feedback.success(t('saved'))
    } catch (err) {
      setModules(modules)
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('appAdmin')} title={t('navModules')} subtitle={t('modulesSubtitle')} />
      <div className="max-w-xl space-y-2">
        {modules
          ? MODULE_KEYS.map((id) => {
              const locked = Boolean(allowed && !allowed[id])
              return (
              <button
                key={id}
                type="button"
                disabled={saving || locked}
                onClick={() => void toggle(id)}
                className="glass flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left disabled:opacity-70"
                title={locked ? t('moduleLocked') : undefined}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t(MODULE_LABELS[id])}</span>
                  {locked ? (
                    <span className="mt-0.5 block text-[11px] text-muted">{t('moduleLocked')}</span>
                  ) : null}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${
                    modules[id] ? 'bg-mint/15 text-mint' : 'bg-fill text-muted'
                  }`}
                >
                  {modules[id] ? t('active') : t('inactive')}
                </span>
              </button>
              )
            })
          : null}
      </div>
    </div>
  )
}
