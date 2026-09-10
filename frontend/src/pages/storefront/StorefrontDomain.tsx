import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'
import type { ApiOk } from '../../types'
import type { StorefrontAdmin, StorefrontDomainRow } from './types'

type DomainCheck = {
  host: string
  status: 'invalid' | 'owned_by_you' | 'taken_keaone' | 'registered' | 'available' | 'unknown'
  can_connect: boolean
  can_purchase: boolean
  registered: boolean | null
  message: string
  dns_instructions?: StorefrontAdmin['dns_instructions']
}

const CHECK_STATUS_LABEL: Record<DomainCheck['status'], MsgKey> = {
  invalid: 'storefrontDomainCheck_invalid',
  owned_by_you: 'storefrontDomainCheck_owned_by_you',
  taken_keaone: 'storefrontDomainCheck_taken_keaone',
  registered: 'storefrontDomainCheck_registered',
  available: 'storefrontDomainCheck_available',
  unknown: 'storefrontDomainCheck_unknown',
}

const DOMAIN_STATUS_LABEL: Record<string, MsgKey> = {
  pending_dns: 'storefrontDomainStatus_pending_dns',
  active: 'storefrontDomainStatus_active',
  failed: 'storefrontDomainStatus_failed',
}

const SSL_STATUS_LABEL: Record<string, MsgKey> = {
  pending: 'storefrontDomainSsl_pending',
  active: 'storefrontDomainSsl_active',
  failed: 'storefrontDomainSsl_failed',
}

function statusChipClass(status: string) {
  if (status === 'active') return 'border-emerald-300 bg-emerald-50 text-emerald-900'
  if (status === 'failed') return 'border-rose-300 bg-rose-50 text-rose-900'
  return 'border-amber-300 bg-amber-50 text-amber-950'
}

export default function StorefrontDomainPage() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canCreate = can('storefrontdomain', 'create')
  const canEdit = can('storefrontdomain', 'edit')
  const canDelete = can('storefrontdomain', 'delete')
  const [domains, setDomains] = useState<StorefrontDomainRow[]>([])
  const [instructions, setInstructions] = useState<StorefrontAdmin['dns_instructions']>()
  const [host, setHost] = useState('')
  const [check, setCheck] = useState<DomainCheck | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<StorefrontAdmin>>('/storefront')
      setDomains(data.data.domains ?? [])
      setInstructions(data.data.dns_instructions)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onCheck() {
    if (!host.trim()) return
    setBusy(true)
    setError('')
    setCheck(null)
    try {
      const { data } = await api.post<ApiOk<DomainCheck>>('/storefront/domains/check', { host })
      setCheck(data.data)
      if (data.data.dns_instructions) {
        setInstructions(data.data.dns_instructions)
      }
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function onConnect(event: FormEvent) {
    event.preventDefault()
    if (!canCreate) return
    if (!check?.can_connect || check.host !== normalizeClientHost(host)) {
      setError(t('storefrontDomainCheckFirst'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.post('/storefront/domains', { host: check.host, is_primary: true })
      setHost('')
      setCheck(null)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(id: number) {
    if (!canEdit) return
    setBusy(true)
    try {
      await api.post(`/storefront/domains/${id}/verify`)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: number) {
    if (!canDelete) return
    setBusy(true)
    try {
      await api.delete(`/storefront/domains/${id}`)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  const checkTone =
    check?.status === 'registered' || check?.status === 'owned_by_you'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : check?.status === 'available'
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : check
          ? 'border-rose-300 bg-rose-50 text-rose-900'
          : ''

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t('appStorefront')} title={t('storefrontDomainTitle')} subtitle={t('storefrontDomainHint')} />

      {canCreate ? (
        <form onSubmit={(e) => void onConnect(e)} className="glass max-w-xl space-y-3 rounded-3xl p-5">
          {error ? <FormAlert>{error}</FormAlert> : null}
          <label className="block space-y-1 text-sm">
            <span className="text-muted">{t('storefrontDomainHost')}</span>
            <input
              className="field w-full"
              placeholder="tokoanda.com"
              value={host}
              onChange={(e) => {
                setHost(e.target.value)
                setCheck(null)
              }}
              required
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy || !host.trim()} onClick={() => void onCheck()}>
              {busy && !check ? t('storefrontDomainChecking') : t('storefrontCheckDomain')}
            </button>
            <button type="submit" className="btn-ghost" disabled={busy || !check?.can_connect}>
              {t('storefrontConnectDomain')}
            </button>
            {check?.can_purchase && !check.can_connect ? (
              <button type="button" className="btn-ghost" disabled title={t('storefrontDomainPurchaseSoon')}>
                {t('storefrontDomainPurchaseSoon')}
              </button>
            ) : null}
          </div>

          {check ? (
            <div className={`rounded-2xl border px-3 py-2 text-sm ${checkTone}`}>
              <div className="font-medium">
                {check.host} · {t(CHECK_STATUS_LABEL[check.status])}
              </div>
              <p className="mt-1 opacity-90">{check.message}</p>
              {check.can_purchase && !check.can_connect ? (
                <p className="mt-1 text-xs opacity-90">{t('storefrontDomainPurchaseHint')}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted">{t('storefrontDomainCheckFirst')}</p>
          )}
        </form>
      ) : null}

      {instructions ? (
        <div className="glass max-w-xl space-y-2 rounded-3xl p-5 text-sm">
          <div className="font-medium">{t('storefrontDnsInstructions')}</div>
          <p className="text-muted">{instructions.note}</p>
          {instructions.cname ? (
            <div>
              CNAME → <code>{instructions.cname}</code>
            </div>
          ) : null}
          {instructions.a_records && instructions.a_records.length > 0 ? (
            <div>
              A → <code>{instructions.a_records.join(', ')}</code>
            </div>
          ) : null}
          {instructions.txt_host && instructions.txt_value ? (
            <div className="rounded-xl border border-dashed border-black/10 bg-white/60 px-3 py-2">
              <div className="font-medium">{t('storefrontDomainTxtChallenge')}</div>
              <div className="mt-1">
                Host: <code>{instructions.txt_host}</code>
              </div>
              <div>
                Value: <code>{instructions.txt_value}</code>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="glass max-w-2xl space-y-2 rounded-3xl p-5">
        {domains.length === 0 ? (
          <p className="text-sm text-muted">{t('storefrontEmptyDomains')}</p>
        ) : (
          domains.map((domain) => {
            const statusKey = DOMAIN_STATUS_LABEL[domain.status] ?? 'storefrontDomainStatus_pending_dns'
            const sslKey = SSL_STATUS_LABEL[domain.ssl_status] ?? 'storefrontDomainSsl_pending'
            return (
              <div key={domain.id} className="rounded-2xl border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{domain.host}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusChipClass(domain.status)}`}>
                        {t(statusKey)}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusChipClass(domain.ssl_status)}`}>
                        SSL · {t(sslKey)}
                      </span>
                      {domain.is_primary ? (
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                          {t('storefrontDomainPrimary')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canEdit ? (
                      <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void onVerify(domain.id)}>
                        {t('storefrontVerifyDomain')}
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void onDelete(domain.id)}>
                        {t('delete')}
                      </button>
                    ) : null}
                  </div>
                </div>
                {domain.dns_instructions?.txt_host && domain.dns_instructions?.txt_value ? (
                  <div className="mt-2 text-[11px] text-muted">
                    TXT <code>{domain.dns_instructions.txt_host}</code> ={' '}
                    <code>{domain.dns_instructions.txt_value}</code>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function normalizeClientHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
}
