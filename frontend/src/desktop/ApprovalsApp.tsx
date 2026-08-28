import { useCallback, useEffect, useState } from 'react'
import { api, apiMessage } from '../api/client'
import { FormAlert, useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { useAccess } from '../access'
import { useI18n } from '../i18n'
import type { ApiOk } from '../types'

type PrLine = {
  id: number
  product_id?: number
  name_snapshot?: string
  qty: number
  unit?: string | null
}

type ApprovalItem = {
  type: string
  id: number
  title: string
  subtitle?: string | null
  level?: number
  status: string
  created_at?: string | null
  can_approve?: boolean
  payload?: {
    note?: string | null
    warehouse?: { id: number; name: string } | null
    items?: PrLine[]
  }
}

type DraftLine = {
  id: number
  name: string
  qty: number
  maxQty: number
  unit: string
}

function draftsFromRow(row: ApprovalItem): DraftLine[] {
  return (row.payload?.items ?? [])
    .filter((item) => item.id)
    .map((item) => ({
      id: item.id,
      name: item.name_snapshot ?? '—',
      qty: item.qty,
      maxQty: item.qty,
      unit: item.unit ?? '',
    }))
}

export default function ApprovalsApp() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canAct = can('approvals', 'edit')
  const [rows, setRows] = useState<ApprovalItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftLine[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<ApiOk<ApprovalItem[]>>('/approvals/pending')
      const next = data.data ?? []
      setRows(next)
      setDrafts(
        Object.fromEntries(next.map((row) => [`${row.type}:${row.id}`, draftsFromRow(row)])),
      )
    } catch (err) {
      setError(apiMessage(err, t('loadFailed')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  function setQty(key: string, lineId: number, raw: string) {
    const digits = raw.replace(/\D/g, '')
    const value = digits === '' ? 0 : Number(digits)
    setDrafts((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).map((line) => {
        if (line.id !== lineId) return line
        const qty = Math.min(line.maxQty, Math.max(0, value))
        return { ...line, qty }
      }),
    }))
  }

  function removeLine(key: string, lineId: number) {
    setDrafts((prev) => {
      const next = (prev[key] ?? []).filter((line) => line.id !== lineId)
      if (next.length === 0) {
        feedback.error(t('approvalsNeedOneItem'))
        return prev
      }
      return { ...prev, [key]: next }
    })
  }

  async function act(row: ApprovalItem, action: 'approve' | 'reject') {
    if (!canAct) return
    if (row.type !== 'purchase_requisition' && row.type !== 'purchase_order') return
    const key = `${row.type}:${row.id}`
    const lines = drafts[key] ?? draftsFromRow(row)

    if (action === 'approve') {
      if (lines.length === 0 || lines.some((line) => line.qty < 1)) {
        feedback.error(t('approvalsNeedOneItem'))
        return
      }
    }

    const ok = await feedback.confirm({
      title: t('purchaseActionConfirm'),
      message: `${row.title} · ${action === 'approve' ? t('purchaseApprove') : t('purchaseReject')}`,
      tone: action === 'reject' ? 'danger' : 'default',
    })
    if (!ok) return

    setBusyId(key)
    try {
      const endpoint =
        row.type === 'purchase_order'
          ? `/purchase-orders/${row.id}`
          : `/purchase-requisitions/${row.id}`
      if (action === 'approve') {
        await api.post(`${endpoint}/approve`, {
          items: lines.map((line) => ({ id: line.id, qty: line.qty })),
        })
      } else {
        await api.post(`${endpoint}/reject`)
      }
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setBusyId(null)
    }
  }

  function kindLabel(type: string) {
    if (type === 'purchase_requisition') return t('approvalsKindPr')
    if (type === 'purchase_order') return t('approvalsKindPo')
    return type
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-4 md:p-5">
      <div className="space-y-4">
        <PageHeader
          eyebrow={t('appApprovals')}
          title={t('approvalsTitle')}
          subtitle={t('approvalsSubtitle')}
        />
        {error ? <FormAlert>{error}</FormAlert> : null}

        {loading ? (
          <p className="text-sm text-muted">{t('loadingWork')}</p>
        ) : rows.length === 0 ? (
          <div className="glass rounded-3xl p-6 text-sm text-muted">{t('approvalsEmpty')}</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const key = `${row.type}:${row.id}`
              const busy = busyId === key
              const lines = drafts[key] ?? draftsFromRow(row)
              const editable = canAct && Boolean(row.can_approve)
              return (
                <article key={key} className="glass rounded-3xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-muted">{kindLabel(row.type)}</div>
                      <h3 className="mt-0.5 text-base font-semibold text-fg">{row.title}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {t('approvalsRequester')}: {row.subtitle || '—'}
                        {row.level ? ` · ${t('approvalsLevel', { n: String(row.level) })}` : null}
                        {row.payload?.warehouse?.name ? ` · ${row.payload.warehouse.name}` : null}
                      </p>
                      {row.created_at ? (
                        <p className="mt-0.5 text-[11px] text-muted">
                          {new Date(row.created_at).toLocaleString(locale)}
                        </p>
                      ) : null}
                      {row.payload?.note ? (
                        <p className="mt-2 text-sm text-fg">{row.payload.note}</p>
                      ) : null}
                    </div>
                    {editable ? (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={busy}
                          onClick={() => void act(row, 'approve')}
                        >
                          {t('purchaseApprove')}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={busy}
                          onClick={() => void act(row, 'reject')}
                        >
                          {t('purchaseReject')}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {lines.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      {editable ? (
                        <p className="text-[11px] text-muted">{t('approvalsEditItemsHint')}</p>
                      ) : null}
                      {lines.map((line) => (
                        <div
                          key={`${key}-item-${line.id}`}
                          className="flex flex-wrap items-center gap-2 text-sm text-fg"
                        >
                          <span className="min-w-0 flex-1 truncate">{line.name}</span>
                          {editable ? (
                            <>
                              <label className="flex items-center gap-1 text-muted">
                                <span className="text-[11px]">{t('approvalsQty')}</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="field w-20 py-1 text-center"
                                  value={line.qty || ''}
                                  disabled={busy}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onChange={(e) => setQty(key, line.id, e.target.value)}
                                />
                                {line.unit ? <span className="text-xs">{line.unit}</span> : null}
                                <span className="text-[10px] text-muted">/ {line.maxQty}</span>
                              </label>
                              <button
                                type="button"
                                className="btn-ghost px-2 py-1 text-xs"
                                disabled={busy || lines.length <= 1}
                                onClick={() => removeLine(key, line.id)}
                              >
                                {t('approvalsRemoveItem')}
                              </button>
                            </>
                          ) : (
                            <span className="text-muted">
                              {line.qty}
                              {line.unit ? ` ${line.unit}` : ''}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
