import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { MasterViewModal } from '../../components/MasterModal'
import { useFeedback } from '../../components/feedback'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { ReturnDetailView, type ReturnDetailViewData } from './ReturnDetailView'

type ReturnDetail = ReturnDetailViewData & {
  id: number
}

export function ReturnDetailModal({
  returnId,
  open,
  onClose,
  statusLabel,
}: {
  returnId: number | null
  open: boolean
  onClose: () => void
  statusLabel: (status: string) => string
}) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [doc, setDoc] = useState<ReturnDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !returnId) {
      setDoc(null)
      return
    }
    setLoading(true)
    void api
      .get<ApiOk<ReturnDetail>>(`/purchase-returns/${returnId}`, { silent: true })
      .then(({ data }) => setDoc(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
      .finally(() => setLoading(false))
  }, [open, returnId, t]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MasterViewModal
      open={open}
      title={doc ? `${t('procurementReturnTitle')} · ${doc.number}` : t('procurementReturnTitle')}
      onClose={onClose}
      size="2xl"
      documentMode
    >
      {loading ? (
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      ) : doc ? (
        <ReturnDetailView doc={doc} locale={locale} t={t} statusLabel={statusLabel(doc.status)} />
      ) : null}
    </MasterViewModal>
  )
}
