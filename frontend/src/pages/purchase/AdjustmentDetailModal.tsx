import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { MasterViewModal } from '../../components/MasterModal'
import { useFeedback } from '../../components/feedback'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { AdjustmentDetailView, type AdjustmentDetailViewData } from './AdjustmentDetailView'

type AdjustmentDetail = AdjustmentDetailViewData & { id: number }

export function AdjustmentDetailModal({
  noteId,
  open,
  onClose,
  statusLabel,
  typeLabel,
}: {
  noteId: number | null
  open: boolean
  onClose: () => void
  statusLabel: (status: string) => string
  typeLabel: (type: string) => string
}) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [doc, setDoc] = useState<AdjustmentDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !noteId) {
      setDoc(null)
      return
    }
    setLoading(true)
    void api
      .get<ApiOk<AdjustmentDetail>>(`/vendor-adjustment-notes/${noteId}`, { silent: true })
      .then(({ data }) => setDoc(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
      .finally(() => setLoading(false))
  }, [open, noteId, t]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MasterViewModal
      open={open}
      title={doc ? `${t('procurementAdjustmentTitle')} · ${doc.number}` : t('procurementAdjustmentTitle')}
      onClose={onClose}
      size="2xl"
      documentMode
    >
      {loading ? (
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      ) : doc ? (
        <AdjustmentDetailView
          doc={doc}
          locale={locale}
          t={t}
          statusLabel={statusLabel(doc.status)}
          typeLabel={typeLabel(doc.type)}
        />
      ) : null}
    </MasterViewModal>
  )
}
