import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import QRCode from 'qrcode'
import { motion } from 'framer-motion'
import { apiMessage } from '../../api/client'
import { useAuth } from '../../auth'
import { AuthShell } from '../../components/AuthShell'
import { FormAlert } from '../../components/feedback'
import { Logo } from '../../components/Logo'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { invitePublicUrl } from './inviteShare'

export type PublicInvite = {
  token: string
  company_name?: string | null
  company_logo?: string | null
  role?: string
  role_name?: string | null
  email?: string | null
  label?: string | null
  is_personal?: boolean
  is_reusable?: boolean
  expires_at?: string | null
  is_acceptable?: boolean
  status: 'active' | 'expired' | 'revoked' | 'exhausted'
}

const emptyBiodata = {
  name: '',
  email: '',
  password: '',
  phone: '',
  national_id: '',
  tax_id: '',
  birth_date: '',
  birth_place: '',
  gender: '',
  marital_status: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
}

export default function PublicInviteView({ token }: { token: string }) {
  const { t } = useI18n()
  const { me, loading: authLoading, acceptInvite } = useAuth()
  const [invite, setInvite] = useState<PublicInvite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [form, setForm] = useState(emptyBiodata)

  useEffect(() => {
    setLoading(true)
    setError('')
    void axios
      .get<ApiOk<PublicInvite>>(`/api/v1/public/invites/${token}`)
      .then(async ({ data }) => {
        setInvite(data.data)
        setForm((current) => ({
          ...current,
          email: data.data.email ?? current.email,
          name: me?.user.name ?? current.name,
        }))
        const url = invitePublicUrl(token)
        const qr = await QRCode.toDataURL(url, { margin: 1, width: 180 })
        setQrDataUrl(qr)
      })
      .catch(() => setError(t('inviteLoadFailed')))
      .finally(() => setLoading(false))
  }, [token, t, me?.user.name])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await acceptInvite({
        token,
        name: form.name.trim(),
        email: form.email.trim(),
        password: me ? undefined : form.password,
        phone: form.phone.trim(),
        national_id: form.national_id.trim(),
        tax_id: form.tax_id.trim() || undefined,
        birth_date: form.birth_date,
        birth_place: form.birth_place.trim(),
        gender: form.gender,
        marital_status: form.marital_status || undefined,
        address: form.address.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
      })
      if ('pendingHr' in result && result.pendingHr) {
        setCompanyName(result.companyName ?? invite?.company_name ?? '')
        setSubmitted(true)
        return
      }
    } catch (err) {
      setSubmitError(apiMessage(err, t('inviteAcceptFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  const statusMessage =
    invite?.status === 'expired'
      ? t('inviteExpired')
      : invite?.status === 'revoked'
        ? t('inviteRevoked')
        : invite?.status === 'exhausted'
          ? t('inviteExhausted')
          : ''

  if (submitted) {
    return (
      <AuthShell>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-md text-center">
          <Logo variant="wordmark" className="mx-auto h-14 w-[116px]" glow />
          <h1 className="font-display mt-6 text-2xl font-bold">{t('invitePendingTitle')}</h1>
          <p className="mt-3 text-sm text-muted">{t('invitePendingLead', { company: companyName })}</p>
          <Link to="/login" className="btn-primary mt-6 inline-flex">
            {t('signIn')}
          </Link>
        </motion.div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo variant="wordmark" className="h-14 w-[116px]" glow />
          <h1 className="font-display mt-5 text-2xl font-bold">{t('inviteJoinTitle')}</h1>
          <p className="mt-2 max-w-lg text-sm text-muted">{t('inviteEmployeeSelfLead')}</p>
        </div>

        {loading ? <p className="text-center text-sm text-muted">{t('loading')}</p> : null}
        {error ? <FormAlert>{error}</FormAlert> : null}

        {!loading && invite ? (
          <div className="glass rounded-3xl p-6">
            <div className="mb-4 flex items-center gap-3">
              {invite.company_logo ? (
                <img src={invite.company_logo} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint/15 text-lg font-bold text-mint">
                  {(invite.company_name ?? '?').charAt(0)}
                </div>
              )}
              <div className="min-w-0 text-left">
                <p className="truncate text-lg font-semibold">{invite.company_name}</p>
                <p className="text-sm text-muted">
                  {t('inviteRoleLabel')}: {invite.role_name ?? invite.role}
                </p>
              </div>
            </div>

            {invite.email ? (
              <p className="mb-4 rounded-xl bg-fill px-3 py-2 text-xs text-muted">{t('inviteEmailLocked', { email: invite.email })}</p>
            ) : null}

            {!invite.is_acceptable ? <FormAlert>{statusMessage}</FormAlert> : null}

            {invite.is_acceptable && !authLoading ? (
              <form onSubmit={(e) => void onSubmit(e)}>
                {!me ? (
                  <p className="mb-4 text-sm text-muted">{t('inviteRegisterLead')}</p>
                ) : (
                  <p className="mb-4 text-sm text-muted">{t('inviteLoggedInAs', { name: me.user.name, email: me.user.email })}</p>
                )}
                {submitError ? <FormAlert>{submitError}</FormAlert> : null}

                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('sectionAccount')}</h3>
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-muted sm:col-span-2">
                    {t('name')}
                    <input required className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} readOnly={!!me} />
                  </label>
                  <label className="text-sm text-muted">
                    {t('email')}
                    <input required type="email" readOnly={!!invite.email || !!me} className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </label>
                  {!me ? (
                    <label className="text-sm text-muted">
                      {t('password')}
                      <input required minLength={8} type="password" className="field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </label>
                  ) : null}
                  <label className="text-sm text-muted">
                    {t('phone')}
                    <input required className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                </div>

                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('sectionBiodata')}</h3>
                <p className="mb-3 text-xs text-muted">{t('inviteSelfFillHint')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-muted">
                    {t('nationalId')}
                    <input required className="field" inputMode="numeric" maxLength={16} value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value.replace(/\D/g, '') })} />
                  </label>
                  <label className="text-sm text-muted">
                    {t('taxId')}
                    <input className="field" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
                  </label>
                  <label className="text-sm text-muted">
                    {t('birthDate')}
                    <input required type="date" className="field" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
                  </label>
                  <label className="text-sm text-muted">
                    {t('birthPlace')}
                    <input required className="field" value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} />
                  </label>
                  <label className="text-sm text-muted">
                    {t('gender')}
                    <select required className="field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                      <option value="">-</option>
                      <option value="male">{t('genderMale')}</option>
                      <option value="female">{t('genderFemale')}</option>
                    </select>
                  </label>
                  <label className="text-sm text-muted">
                    {t('maritalStatus')}
                    <select className="field" value={form.marital_status} onChange={(e) => setForm({ ...form, marital_status: e.target.value })}>
                      <option value="">-</option>
                      <option value="single">{t('maritalSingle')}</option>
                      <option value="married">{t('maritalMarried')}</option>
                      <option value="divorced">{t('maritalDivorced')}</option>
                      <option value="widowed">{t('maritalWidowed')}</option>
                    </select>
                  </label>
                  <label className="text-sm text-muted sm:col-span-2">
                    {t('address')}
                    <textarea required className="field min-h-[72px]" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </label>
                  <label className="text-sm text-muted">
                    {t('emergencyContactName')}
                    <input required className="field" value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} />
                  </label>
                  <label className="text-sm text-muted">
                    {t('emergencyContactPhone')}
                    <input required className="field" value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />
                  </label>
                </div>

                <button type="submit" disabled={submitting} className="btn-primary mt-5 w-full">
                  {submitting ? t('connecting') : t('inviteSubmitBiodata')}
                </button>

                {!me ? (
                  <p className="mt-4 text-center text-sm text-muted">
                    {t('haveAccount')}{' '}
                    <Link to="/login" state={{ from: { pathname: `/invite/${token}` } }} className="text-mint hover:underline">
                      {t('signIn')}
                    </Link>
                  </p>
                ) : null}
              </form>
            ) : null}

            {qrDataUrl ? (
              <div className="mt-5 flex flex-col items-center border-t border-line pt-5">
                <img src={qrDataUrl} alt="" className="rounded-xl bg-white p-2" width={180} height={180} />
                <p className="mt-2 text-xs text-muted">{t('inviteQrHint')}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </motion.div>
    </AuthShell>
  )
}
