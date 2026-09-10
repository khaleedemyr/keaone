import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { MasterViewModal } from '../../components/MasterModal'
import { useFeedback } from '../../components/feedback'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { InvoiceDetailView, type InvoiceDetailViewData } from './InvoiceDetailView'

type InvoiceDetail = InvoiceDetailViewData & { id: number }

export function InvoiceDetailModal({
  invoiceId,
  open,
  onClose,
  statusLabel,
  matchStatusLabel,
  paymentStatusLabel,
}: {
  invoiceId: number | null
  open: boolean
  onClose: () => void
  statusLabel: (status: string) => string
  matchStatusLabel?: (status?: string | null) => string
  paymentStatusLabel?: (status?: string | null) => string
}) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [doc, setDoc] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !invoiceId) {
      setDoc(null)
      return
    }
    setLoading(true)
    void api
      .get<ApiOk<InvoiceDetail>>(`/vendor-invoices/${invoiceId}`, { silent: true })
      .then(({ data }) => setDoc(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
      .finally(() => setLoading(false))
  }, [open, invoiceId, t]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MasterViewModal
      open={open}
      title={doc ? `${t('procurementInvoiceTitle')} · ${doc.number}` : t('procurementInvoiceTitle')}
      onClose={onClose}
      size="2xl"
      documentMode
    >
      {loading ? (
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      ) : doc ? (
        <InvoiceDetailView
          doc={doc}
          locale={locale}
          t={t}
          statusLabel={statusLabel(doc.status)}
          matchStatusLabel={matchStatusLabel?.(doc.match_status)}
          paymentStatusLabel={
            doc.status === 'confirmed' ? paymentStatusLabel?.(doc.payment_status) : undefined
          }
        />
      ) : null}
    </MasterViewModal>
  )
}
