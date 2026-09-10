import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { MasterViewModal } from '../../components/MasterModal'
import { ReceiptModal } from '../../components/ui'
import { useFeedback } from '../../components/feedback'
import { useI18n, type MsgKey } from '../../i18n'
import type { ApiOk, ReceiptPayload } from '../../types'
import { GrDetailModal } from '../purchase/GrDetailModal'
import { ReturnDetailModal } from '../purchase/ReturnDetailModal'
import {
  AdjustmentDetailView,
  OpnameDetailView,
  ProductionDetailView,
  TransferDetailView,
} from './InventoryDocViews'
import { inventoryDocStatusLabel, isStockSourceClickable, stockAdjReasonLabel } from './inventoryDocUtils'

type Props = {
  refType: string | null
  refId: number | null
  open: boolean
  onClose: () => void
}

export function StockSourceDocModal({ refType, refId, open, onClose }: Props) {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const [loading, setLoading] = useState(false)
  const [kind, setKind] = useState<string | null>(null)
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null)
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null)

  const clickable = isStockSourceClickable(refType, refId)

  useEffect(() => {
    if (!open || !clickable || !refType || !refId) {
      setKind(null)
      setDoc(null)
      setReceipt(null)
      setLoading(false)
      return
    }

    if (refType === 'goods_receipt' || refType === 'purchase_return') {
      setKind(refType)
      setDoc(null)
      setReceipt(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setKind(refType)
    setDoc(null)
    setReceipt(null)

    const path =
      refType === 'stock_transfer'
        ? `/stock-transfers/${refId}`
        : refType === 'stock_opname'
          ? `/stock-opnames/${refId}`
          : refType === 'stock_adjustment'
            ? `/stock-adjustments/${refId}`
            : refType === 'stock_production'
              ? `/stock-productions/${refId}`
              : refType === 'sale'
                ? `/sales/${refId}/receipt`
                : null

    if (!path) {
      setLoading(false)
      return
    }

    void api
      .get<ApiOk<Record<string, unknown> | ReceiptPayload>>(path, { silent: true })
      .then(({ data }) => {
        if (refType === 'sale') {
          setReceipt(data.data as ReceiptPayload)
          setDoc(null)
        } else {
          setDoc(data.data as Record<string, unknown>)
          setReceipt(null)
        }
      })
      .catch((err) => {
        feedback.error(apiMessage(err, t('loadFailed')))
        onClose()
      })
      .finally(() => setLoading(false))
  }, [open, clickable, refType, refId, t]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !clickable || !refType || !refId) return null

  if (refType === 'goods_receipt') {
    return (
      <GrDetailModal
        grId={refId}
        open={open}
        onClose={onClose}
        statusLabel={(status) => inventoryDocStatusLabel(status, t)}
      />
    )
  }

  if (refType === 'purchase_return') {
    return (
      <ReturnDetailModal
        returnId={refId}
        open={open}
        onClose={onClose}
        statusLabel={(status) => inventoryDocStatusLabel(status, t)}
      />
    )
  }

  if (refType === 'sale') {
    if (receipt) {
      return <ReceiptModal receipt={receipt} onClose={onClose} />
    }
    return (
      <MasterViewModal open={open} title={t('stockMoveSale')} onClose={onClose} size="2xl" documentMode>
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      </MasterViewModal>
    )
  }

  const title = docTitle(kind, doc, t)
  const status = typeof doc?.status === 'string' ? doc.status : ''

  return (
    <MasterViewModal open={open} title={title} onClose={onClose} size="2xl" documentMode>
      {loading ? (
        <p className="font-sans text-sm text-muted">{t('loading')}</p>
      ) : doc && kind === 'stock_transfer' ? (
        <TransferDetailView
          doc={doc as never}
          statusLabel={inventoryDocStatusLabel(status, t)}
          locale={locale}
          t={t}
        />
      ) : doc && kind === 'stock_opname' ? (
        <OpnameDetailView
          doc={doc as never}
          statusLabel={inventoryDocStatusLabel(status, t)}
          locale={locale}
          t={t}
        />
      ) : doc && kind === 'stock_adjustment' ? (
        <AdjustmentDetailView
          doc={doc as never}
          statusLabel={inventoryDocStatusLabel(status, t)}
          locale={locale}
          t={t}
          docLabel={t('stockAdjustmentsTitle')}
          reasonLabel={stockAdjReasonLabel(String(doc.reason ?? ''), t)}
        />
      ) : doc && kind === 'stock_production' ? (
        <ProductionDetailView
          doc={doc as never}
          statusLabel={inventoryDocStatusLabel(status, t)}
          locale={locale}
          t={t}
          manufacturing={Boolean(doc.manufacturing)}
        />
      ) : null}
    </MasterViewModal>
  )
}

function docTitle(kind: string | null, doc: Record<string, unknown> | null, t: (key: MsgKey) => string) {
  const number = typeof doc?.number === 'string' ? doc.number : ''
  const label =
    kind === 'stock_transfer'
      ? t('stockTransfersTitle')
      : kind === 'stock_opname'
        ? t('stockOpnamesTitle')
        : kind === 'stock_adjustment'
          ? t('stockAdjustmentsTitle')
          : kind === 'stock_production'
            ? t('stockProductionTitle')
            : t('stockCardTitle')
  return number ? `${label} · ${number}` : label
}
