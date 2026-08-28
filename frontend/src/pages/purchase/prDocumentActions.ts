import { exportPrPdf } from '../../lib/purchaseRequisitionExport'
import { formatRupiah } from '../../lib/money'
import type { MsgKey } from '../../i18n'
import { ensurePrShareToken, prPublicUrl, prWhatsAppUrl } from './prShare'
import type { PrDetailViewData } from './PrDetailView'

export type PrDetailRecord = PrDetailViewData & {
  id: number
  share_token?: string | null
  can_share?: boolean
  pr_need_approval?: boolean
}

export function prStatusLabel(status: string, t: (key: MsgKey) => string) {
  const map: Record<string, string> = {
    draft: t('purchaseStatusDraft'),
    submitted: t('purchaseStatusSubmitted'),
    approved: t('purchaseStatusApproved'),
    rejected: t('purchaseStatusRejected'),
    cancelled: t('purchaseStatusCancelled'),
  }
  return map[status] ?? status
}

export async function runPrPdfExport(
  pr: PrDetailRecord,
  opts: {
    t: (key: MsgKey, params?: Record<string, string>) => string
    locale: string
    companyName?: string
    companyPhone?: string
    companyAddress?: string
  },
) {
  const { t, locale, companyName, companyPhone, companyAddress } = opts
  await exportPrPdf(
    pr,
    {
      title: t('purchasePrTitle'),
      warehouse: t('navWarehouses'),
      outlet: t('navOutlets'),
      neededAt: t('purchaseNeededAt'),
      note: t('purchaseNote'),
      product: t('product'),
      qty: t('posColQty'),
      unit: t('unit'),
      unitCost: t('purchaseUnitCost'),
      createdAt: t('createdAt'),
      createdBy: t('purchaseCreatedBy'),
      approvedBy: t('purchaseApprovedBy'),
      approvalLevel: t('purchaseApprovalLevel'),
      qrHint: t('purchasePrQrHint'),
      generatedBy: t('purchasePdfGeneratedBy'),
    },
    (value) => formatRupiah(value, locale),
    {
      companyName,
      companyPhone,
      companyAddress,
      statusLabel: prStatusLabel(pr.status, t),
    },
    locale,
  )
}

export async function runPrWhatsAppShare(
  pr: PrDetailRecord,
  t: (key: MsgKey, params?: Record<string, string>) => string,
) {
  const token = await ensurePrShareToken(pr.id, pr.share_token)
  const url = prPublicUrl(token)
  const message = t('purchasePrShareMessage', { number: pr.number, url })
  window.open(prWhatsAppUrl(message), '_blank', 'noopener,noreferrer')
  return token
}
