import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { formatRupiah } from '../../lib/money'
import type { ApiOk } from '../../types'
import { PageEnter, TiltCard } from '../../components/motion'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'

type DashboardRecent = {
  type: string
  id: number
  number: string
  status: string
  subtitle?: string | null
  expected_at?: string | null
  created_at?: string | null
}

type DashboardData = {
  flow: 'strict_pr_po_gr' | 'po_gr' | 'direct'
  return_enabled: boolean
  adjustment_enabled: boolean
  delivery_schedule_enabled: boolean
  vendor_invoice_enabled?: boolean
  match_enabled?: boolean
  vendor_payment_batch_enabled?: boolean
  month: string
  spend_mtd: number
  counts: {
    pr_draft: number
    pr_submitted: number
    po_draft: number
    po_submitted: number
    po_open: number
    po_overdue: number
    gr_draft: number
    return_submitted: number
    adjustment_draft: number
    invoice_draft: number
    invoice_submitted: number
    invoice_payable: number
    payment_batch_draft: number
    payment_batch_submitted: number
    match_exception_open: number
    delivery_overdue: number
  }
  recent: DashboardRecent[]
}

type Section = 'dashboard' | 'pr' | 'po' | 'gr' | 'direct' | 'return' | 'adjustments' | 'delivery' | 'invoices' | 'match' | 'payments' | 'settings'

const TYPE_SECTION: Record<string, Section | undefined> = {
  purchase_requisition: 'pr',
  purchase_order: 'po',
  goods_receipt: 'gr',
  purchase_return: 'return',
  vendor_adjustment_note: 'adjustments',
  delivery_schedule: 'delivery',
}

const TYPE_LABEL: Record<string, MsgKey> = {
  purchase_requisition: 'approvalsKindPr',
  purchase_order: 'approvalsKindPo',
  goods_receipt: 'purchaseGrTitle',
  purchase_return: 'approvalsKindReturn',
  vendor_adjustment_note: 'procurementAdjustmentTitle',
  delivery_schedule: 'procurementDeliveryTitle',
}

const STATUS_LABEL: Record<string, MsgKey> = {
  draft: 'purchaseStatusDraft',
  submitted: 'purchaseStatusSubmitted',
  approved: 'purchaseStatusApproved',
  ordered: 'purchaseStatusOrdered',
  partial: 'purchaseStatusPartial',
  confirmed: 'purchaseStatusConfirmed',
}

