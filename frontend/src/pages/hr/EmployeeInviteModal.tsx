import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import QRCode from 'qrcode'
import { api, apiMessage } from '../../api/client'
import { FormAlert, useFeedback } from '../../components/feedback'
import { useRoleOptions } from '../../components/RolesManager'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import type { ApiOk, CompanyInvite } from '../../types'
import { invitePublicUrl, inviteWhatsAppUrl } from './inviteShare'

type Props = {
  open: boolean
  onClose: () => void
}

export function EmployeeInviteModal({ open, onClose }: Props) {
  const { t } = useI18n()
  const { isOwner } = useAccess()
  const feedback = useFeedback()
  const roles = useRoleOptions('/roles')
  const [form, setForm] = useState({
    role_id: '',
    email: '',
    label: '',
    expires_in_days: '7',
  })
  const [invite, setInvite] = useState<CompanyInvite | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [recent, setRecent] = useState<CompanyInvite[]>([])

  useEffect(() => {
    if (!open) {
      setInvite(null)
      setQrDataUrl('')
      setError('')
      return
    }

    const fallback = roles.find((item) => item.slug === 'cashier') ?? roles.find((item) => !item.is_owner) ?? roles[0]
    setForm({
      role_id: fallback ? String(fallback.id) : '',
      email: '',
      label: '',
      expires_in_days: '7',
    })

    void api
      .get<ApiOk<CompanyInvite[]>>('/company-invites', { params: { per_page: 5 } })
      .then(({ data }) => setRecent(data.data))
      .catch(() => setRecent([]))
  }, [open, roles])

  useEffect(() => {
    if (!invite?.token) {
      setQrDataUrl('')
      return
    }
    const url = invitePublicUrl(invite.token)
    void QRCode.toDataURL(url, { margin: 1, width: 200 }).then(setQrDataUrl)
  }, [invite?.token])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post<ApiOk<CompanyInvite>>('/company-invites', {
        role_id: form.role_id ? Number(form.role_id) : null,
        email: form.email.trim() || null,
        label: form.label.trim() || null,
        expires_in_days: Number(form.expires_in_days),
      })
      setInvite(data.data)
      feedback.success(t('inviteCreated'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    if (!invite?.token) return
    try {
      await navigator.clipboard.writeText(invitePublicUrl(invite.token))
      feedback.success(t('inviteLinkCopied'))
    } catch {
      feedback.error(t('inviteShareFailed'))
    }
  }

  function shareWhatsApp() {
    if (!invite?.token) return
    const url = invitePublicUrl(invite.token)
    const message = t('inviteShareMessage', { url })
    window.open(inviteWhatsAppUrl(message), '_blank', 'noopener,noreferrer')
  }

  async function revoke(row: CompanyInvite) {
    const ok = await feedback.confirm({
      title: t('inviteRevokeTitle'),
      message: t('inviteRevokeConfirm'),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/company-invites/${row.id}`)
      setRecent((current) => current.filter((item) => item.id !== row.id))
      if (invite?.id === row.id) setInvite(null)
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6"
          >
            <h2 className="font-display mb-1 text-xl font-bold">{t('inviteEmployeeTitle')}</h2>
              <p className="mb-4 text-xs text-muted">{t('inviteEmployeeLead')}</p>
              <p className="mb-4 rounded-xl bg-fill px-3 py-2 text-xs text-muted">{t('inviteLinkTypeHint')}</p>
              {error ? <FormAlert>{error}</FormAlert> : null}

            {!invite ? (
              <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3">
                <label className="text-sm text-muted">
                  {t('role')}
                  <select required className="field" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                    {roles
                      .filter((item) => isOwner || !item.is_owner)
                      .filter((item) => item.is_active)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm text-muted">
                  {t('inviteOptionalEmail')}
                  <input
                    type="email"
                    className="field"
                    placeholder={t('inviteOptionalEmailHint')}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <label className="text-sm text-muted">
                  {t('inviteLabel')}
                  <input className="field" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('inviteExpiresIn')}
                  <select className="field" value={form.expires_in_days} onChange={(e) => setForm({ ...form, expires_in_days: e.target.value })}>
                    <option value="7">{t('inviteExpires7')}</option>
                    <option value="30">{t('inviteExpires30')}</option>
                    <option value="90">{t('inviteExpires90')}</option>
                    <option value="-1">{t('inviteExpiresNever')}</option>
                  </select>
                </label>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" className="btn-ghost" onClick={onClose}>
                    {t('cancel')}
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? t('connecting') : t('inviteGenerateLink')}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="rounded-2xl bg-fill p-3 text-xs break-all text-muted">{invitePublicUrl(invite.token)}</div>
                {qrDataUrl ? (
                  <div className="mt-4 flex justify-center">
                    <img src={qrDataUrl} alt="" className="rounded-xl bg-white p-2" width={200} height={200} />
                  </div>
                ) : null}
                <p className="mt-2 text-center text-xs text-muted">
                  {invite.is_personal ? t('inviteLinkPersonalNote') : t('inviteLinkOpenNote')}
                </p>
                <p className="mt-2 text-center text-xs text-muted">{t('inviteQrHint')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary flex-1" onClick={() => void copyLink()}>
                    {t('inviteCopyLink')}
                  </button>
                  <button type="button" className="btn-ghost flex-1" onClick={shareWhatsApp}>
                    WhatsApp
                  </button>
                </div>
                <button type="button" className="btn-ghost mt-3 w-full" onClick={() => setInvite(null)}>
                  {t('inviteCreateAnother')}
                </button>
              </div>
            )}

            {recent.length > 0 ? (
              <div className="mt-6 border-t border-line pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('inviteRecent')}</h3>
                <ul className="space-y-2 text-sm">
                  {recent.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-fill px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.role_name ?? row.role}</p>
                        <p className="text-xs text-muted">
                          {row.use_count}
                          {row.max_uses ? ` / ${row.max_uses}` : ''} · {row.is_acceptable ? t('active') : t('inactive')}
                        </p>
                      </div>
                      {row.is_acceptable ? (
                        <button type="button" className="text-rose-300" onClick={() => void revoke(row)}>
                          {t('inviteRevoke')}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-ghost" onClick={onClose}>
                {t('close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
