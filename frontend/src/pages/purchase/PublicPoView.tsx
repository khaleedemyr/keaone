import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import axios from 'axios'
import { useI18n } from '../../i18n'
import { PoDetailView, type PoDetailViewData } from './PoDetailView'
import { PublicDocPage } from './purchaseDocShared'

type PublicPo = {
  number: string
  status: string
  expected_at?: string | null
  note?: string | null
  subtotal?: number
  tax_percent?: number
  tax?: number
  total?: number
  payment_term?: string | null
  payment_days?: number | null
  created_at?: string | null
  company?: { name?: string; phone?: string | null; address?: string | null } | null
  warehouse?: { name?: string } | null
  supplier?: { name?: string; phone?: string | null } | null
  items?: Array<{
    name?: string | null
    sku?: string | null
    qty: number
    unit?: string | null
    unit_cost?: number
    discount?: number
    total?: number
    note?: string | null
  }>
}

function mapPublicPo(po: PublicPo): PoDetailViewData {
  return {
    number: po.number,
    status: po.status,
    expected_at: po.expected_at,
    note: po.note,
    subtotal: po.subtotal,
    tax_percent: po.tax_percent,
    tax: po.tax,
    total: po.total,
    payment_term: po.payment_term,
    payment_days: po.payment_days,
    created_at: po.created_at,
    supplier: po.supplier ? { name: po.supplier.name, phone: po.supplier.phone } : null,
    warehouse: po.warehouse ? { name: po.warehouse.name } : null,
    items: (po.items ?? []).map((item, index) => ({
      id: index,
      name_snapshot: item.name,
      sku: item.sku,
      qty: item.qty,
      unit: item.unit,
      unit_cost: item.unit_cost,
      discount: item.discount,
      total: item.total,
    })),
  }
}

export default function PublicPoView({ token }: { token: string }) {
  const { t, locale } = useI18n()
  const [po, setPo] = useState<PublicPo | null>(null)
  const [error, setError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    void axios
      .get<{ data: PublicPo }>(`/api/v1/public/purchase-orders/${token}`)
      .then(async ({ data }) => {
        setPo(data.data)
        const qr = await QRCode.toDataURL(data.data.number, { margin: 1, width: 160 })
        setQrDataUrl(qr)
      })
      .catch(() => setError(t('purchasePublicNotFound')))
  }, [token, t])

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

  return (
    <PublicDocPage
      badge={t('purchasePublicView')}
      error={error || undefined}
      loading={!error && !po}
      loadingLabel={t('loading')}
    >
      {po ? (
        <PoDetailView
          po={mapPublicPo(po)}
          locale={locale}
          t={t}
          statusLabel={poStatusLabel(po.status)}
          qrDataUrl={qrDataUrl}
          subtitle={po.company?.name}
        />
      ) : null}
    </PublicDocPage>
  )
}
