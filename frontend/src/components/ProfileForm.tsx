import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage, apiUpload } from '../api/client'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import type { ApiOk, MePayload } from '../types'
import { Avatar } from './Avatar'
import { FormAlert, useFeedback } from './feedback'

export function ProfileForm() {
  const { t } = useI18n()
  const { me, refresh } = useAuth()
  const feedback = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: me?.user.name ?? '',
    email: me?.user.email ?? '',
    username: me?.user.username ?? '',
    phone: me?.user.phone ?? '',
  })
  const [pass, setPass] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [error, setError] = useState('')
  const [passError, setPassError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function onProfile(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put('/me', {
        name: form.name,
        email: form.email,
        username: form.username.trim() || null,
        phone: form.phone.trim() || null,
      })
      await refresh()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function onPassword(event: FormEvent) {
    event.preventDefault()
    setSavingPass(true)
    setPassError('')
    try {
      await api.put('/me/password', pass)
      setPass({ current_password: '', password: '', password_confirmation: '' })
      feedback.success(t('passwordChanged'))
    } catch (err) {
      setPassError(apiMessage(err, t('saveFailed')))
    } finally {
      setSavingPass(false)
    }
  }

  async function onAvatar(file: File | undefined) {
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      feedback.error(t('avatarTooLarge'))
      return
    }
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file, file.name)
      await apiUpload<ApiOk<MePayload>>('/me/avatar', body, 60000)
      await refresh()
      feedback.success(t('avatarApplied'))
    } catch (err) {
      feedback.error(apiMessage(err, t('avatarFailed')))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={(e) => void onProfile(e)} className="glass space-y-3 rounded-3xl p-5">
        <h3 className="font-medium">{t('navProfile')}</h3>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className="flex items-center gap-4">
          <Avatar name={form.name || me?.user.name || ''} src={me?.user.avatar} size="lg" />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => void onAvatar(event.target.files?.[0])}
            />
            <button
              type="button"
              className="btn-ghost"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {t('avatarChange')}
            </button>
            <p className="mt-2 text-xs text-muted">{t('avatarHint')}</p>
          </div>
        </div>
        <label className="block text-sm text-muted">
          {t('name')}
          <input required className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block text-sm text-muted">
          {t('email')}
          <input required type="email" className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="block text-sm text-muted">
          {t('username')}
          <input className="field" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label className="block text-sm text-muted">
          {t('phone')}
          <input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <button type="submit" disabled={saving} className="btn-primary">
          {t('save')}
        </button>
      </form>

      <form onSubmit={(e) => void onPassword(e)} className="glass space-y-3 rounded-3xl p-5">
        <h3 className="font-medium">{t('password')}</h3>
        {passError ? <FormAlert>{passError}</FormAlert> : null}
        <label className="block text-sm text-muted">
          {t('currentPassword')}
          <input required type="password" className="field" value={pass.current_password} onChange={(e) => setPass({ ...pass, current_password: e.target.value })} />
        </label>
        <label className="block text-sm text-muted">
          {t('newPassword')}
          <input required minLength={8} type="password" className="field" value={pass.password} onChange={(e) => setPass({ ...pass, password: e.target.value })} />
        </label>
        <label className="block text-sm text-muted">
          {t('confirmPassword')}
          <input required minLength={8} type="password" className="field" value={pass.password_confirmation} onChange={(e) => setPass({ ...pass, password_confirmation: e.target.value })} />
        </label>
        <button type="submit" disabled={savingPass} className="btn-primary">
          {t('save')}
        </button>
      </form>
    </div>
  )
}
