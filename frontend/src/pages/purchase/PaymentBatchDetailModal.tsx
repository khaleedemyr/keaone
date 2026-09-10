import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { MasterViewModal } from '../../components/MasterModal'
import { useFeedback } from '../../components/feedback'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { PaymentBatchDetailView, type PaymentBatchDetailViewData } from './PaymentBatchDetailView'

type PaymentBatchDetail = PaymentBatchDetailViewData & { id: number }

export function PaymentBatchDetailModal({
  batchId,
  open,
  onClose,
  statusLabel,
  methodLabel,
}: {
  batchId: number | null
  open: boolean
  onClose: () => void
  statusLabel: (status: string) => string
  methodLabel: (method?: string | null) => string
}) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [doc, setDoc] = useState<PaymentBatchDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !batchId) {
      setDoc(null)
      return
    }
    setLoading(true)
    void api
      .get<ApiOk<PaymentBatchDetail>>(`/vendor-payment-batches/${batchId}`, { silent: true })
      .then(({ data }) => setDoc(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
      .finally(() => setLoading(false))
  }, [open, batchId, t]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MasterViewModal
      open={open}
      title={doc ? `${t('procurementPaymentTitle')} · ${doc.number}` : t('procurementPaymentTitle')}
      onClose={onClose}
      size="2xl"
      documentMode
    >
      {loading ? (
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      ) : doc ? (
        <PaymentBatchDetailView
          doc={doc}
          locale={locale}
          t={t}
          statusLabel={statusLabel(doc.status)}
          methodLabel={methodLabel(doc.payment_method)}
        />
      ) : null}
    </MasterViewModal>
  )
}
