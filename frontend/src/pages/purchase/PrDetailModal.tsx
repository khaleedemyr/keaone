import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { MasterViewModal } from '../../components/MasterModal'
import { useFeedback } from '../../components/feedback'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { ensurePrShareToken, prPublicUrl } from './prShare'
import {
  prStatusLabel,
  runPrPdfExport,
  runPrWhatsAppShare,
  type PrDetailRecord,
} from './prDocumentActions'
import { PrDetailView } from './PrDetailView'
import { ProcurementAttachmentsPanel } from './ProcurementAttachmentsPanel'

export function PrDetailModal({
  prId,
  open,
  onClose,
}: {
  prId: number | null
  open: boolean
  onClose: () => void
}) {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const feedback = useFeedback()
  const [pr, setPr] = useState<PrDetailRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!open || !prId) {
      setPr(null)
      return
    }
    setLoading(true)
    void api
      .get<ApiOk<PrDetailRecord>>(`/purchase-requisitions/${prId}`, { silent: true })
      .then(({ data }) => setPr(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
      .finally(() => setLoading(false))
  }, [open, prId, t]) // eslint-disable-line react-hooks/exhaustive-deps

  async function resolveShareToken() {
    if (!pr) return null
    setSharing(true)
    try {
      const token = await ensurePrShareToken(pr.id, pr.share_token)
      setPr((current) => (current ? { ...current, share_token: token } : current))
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
    const url = prPublicUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      feedback.success(t('purchaseLinkCopied'))
    } catch {
      feedback.error(t('purchaseShareFailed'))
    }
  }

  async function shareWhatsApp() {
    if (!pr) return
    setSharing(true)
    try {
      const token = await runPrWhatsAppShare(pr, t)
      setPr((current) => (current ? { ...current, share_token: token } : current))
    } catch (err) {
      feedback.error(apiMessage(err, t('purchaseShareFailed')))
    } finally {
      setSharing(false)
    }
  }

  async function exportPdf() {
    if (!pr) return
    await runPrPdfExport(pr, {
      t,
      locale,
      companyName: me?.company?.name,
      companyPhone: me?.company?.phone ?? undefined,
      companyAddress: me?.company?.address ?? undefined,
    })
  }

  const canShare = Boolean(pr?.can_share)

  return (
    <MasterViewModal open={open} title={t('purchasePrTitle')} onClose={onClose} size="2xl" documentMode>
      {loading ? (
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      ) : pr ? (
        <>
        <PrDetailView
          pr={pr}
          locale={locale}
          t={t}
          statusLabel={prStatusLabel(pr.status, t)}
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
                {pr.pr_need_approval ? t('purchasePrShareNeedApproved') : t('purchasePrShareNeedSubmitted')}
              </p>
            ) : null
          }
        />
        <ProcurementAttachmentsPanel documentType="purchase_requisition" documentId={pr.id} />
        </>
      ) : (
        <p className="font-sans text-sm text-muted">{t('purchaseEmpty')}</p>
      )}
    </MasterViewModal>
  )
}
