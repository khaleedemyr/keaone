import { useEffect, useState } from 'react'
import axios from 'axios'
import { useI18n } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import { DocStatusBadge, PublicDocPage } from './purchaseDocShared'

type PortalMeta = {
  supplier: { name: string }
  company?: { name: string } | null
  vendor_invoice_enabled?: boolean
}

type PortalInvoice = {
  id: number
  number: string
  vendor_ref?: string | null
  status: string
}

type PortalPo = {
  id: number
  number: string
  status: string
  expected_at?: string | null
  total: number
  share_token: string
  vendor_confirmed_at?: string | null
  portal_invoice?: PortalInvoice | null
  can_upload_invoice?: boolean
}

type UploadForm = {
  vendor_ref: string
  invoice_date: string
  due_date: string
  note: string
  file: File | null
}

const emptyUpload = (): UploadForm => ({
  vendor_ref: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  note: '',
  file: null,
})

export default function PublicVendorPortalView({ token }: { token: string }) {
  const { t, locale } = useI18n()
  const [meta, setMeta] = useState<PortalMeta | null>(null)
  const [orders, setOrders] = useState<PortalPo[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState<string | null>(null)
  const [uploadForms, setUploadForms] = useState<Record<string, UploadForm>>({})
  const [uploadError, setUploadError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [metaRes, poRes] = await Promise.all([
        axios.get<{ data: PortalMeta }>(`/api/v1/public/vendor-portal/${token}`),
        axios.get<{ data: PortalPo[] }>(`/api/v1/public/vendor-portal/${token}/purchase-orders`),
      ])
      setMeta(metaRes.data.data)
      setOrders(poRes.data.data)
      setError('')
    } catch {
      setMeta(null)
      setOrders([])
      setError(t('vendorPortalNotFound'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  function poStatusLabel(status: string) {
    const map: Record<string, string> = {
      draft: t('purchaseStatusDraft'),
      submitted: t('purchaseStatusSubmitted'),
      approved: t('purchaseStatusApproved'),
      ordered: t('purchaseStatusOrdered'),
      partial: t('purchaseStatusPartial'),
      received: t('purchaseStatusReceived'),
    }
    return map[status] ?? status
  }

  function invoiceStatusLabel(status: string) {
    const map: Record<string, string> = {
      draft: t('purchaseStatusDraft'),
      submitted: t('purchaseStatusSubmitted'),
      approved: t('purchaseStatusApproved'),
      confirmed: t('purchaseStatusConfirmed'),
      rejected: t('purchaseStatusRejected'),
      cancelled: t('purchaseStatusCancelled'),
    }
    return map[status] ?? status
  }

  function uploadForm(shareToken: string): UploadForm {
    return uploadForms[shareToken] ?? emptyUpload()
  }

  function patchUpload(shareToken: string, patch: Partial<UploadForm>) {
    setUploadForms((current) => ({
      ...current,
      [shareToken]: { ...uploadForm(shareToken), ...patch },
    }))
  }

  async function confirmPo(shareToken: string) {
    setConfirming(shareToken)
    try {
      await axios.post(`/api/v1/public/vendor-portal/${token}/purchase-orders/${shareToken}/confirm`)
      await load()
    } catch {
      setError(t('saveFailed'))
    } finally {
      setConfirming(null)
    }
  }

  async function submitInvoice(shareToken: string) {
    const form = uploadForm(shareToken)
    if (!form.file || !form.vendor_ref.trim()) {
      setUploadError(t('vendorPortalUploadRequired'))
      return
    }

    setUploading(shareToken)
    setUploadError('')
    try {
      const body = new FormData()
      body.append('client_uuid', crypto.randomUUID())
      body.append('vendor_ref', form.vendor_ref.trim())
      body.append('invoice_date', form.invoice_date)
      if (form.due_date) body.append('due_date', form.due_date)
      if (form.note.trim()) body.append('note', form.note.trim())
      body.append('file', form.file)

      await axios.post(`/api/v1/public/vendor-portal/${token}/purchase-orders/${shareToken}/invoices`, body)
      setUploadOpen(null)
      setUploadForms((current) => {
        const next = { ...current }
        delete next[shareToken]
        return next
      })
      await load()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setUploadError(String(err.response.data.message))
      } else {
        setUploadError(t('saveFailed'))
      }
    } finally {
      setUploading(null)
    }
  }

  const invoiceEnabled = meta?.vendor_invoice_enabled !== false

  return (
    <PublicDocPage
      badge={t('vendorPortalTitle')}
      error={error || undefined}
      loading={loading}
      loadingLabel={t('loading')}
    >
      {meta ? (
        <div className="glass rounded-3xl p-6">
          <h1 className="text-xl font-semibold text-fg">{meta.supplier.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {t('vendorPortalSubtitle')}
            {meta.company?.name ? ` · ${meta.company.name}` : ''}
          </p>

          {orders.length === 0 ? (
            <p className="mt-6 text-sm text-muted">{t('vendorPortalNoOrders')}</p>
          ) : (
            <div className="mt-6 space-y-3">
              {orders.map((po) => {
                const confirmed = !!po.vendor_confirmed_at
                const canConfirm = !confirmed && ['approved', 'ordered', 'partial'].includes(po.status)
                const canUpload = invoiceEnabled && po.can_upload_invoice
                const hasInvoice = !!po.portal_invoice
                const formOpen = uploadOpen === po.share_token

                return (
                  <div key={po.id} className="rounded-2xl border border-line px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-fg">{po.number}</span>
                          <DocStatusBadge status={po.status} label={poStatusLabel(po.status)} />
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {po.expected_at ? `${t('purchaseExpectedAt')}: ${po.expected_at}` : '—'} ·{' '}
                          {formatRupiah(po.total, locale)}
                        </div>
                        {confirmed ? (
                          <div className="mt-1 text-xs text-mint">{t('vendorPortalConfirmed')}</div>
                        ) : null}
                        {hasInvoice && po.portal_invoice ? (
                          <div className="mt-1 text-xs text-muted">
                            {t('vendorPortalInvoiceSubmitted')}: {po.portal_invoice.vendor_ref || po.portal_invoice.number}{' '}
                            ({invoiceStatusLabel(po.portal_invoice.status)})
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canConfirm ? (
                          <button
                            type="button"
                            className="btn-primary text-sm"
                            disabled={confirming === po.share_token}
                            onClick={() => void confirmPo(po.share_token)}
                          >
                            {confirming === po.share_token ? t('loading') : t('vendorPortalConfirm')}
                          </button>
                        ) : null}
                        {canUpload ? (
                          <button
                            type="button"
                            className="btn-ghost text-sm"
                            onClick={() => {
                              setUploadError('')
                              setUploadOpen(formOpen ? null : po.share_token)
                              if (!uploadForms[po.share_token]) {
                                patchUpload(po.share_token, emptyUpload())
                              }
                            }}
                          >
                            {formOpen ? t('cancel') : t('vendorPortalUploadInvoice')}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {formOpen ? (
                      <div className="mt-4 space-y-3 border-t border-line pt-4">
                        <p className="text-xs text-muted">{t('vendorPortalUploadHint')}</p>
                        <label className="block text-sm text-muted">
                          {t('vendorPortalInvoiceRef')}
                          <input
                            className="field mt-1"
                            value={uploadForm(po.share_token).vendor_ref}
                            onChange={(e) => patchUpload(po.share_token, { vendor_ref: e.target.value })}
                            required
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-sm text-muted">
                            {t('vendorPortalInvoiceDate')}
                            <input
                              type="date"
                              className="field mt-1"
                              value={uploadForm(po.share_token).invoice_date}
                              onChange={(e) => patchUpload(po.share_token, { invoice_date: e.target.value })}
                              required
                            />
                          </label>
                          <label className="text-sm text-muted">
                            {t('vendorPortalDueDate')}
                            <input
                              type="date"
                              className="field mt-1"
                              value={uploadForm(po.share_token).due_date}
                              onChange={(e) => patchUpload(po.share_token, { due_date: e.target.value })}
                            />
                          </label>
                        </div>
                        <label className="block text-sm text-muted">
                          {t('note')}
                          <textarea
                            className="field mt-1 min-h-[72px]"
                            value={uploadForm(po.share_token).note}
                            onChange={(e) => patchUpload(po.share_token, { note: e.target.value })}
                          />
                        </label>
                        <label className="block text-sm text-muted">
                          {t('vendorPortalInvoiceFile')}
                          <input
                            type="file"
                            className="field mt-1"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={(e) =>
                              patchUpload(po.share_token, { file: e.target.files?.[0] ?? null })
                            }
                            required
                          />
                        </label>
                        {uploadError ? <p className="text-sm text-rose-400">{uploadError}</p> : null}
                        <button
                          type="button"
                          className="btn-primary text-sm"
                          disabled={uploading === po.share_token}
                          onClick={() => void submitInvoice(po.share_token)}
                        >
                          {uploading === po.share_token ? t('loading') : t('vendorPortalUploadSubmit')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </PublicDocPage>
  )
}
