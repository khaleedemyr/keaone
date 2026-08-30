import { useEffect, useState } from 'react'
import { api, apiMessage, apiUpload } from '../api/client'
import type { ApiOk } from '../types'
import { useFeedback } from '../components/feedback'
import { useI18n, type MsgKey } from '../i18n'

type VendorDoc = {
  doc_type: string
  original_name?: string | null
  expires_at?: string | null
  is_expired?: boolean
  days_until_expiry?: number | null
}

type VendorDetail = {
  id: number
  vendor_tier?: string | null
  onboarding_status?: string
  vendor_status?: string
  vendor_block_reason?: string | null
  has_portal_token?: boolean
  documents?: VendorDoc[]
  evaluation?: {
    order_count: number
    on_time_percent?: number | null
    quality_score?: number | null
    overall_score?: number | null
  }
  compliance?: { expired: number; expiring_soon: number; complete: boolean }
}

const DOC_TYPES = ['siup', 'npwp', 'pkp', 'other'] as const

function label(t: (k: MsgKey) => string, key: string, map: Record<string, MsgKey>, fallback: MsgKey) {
  return t(map[key] ?? fallback)
}

export function SupplierVendorPanel({ supplierId, canEdit }: { supplierId: number; canEdit: boolean }) {
  const { t } = useI18n()
  const feedback = useFeedback()
  const [detail, setDetail] = useState<VendorDetail | null>(null)
  const [portalUrl, setPortalUrl] = useState('')
  const [loading, setLoading] = useState(true)

  const tierMap: Record<string, MsgKey> = {
    strategic: 'vendorTierStrategic',
    preferred: 'vendorTierPreferred',
    one_time: 'vendorTierOneTime',
  }
  const statusMap: Record<string, MsgKey> = {
    active: 'vendorStatusActive',
    suspended: 'vendorStatusSuspended',
    blacklisted: 'vendorStatusBlacklisted',
  }
  const onboardingMap: Record<string, MsgKey> = {
    draft: 'vendorOnboardingDraft',
    pending: 'vendorOnboardingPending',
    approved: 'vendorOnboardingApproved',
    rejected: 'vendorOnboardingRejected',
  }

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get<ApiOk<VendorDetail>>(`/suppliers/${supplierId}`)
      setDetail(data.data)
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [supplierId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function action(path: string, body?: object) {
    try {
      await api.post(`/suppliers/${supplierId}/${path}`, body ?? {})
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function uploadDoc(type: string, file: File, expiresAt: string) {
    const body = new FormData()
    body.append('document', file)
    if (expiresAt) body.append('expires_at', expiresAt)
    try {
      await apiUpload(`/suppliers/${supplierId}/documents/${type}`, body)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function generatePortal() {
    try {
      const { data } = await api.post<ApiOk<{ portal_token: string }>>(`/suppliers/${supplierId}/portal-token`)
      const token = data.data.portal_token
      setPortalUrl(`${window.location.origin}/vendor-portal/${token}`)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  if (loading) return <div className="text-sm text-muted">{t('loading')}</div>
  if (!detail) return null

  return (
    <div className="space-y-4 rounded-2xl border border-line/40 p-4">
      <div className="text-sm font-semibold text-fg">{t('vendorManagementTitle')}</div>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <span className="text-muted">{t('vendorTierLabel')}: </span>
          <span>{detail.vendor_tier ? label(t, detail.vendor_tier, tierMap, 'vendorTierPreferred') : '—'}</span>
        </div>
        <div>
          <span className="text-muted">{t('vendorOnboardingLabel')}: </span>
          <span>{label(t, detail.onboarding_status ?? 'approved', onboardingMap, 'vendorOnboardingApproved')}</span>
        </div>
        <div>
          <span className="text-muted">{t('vendorStatusLabel')}: </span>
          <span>{label(t, detail.vendor_status ?? 'active', statusMap, 'vendorStatusActive')}</span>
        </div>
      </div>

      {detail.evaluation ? (
        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <div>{t('vendorEvalOrders')}: {detail.evaluation.order_count}</div>
          <div>{t('vendorEvalOnTime')}: {detail.evaluation.on_time_percent ?? '—'}%</div>
          <div>{t('vendorEvalQuality')}: {detail.evaluation.quality_score ?? '—'}%</div>
          <div>{t('vendorEvalOverall')}: {detail.evaluation.overall_score ?? '—'}</div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 text-sm font-medium">{t('vendorDocumentsTitle')}</div>
        <div className="space-y-2">
          {DOC_TYPES.map((type) => {
            const doc = detail.documents?.find((row) => row.doc_type === type)
            return (
              <div key={type} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-16 uppercase text-muted">{type}</span>
                <span>{doc?.original_name ?? t('emptyList')}</span>
                {doc?.expires_at ? (
                  <span className={doc.is_expired ? 'text-rose-300' : 'text-muted'}>
                    {doc.expires_at}
                    {doc.is_expired ? ` (${t('vendorDocExpired')})` : ''}
                  </span>
                ) : null}
                {canEdit ? (
                  <label className="btn-ghost cursor-pointer text-xs">
                    {t('employeeDocumentUpload')}
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) void uploadDoc(type, file, '')
                      }}
                    />
                  </label>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {detail.onboarding_status === 'pending' ? (
            <button type="button" className="btn-ghost text-sm" onClick={() => void action('approve-onboarding')}>
              {t('vendorApproveOnboarding')}
            </button>
          ) : null}
          {detail.vendor_status !== 'suspended' ? (
            <button type="button" className="btn-ghost text-sm text-amber-300" onClick={() => void action('suspend')}>
              {t('vendorSuspend')}
            </button>
          ) : null}
          {detail.vendor_status !== 'blacklisted' ? (
            <button type="button" className="btn-ghost text-sm text-rose-300" onClick={() => void action('blacklist')}>
              {t('vendorBlacklist')}
            </button>
          ) : null}
          {detail.vendor_status !== 'active' ? (
            <button type="button" className="btn-ghost text-sm text-mint" onClick={() => void action('reactivate')}>
              {t('vendorReactivate')}
            </button>
          ) : null}
          <button type="button" className="btn-ghost text-sm" onClick={() => void generatePortal()}>
            {t('vendorPortalLink')}
          </button>
        </div>
      ) : null}

      {portalUrl ? (
        <div className="break-all text-xs text-muted">
          {t('vendorPortalLink')}: {portalUrl}
        </div>
      ) : null}
    </div>
  )
}
