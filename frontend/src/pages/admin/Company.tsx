import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage, apiUpload } from '../../api/client'
import type { ApiOk, Company } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAuth } from '../../auth'
import { BusinessTypeField } from '../../components/BusinessTypeField'
import { useI18n } from '../../i18n'

export default function AdminCompany() {
  const { t } = useI18n()
  const { refresh } = useAuth()
  const feedback = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ name: '', business_type: 'retail', phone: '', address: '' })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    void api
      .get<ApiOk<Company>>('/company')
      .then(({ data }) => {
        const company = data.data
        setForm({
          name: company.name,
          business_type: company.business_type,
          phone: company.phone ?? '',
          address: company.address ?? '',
        })
        setLogoUrl(company.logo ?? null)
      })
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put('/company', {
        name: form.name,
        business_type: form.business_type,
        phone: form.phone || null,
        address: form.address || null,
      })
      await refresh()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      feedback.error(t('avatarTooLarge'))
      return
    }
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file, file.name)
      const data = await apiUpload<ApiOk<Company>>('/company/logo', body, 60000)
      setLogoUrl(data.data.logo ?? null)
      await refresh()
      feedback.success(t('receiptLogoApplied'))
    } catch (err) {
      feedback.error(apiMessage(err, t('receiptLogoFailed')))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onRemoveLogo() {
    setUploading(true)
    try {
      await api.delete('/company/logo')
      setLogoUrl(null)
      await refresh()
      feedback.success(t('receiptLogoApplied'))
    } catch (err) {
      feedback.error(apiMessage(err, t('receiptLogoFailed')))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('appAdmin')} title={t('navCompany')} subtitle={t('companySubtitle')} />
      <form onSubmit={(e) => void onSubmit(e)} className="glass max-w-xl space-y-3 rounded-3xl p-5">
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-fill">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-[10px] text-muted">{t('receiptLogoEmpty')}</span>
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => void onLogo(event.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {t('receiptUploadLogo')}
              </button>
              {logoUrl ? (
                <button type="button" className="btn-ghost text-rose-300" disabled={uploading} onClick={() => void onRemoveLogo()}>
                  {t('receiptRemoveLogo')}
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted">{t('avatarHint')}</p>
          </div>
        </div>
        <label className="block text-sm text-muted">
          {t('name')}
          <input required className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <BusinessTypeField
          value={form.business_type}
          onChange={(slug) => setForm({ ...form, business_type: slug })}
        />
        <label className="block text-sm text-muted">
          {t('phone')}
          <input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="block text-sm text-muted">
          {t('address')}
          <textarea className="field min-h-24" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <button type="submit" disabled={saving} className="btn-primary">
          {t('save')}
        </button>
      </form>
    </div>
  )
}
