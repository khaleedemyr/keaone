import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { MasterViewModal } from '../../components/MasterModal'
import { useFeedback } from '../../components/feedback'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { PrepaymentDetailView, type PrepaymentDetailViewData } from './PrepaymentDetailView'

type PrepaymentDetail = PrepaymentDetailViewData & { id: number }

export function PrepaymentDetailModal({
  prepaymentId,
  open,
  onClose,
  statusLabel,
  methodLabel,
}: {
  prepaymentId: number | null
  open: boolean
  onClose: () => void
  statusLabel: (status: string) => string
  methodLabel: (method?: string | null) => string
}) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [doc, setDoc] = useState<PrepaymentDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !prepaymentId) {
      setDoc(null)
      return
    }
    setLoading(true)
    void api
      .get<ApiOk<PrepaymentDetail>>(`/vendor-prepayments/${prepaymentId}`, { silent: true })
      .then(({ data }) => setDoc(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
      .finally(() => setLoading(false))
  }, [open, prepaymentId, t]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MasterViewModal
      open={open}
      title={doc ? `${t('procurementPrepaymentTitle')} · ${doc.number}` : t('procurementPrepaymentTitle')}
      onClose={onClose}
      size="2xl"
      documentMode
    >
      {loading ? (
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      ) : doc ? (
        <PrepaymentDetailView
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
