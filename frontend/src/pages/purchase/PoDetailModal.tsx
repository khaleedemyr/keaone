import { useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { api, apiMessage } from '../../api/client'
import { MasterViewModal } from '../../components/MasterModal'
import { useFeedback } from '../../components/feedback'
import { exportPoPdf } from '../../lib/purchaseOrderExport'
import { formatRupiah } from '../../lib/money'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { ensurePoShareToken, poPublicUrl, poWhatsAppUrl } from './poShare'
import { formatPaymentTermLabel } from './poTotals'
import { PoDetailView, type PoDetailViewData } from './PoDetailView'

type PoDetail = PoDetailViewData & {
  id: number
  share_token?: string | null
  can_share?: boolean
  po_need_approval?: boolean
  approver?: { id: number; name: string } | null
  approved_at?: string | null
  approvals?: Array<{
    id: number
    level: number
    user?: { id: number; name: string } | null
    status: string
    acted_at?: string | null
  }>
}

export function PoDetailModal({
  poId,
  open,
  onClose,
}: {
  poId: number | null
  open: boolean
  onClose: () => void
}) {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const feedback = useFeedback()
  const [po, setPo] = useState<PoDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!open || !poId) {
      setPo(null)
      setQrDataUrl('')
      return
    }
    setLoading(true)
    void api
      .get<ApiOk<PoDetail>>(`/purchase-orders/${poId}`, { silent: true })
      .then(async ({ data }) => {
        const row = data.data
        setPo(row)
        const qr = await QRCode.toDataURL(row.number, { margin: 1, width: 160 })
        setQrDataUrl(qr)
      })
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
      .finally(() => setLoading(false))
  }, [open, poId, t]) // eslint-disable-line react-hooks/exhaustive-deps

  async function resolveShareToken() {
    if (!po) return null
    setSharing(true)
    try {
      const token = await ensurePoShareToken(po.id, po.share_token)
      setPo((current) => (current ? { ...current, share_token: token } : current))
      return token
    } catch (err) {
      feedback.error(apiMessage(err, t('purchaseShareFailed')))
      return null
    } finally {
      setSharing(false)
    }
  }

  async function copyLink() {
    const token = await resolveShareToken()
    if (!token) return
    const url = poPublicUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      feedback.success(t('purchaseLinkCopied'))
    } catch {
      feedback.error(t('purchaseShareFailed'))
    }
  }

  async function shareWhatsApp() {
    if (!po) return
    const token = await resolveShareToken()
    if (!token) return
    const url = poPublicUrl(token)
    const message = t('purchaseShareMessage', { number: po.number, url })
    window.open(poWhatsAppUrl(po.supplier?.phone, message), '_blank', 'noopener,noreferrer')
  }

  function poStatusLabel(status: string) {
    const map: Record<string, string> = {
      draft: t('purchaseStatusDraft'),
      submitted: t('purchaseStatusSubmitted'),
      approved: t('purchaseStatusApproved'),
      rejected: t('purchaseStatusRejected'),
      cancelled: t('purchaseStatusCancelled'),
      ordered: t('purchaseStatusOrdered'),
      partial: t('purchaseStatusPartial'),
      received: t('purchaseStatusReceived'),
    }
    return map[status] ?? status
  }

  async function exportPdf() {
    if (!po) return
    const topLabel = formatPaymentTermLabel(po.payment_term, po.payment_days, t)
    await exportPoPdf(
      po,
      {
        title: t('purchasePoTitle'),
        number: t('purchaseNumber'),
        status: t('status'),
        supplier: t('navSuppliers'),
        warehouse: t('navWarehouses'),
        expectedAt: t('purchaseExpectedAt'),
        note: t('purchaseNote'),
        product: t('product'),
        qty: t('posColQty'),
        unit: t('unit'),
        unitCost: t('purchaseUnitCost'),
        discount: t('purchaseDiscount'),
        lineTotal: t('purchaseTotal'),
        subtotal: t('purchaseSubtotal'),
        grossSubtotal: t('purchaseGrossSubtotal'),
        totalDiscount: t('purchaseTotalDiscount'),
        tax: t('purchaseTax'),
        total: t('purchaseGrandTotal'),
        paymentTerm: t('paymentTerm'),
        createdAt: t('createdAt'),
        createdBy: t('purchaseCreatedBy'),
        approvedBy: t('purchaseApprovedBy'),
        approvalLevel: t('purchaseApprovalLevel'),
        qrHint: t('purchaseQrHint'),
        generatedBy: t('purchasePdfGeneratedBy'),
      },
      (value) => formatRupiah(value, locale),
      {
        companyName: me?.company?.name,
        companyPhone: me?.company?.phone ?? undefined,
        companyAddress: me?.company?.address ?? undefined,
        statusLabel: poStatusLabel(po.status),
        paymentTermLine: topLabel !== '—' ? topLabel : undefined,
      },
      locale,
    )
  }

  const canShare = Boolean(po?.can_share)

  return (
    <MasterViewModal
      open={open}
      title={t('purchasePoTitle')}
      onClose={onClose}
      size="2xl"
      documentMode
    >
      {loading ? (
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      ) : po ? (
        <PoDetailView
          po={po}
          locale={locale}
          t={t}
          statusLabel={poStatusLabel(po.status)}
          qrDataUrl={qrDataUrl}
          actions={
            <>
              <button type="button" className="btn-ghost !h-8 !px-3 !text-xs" onClick={() => void exportPdf()}>
                {t('exportPdf')}
              </button>
              {canShare ? (
                <>
                  <button
                    type="button"
                    className="btn-ghost !h-8 !px-3 !text-xs"
                    disabled={sharing}
                    onClick={() => void copyLink()}
                  >
                    {t('purchaseCopyLink')}
                  </button>
                  <button
                    type="button"
                    className="btn-primary !h-8 !px-3 !text-xs"
                    disabled={sharing}
                    onClick={() => void shareWhatsApp()}
                  >
                    {t('purchaseShareWhatsApp')}
                  </button>
                </>
              ) : null}
            </>
          }
          shareHint={
            !canShare ? (
              <p className="text-xs text-muted">
                {po.po_need_approval ? t('purchaseShareNeedApproved') : t('purchaseShareNeedOrdered')}
              </p>
            ) : null
          }
        />
      ) : (
        <p className="font-sans text-sm text-muted">{t('purchaseEmpty')}</p>
      )}
    </MasterViewModal>
  )
}
