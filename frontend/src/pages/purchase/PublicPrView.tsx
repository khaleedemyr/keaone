import { useEffect, useState } from 'react'
import axios from 'axios'
import { useI18n } from '../../i18n'
import { PrDetailView, type PrDetailViewData } from './PrDetailView'
import { PublicDocPage } from './purchaseDocShared'

type PublicPr = {
  number: string
  status: string
  needed_at?: string | null
  note?: string | null
  created_at?: string | null
  approved_at?: string | null
  company?: { name?: string; phone?: string | null; address?: string | null } | null
  warehouse?: { name?: string } | null
  outlet?: { name?: string } | null
  user?: { name?: string } | null
  approver?: { name?: string } | null
  approvals?: Array<{
    level: number
    user?: { name?: string } | null
    status: string
    acted_at?: string | null
  }>
  items?: Array<{
    name?: string | null
    sku?: string | null
    qty: number
    unit?: string | null
    suggested_unit_cost?: number
    note?: string | null
  }>
}

function mapPublicPr(pr: PublicPr): PrDetailViewData {
  return {
    number: pr.number,
    status: pr.status,
    needed_at: pr.needed_at,
    note: pr.note,
    created_at: pr.created_at,
    approved_at: pr.approved_at,
    user: pr.user?.name ? { name: pr.user.name } : null,
    approver: pr.approver?.name ? { name: pr.approver.name } : null,
    warehouse: pr.warehouse?.name ? { name: pr.warehouse.name } : null,
    outlet: pr.outlet?.name ? { name: pr.outlet.name } : null,
    approvals: (pr.approvals ?? []).map((row, index) => ({
      id: index,
      level: row.level,
      user: row.user?.name ? { name: row.user.name } : null,
      status: row.status,
      acted_at: row.acted_at,
    })),
    items: (pr.items ?? []).map((item, index) => ({
      id: index,
      name_snapshot: item.name,
      product: item.sku ? { sku: item.sku } : null,
      qty: item.qty,
      unit: item.unit,
      suggested_unit_cost: item.suggested_unit_cost,
      note: item.note,
    })),
  }
}

export default function PublicPrView({ token }: { token: string }) {
  const { t, locale } = useI18n()
  const [pr, setPr] = useState<PublicPr | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void axios
      .get<{ data: PublicPr }>(`/api/v1/public/purchase-requisitions/${token}`)
      .then(({ data }) => setPr(data.data))
      .catch(() => setError(t('purchasePublicPrNotFound')))
  }, [token, t])

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      draft: t('purchaseStatusDraft'),
      submitted: t('purchaseStatusSubmitted'),
      approved: t('purchaseStatusApproved'),
      rejected: t('purchaseStatusRejected'),
      cancelled: t('purchaseStatusCancelled'),
    }
    return map[status] ?? status
  }

  return (
    <PublicDocPage
      badge={t('purchasePublicPrView')}
      error={error || undefined}
      loading={!error && !pr}
      loadingLabel={t('loading')}
    >
      {pr ? (
        <PrDetailView
          pr={mapPublicPr(pr)}
          locale={locale}
          t={t}
          statusLabel={statusLabel(pr.status)}
          subtitle={pr.company?.name}
        />
      ) : null}
    </PublicDocPage>
  )
}
