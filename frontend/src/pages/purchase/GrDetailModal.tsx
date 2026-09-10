import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { MasterViewModal } from '../../components/MasterModal'
import { useFeedback } from '../../components/feedback'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { GrDetailView, type GrDetailViewData } from './GrDetailView'
import { ProcurementAttachmentsPanel } from './ProcurementAttachmentsPanel'

type GrDetail = GrDetailViewData & {
  id: number
}

export function GrDetailModal({
  grId,
  open,
  onClose,
  statusLabel,
}: {
  grId: number | null
  open: boolean
  onClose: () => void
  statusLabel: (status: string) => string
}) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [gr, setGr] = useState<GrDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !grId) {
      setGr(null)
      return
    }
    setLoading(true)
    void api
      .get<ApiOk<GrDetail>>(`/goods-receipts/${grId}`, { silent: true })
      .then(({ data }) => setGr(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
      .finally(() => setLoading(false))
  }, [open, grId, t]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MasterViewModal
      open={open}
      title={gr ? `${t('purchaseGrTitle')} · ${gr.number}` : t('purchaseGrTitle')}
      onClose={onClose}
      size="2xl"
      documentMode
    >
      {loading ? (
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      ) : gr ? (
        <div className="space-y-6">
          <GrDetailView gr={gr} locale={locale} t={t} statusLabel={statusLabel(gr.status)} />
          <ProcurementAttachmentsPanel documentType="goods_receipt" documentId={gr.id} />
        </div>
      ) : null}
    </MasterViewModal>
  )
}