export default function ProcurementDashboard({ onNavigate }: { onNavigate?: (section: Section) => void }) {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const feedback = useFeedback()
  const flow = (me?.settings?.purchase_flow ?? 'direct') as DashboardData['flow']
  const returnEnabled = me?.settings?.return_enabled !== false
  const adjustmentEnabled = me?.settings?.vendor_adjustment_enabled !== false
  const deliveryEnabled = me?.settings?.delivery_schedule_enabled !== false
  const invoiceEnabled = me?.settings?.vendor_invoice_enabled === true
  const matchEnabled = me?.settings?.procurement_match_enabled === true
  const paymentBatchEnabled = me?.settings?.vendor_payment_batch_enabled === true
  const autoReorderEnabled = me?.settings?.procurement_auto_reorder_enabled === true
  const demandPlanningEnabled = me?.settings?.procurement_demand_planning_enabled === true

  const [data, setData] = useState<DashboardData | null>(null)
  const [failed, setFailed] = useState(false)
  const [reorderPreview, setReorderPreview] = useState<Array<{ product_id: number; name: string; stock_qty: number; suggested_qty: number }>>([])
  const [forecasts, setForecasts] = useState<Array<{ id: number; product_name?: string; forecast_qty: number }>>([])
  const [compliance, setCompliance] = useState<
    Array<{ supplier_id: number; supplier_name?: string; doc_type: string; expires_at?: string; is_expired: boolean }>
  >([])

  useEffect(() => {
    void api
      .get<ApiOk<DashboardData>>('/procurement/dashboard')
      .then(({ data: res }) => {
        setData(res.data)
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        feedback.error(apiMessage(err, t('loadFailed')))
      })
  }, [feedback, t])

  useEffect(() => {
    void api
      .get<ApiOk<typeof compliance>>('/suppliers/compliance-alerts')
      .then(({ data: res }) => setCompliance(res.data))
      .catch(() => setCompliance([]))
  }, [])

  useEffect(() => {
    if (!autoReorderEnabled || flow !== 'strict_pr_po_gr') {
      setReorderPreview([])
      return
    }
    void api
      .get<ApiOk<typeof reorderPreview>>('/procurement-planning/auto-reorder/preview')
      .then(({ data: res }) => setReorderPreview(res.data ?? []))
      .catch(() => setReorderPreview([]))
  }, [autoReorderEnabled, flow])

  useEffect(() => {
    if (!demandPlanningEnabled || flow !== 'strict_pr_po_gr') {
      setForecasts([])
      return
    }
    void api
      .get<ApiOk<typeof forecasts>>('/procurement-planning/demand/forecasts')
      .then(({ data: res }) => setForecasts(res.data ?? []))
      .catch(() => setForecasts([]))
  }, [demandPlanningEnabled, flow])

  const cards = useMemo(() => {
    if (!data) return []
    const c = data.counts
    const items: Array<{ key: string; label: MsgKey; value: number; hint: MsgKey; tone: string; section?: Section }> = []

    if (flow === 'strict_pr_po_gr') {
      items.push(
        { key: 'pr_sub', label: 'procurementDashPrPending', value: c.pr_submitted, hint: 'procurementDashPrPendingHint', tone: 'from-violet/20', section: 'pr' },
        { key: 'pr_draft', label: 'procurementDashPrDraft', value: c.pr_draft, hint: 'procurementDashPrDraftHint', tone: 'from-cyan-400/20', section: 'pr' },
      )
    }

    if (flow === 'strict_pr_po_gr' || flow === 'po_gr') {
      items.push(
        { key: 'po_sub', label: 'procurementDashPoPending', value: c.po_submitted, hint: 'procurementDashPoPendingHint', tone: 'from-mint/20', section: 'po' },
        { key: 'po_open', label: 'procurementDashPoOpen', value: c.po_open, hint: 'procurementDashPoOpenHint', tone: 'from-gold/20', section: 'po' },
        { key: 'po_over', label: 'procurementDashPoOverdue', value: c.po_overdue, hint: 'procurementDashPoOverdueHint', tone: 'from-rose-400/20', section: 'po' },
      )
    }

    items.push({
      key: 'gr_draft',
      label: 'procurementDashGrDraft',
      value: c.gr_draft,
      hint: 'procurementDashGrDraftHint',
      tone: 'from-sky-400/20',
      section: flow === 'direct' ? 'direct' : 'gr',
    })

    if (returnEnabled) {
      items.push({
        key: 'ret_sub',
        label: 'procurementDashReturnPending',
        value: c.return_submitted,
        hint: 'procurementDashReturnPendingHint',
        tone: 'from-orange-400/20',
        section: 'return',
      })
    }

    if (adjustmentEnabled) {
      items.push({
        key: 'adj_draft',
        label: 'procurementDashAdjustmentDraft',
        value: c.adjustment_draft,
        hint: 'procurementDashAdjustmentDraftHint',
        tone: 'from-indigo-400/20',
        section: 'adjustments',
      })
    }

    if (deliveryEnabled && (flow === 'strict_pr_po_gr' || flow === 'po_gr')) {
      items.push({
        key: 'del_over',
        label: 'procurementDashDeliveryOverdue',
        value: c.delivery_overdue,
        hint: 'procurementDashDeliveryOverdueHint',
        tone: 'from-amber-400/20',
        section: 'delivery',
      })
    }

    if (invoiceEnabled) {
      items.push(
        {
          key: 'inv_draft',
          label: 'procurementDashInvoiceDraft',
          value: c.invoice_draft,
          hint: 'procurementDashInvoiceDraftHint',
          tone: 'from-teal-400/20',
          section: 'invoices',
        },
        {
          key: 'inv_sub',
          label: 'procurementDashInvoiceSubmitted',
          value: c.invoice_submitted,
          hint: 'procurementDashInvoiceSubmittedHint',
          tone: 'from-lime-400/20',
          section: 'invoices',
        },
      )
    }

    if (matchEnabled) {
      items.push({
        key: 'match_open',
        label: 'procurementDashMatchOpen',
        value: c.match_exception_open,
        hint: 'procurementDashMatchOpenHint',
        tone: 'from-red-400/20',
        section: 'match',
      })
    }

    if (paymentBatchEnabled) {
      items.push(
        {
          key: 'inv_payable',
          label: 'procurementDashInvoicePayable',
          value: c.invoice_payable,
          hint: 'procurementDashInvoicePayableHint',
          tone: 'from-yellow-400/20',
          section: 'invoices',
        },
        {
          key: 'pay_draft',
          label: 'procurementDashPaymentBatchDraft',
          value: c.payment_batch_draft,
          hint: 'procurementDashPaymentBatchDraftHint',
          tone: 'from-fuchsia-400/20',
          section: 'payments',
        },
        {
          key: 'pay_sub',
          label: 'procurementDashPaymentBatchSubmitted',
          value: c.payment_batch_submitted,
          hint: 'procurementDashPaymentBatchSubmittedHint',
          tone: 'from-pink-400/20',
          section: 'payments',
        },
      )
    }

    return items
  }, [data, flow, returnEnabled, adjustmentEnabled, deliveryEnabled, invoiceEnabled, matchEnabled, paymentBatchEnabled])

  if (!data) {
    return (
      <PageEnter>
        <PageHeader eyebrow={t('appProcurement')} title={t('procurementDashTitle')} subtitle={t('procurementDashSubtitle')} />
        <div className="text-muted">{failed ? t('loadFailed') : t('loading')}</div>
      </PageEnter>
    )
  }

  return (
    <PageEnter>
      <PageHeader
        eyebrow={t('appProcurement')}
        title={t('procurementDashTitle')}
        subtitle={`${t('procurementDashSubtitle')} · ${data.month}`}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TiltCard>
          <div className="glass relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-400/20 to-transparent p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{t('procurementDashSpendMtd')}</div>
            <div className="mt-3 font-display text-2xl font-bold text-fg">{formatRupiah(data.spend_mtd, locale)}</div>
            <div className="mt-2 text-xs text-muted">{t('procurementDashSpendMtdHint')}</div>
          </div>
        </TiltCard>
        {cards.map((card) => (
          <TiltCard key={card.key}>
            <button
              type="button"
              className={`glass relative w-full overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-left ${card.tone} to-transparent`}
              onClick={() => card.section && onNavigate?.(card.section)}
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{t(card.label)}</div>
              <div className="mt-3 font-display text-2xl font-bold text-fg">{card.value}</div>
              <div className="mt-2 text-xs text-muted">{t(card.hint)}</div>
            </button>
          </TiltCard>
        ))}
      </div>

      {(autoReorderEnabled || demandPlanningEnabled) && flow === 'strict_pr_po_gr' ? (
        <div className="glass mb-4 rounded-3xl p-5">
          <div className="mb-4 text-sm font-medium text-fg">{t('procurementDashPlanning')}</div>
          {autoReorderEnabled ? (
            <div className="mb-4">
              <div className="text-xs text-muted">{t('procurementAutoReorderTitle')} ({reorderPreview.length})</div>
              {reorderPreview.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-primary mt-2 text-sm"
                  onClick={() => void api.post('/procurement-planning/auto-reorder/run').then(() => {
                    feedback.success(t('procurementAutoReorderOk'))
                    onNavigate?.('pr')
                  }).catch((err) => feedback.error(apiMessage(err, t('actionFailed'))))}
                >
                  {t('procurementAutoReorderRun')}
                </button>
              ) : (
                <p className="mt-1 text-sm text-muted">{t('procurementAutoReorderEmpty')}</p>
              )}
            </div>
          ) : null}
          {demandPlanningEnabled ? (
            <div>
              <div className="text-xs text-muted">{t('procurementDemandPlanningTitle')} ({forecasts.length})</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost text-sm" onClick={() => void api.post('/procurement-planning/demand/generate').then(({ data: res }) => setForecasts(res.data ?? [])).catch((err) => feedback.error(apiMessage(err, t('actionFailed'))))}>{t('procurementDemandGenerate')}</button>
                {forecasts.length > 0 ? (
                  <button type="button" className="btn btn-primary text-sm" onClick={() => void api.post('/procurement-planning/demand/suggest-pr').then(() => { feedback.success(t('procurementDemandSuggestOk')); onNavigate?.('pr') }).catch((err) => feedback.error(apiMessage(err, t('actionFailed'))))}>{t('procurementDemandSuggestPr')}</button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {compliance.length > 0 ? (
        <div className="glass mb-4 rounded-3xl p-5">
          <div className="mb-4 text-sm font-medium text-fg">{t('procurementDashCompliance')}</div>
          <div className="space-y-2">
            {compliance.map((row) => (
              <div
                key={`${row.supplier_id}-${row.doc_type}-${row.expires_at}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-fg">{row.supplier_name ?? `#${row.supplier_id}`}</div>
                  <div className="text-xs uppercase text-muted">{row.doc_type}</div>
                </div>
                <div className={`text-xs ${row.is_expired ? 'text-rose-500' : 'text-amber-500'}`}>
                  {row.is_expired ? t('procurementDashComplianceExpired') : t('procurementDashComplianceExpiring')}
                  {row.expires_at ? ` · ${row.expires_at}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="glass rounded-3xl p-5">
        <div className="mb-4 text-sm font-medium text-fg">{t('procurementDashRecent')}</div>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted">{t('procurementDashRecentEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {data.recent.map((row) => {
              const section = TYPE_SECTION[row.type]
              const overdue = row.expected_at && row.status !== 'received' && row.expected_at < new Date().toISOString().slice(0, 10)
              return (
                <button
                  key={`${row.type}-${row.id}`}
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-3 py-2 text-left text-sm hover:bg-fill/60"
                  onClick={() => section && onNavigate?.(section)}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted">{t(TYPE_LABEL[row.type] ?? 'procurementDashDoc')}</div>
                    <div className="font-medium text-fg">{row.number}</div>
                    <div className="text-xs text-muted">{row.subtitle || '—'}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-fg">{t(STATUS_LABEL[row.status] ?? 'purchaseStatusDraft')}</div>
                    {overdue ? <div className="text-rose-500">{t('procurementDashOverdue')}</div> : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </PageEnter>
  )
}
