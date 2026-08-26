import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiMessage } from '../api/client'
import { useAuth } from '../auth'
import { BusinessTypeField } from '../components/BusinessTypeField'
import { FormAlert } from '../components/feedback'
import { Logo } from '../components/Logo'
import { PrefsBar } from '../components/PrefsBar'
import { useI18n } from '../i18n'

export default function NoCompany() {
  const { t } = useI18n()
  const { createCompany, logout } = useAuth()
  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState('retail')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createCompany(name, businessType)
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <PrefsBar />
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="glass w-full max-w-md rounded-3xl p-6">
        <Logo className="mb-4 h-12 w-12" />
        <h1 className="font-display text-2xl font-bold">{t('noCompanyTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t('noCompanyLead')}</p>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <label className="mt-4 block text-sm text-muted">
          {t('companyName')}
          <input required className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="mt-3">
          <BusinessTypeField value={businessType} onChange={setBusinessType} />
        </div>
        <button type="submit" disabled={saving} className="btn-primary mt-4 w-full">
          {t('createCompany')}
        </button>
        <button type="button" className="btn-ghost mt-2 w-full" onClick={() => void logout()}>
          {t('logout')}
        </button>
      </form>
    </div>
  )
}
