import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterModal } from '../../components/MasterModal'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import { matchExceptionDetail } from './matchExceptionMessages'

type ExceptionRow = {
  id: number
  vendor_invoice_id: number
  vendor_invoice?: { id: number; number: string; status: string; match_status?: string | null } | null
  vendor_invoice_item?: { id: number; name_snapshot?: string; qty?: number; unit_cost?: number } | null
  exception_type: string
  field_name?: string | null
  expected_value?: string | null
  actual_value?: string | null
  variance_percent?: number | null
  goods_receipt_item_id?: number | null
  message?: string | null
  status: string
  resolver?: { id: number; name: string } | null
  resolved_at?: string | null
  note?: string | null
  created_at?: string | null
}

export default function MatchExceptionDocs() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'open')
  const matchEnabled = me?.settings?.procurement_match_enabled === true
  const canEdit = can('matchexceptions', 'edit')

  const [rows, setRows] = useState<ExceptionRow[]>([])
  const [waiveTarget, setWaiveTarget] = useState<ExceptionRow | null>(null)
  const [waiveNote, setWaiveNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'open', label: t('procurementMatchExceptionOpen') },
      { value: 'waived', label: t('procurementMatchExceptionWaived') },
    ],
    [t],
  )

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<ExceptionRow[]>>('/match-exceptions', {
        params: {
          page: list.page,
          per_page: list.perPage,
          status: list.status !== 'all' ? list.status : undefined,
        },
      })
      setRows(data.data ?? [])
      list.applyMeta(data.meta, data.data?.length ?? 0)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    if (!matchEnabled) return
    void loadRows()
  }, [list.page, list.perPage, list.status, matchEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  function typeLabel(type: string) {
    const map: Record<string, MsgKey> = {
      qty: 'procurementMatchTypeQty',
      price: 'procurementMatchTypePrice',
      missing_po: 'procurementMatchTypeMissingPo',
      missing_gr: 'procurementMatchTypeMissingGr',
    }
    return t(map[type] ?? 'procurementMatchTypeOther')
  }

  async function confirmWaive() {
    if (!waiveTarget) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/match-exceptions/${waiveTarget.id}/waive`, { note: waiveNote || undefined })
      setWaiveTarget(null)
      setWaiveNote('')
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  if (!matchEnabled) {
    return (
      <div>
        <PageHeader eyebrow={t('appProcurement')} title={t('procurementMatchTitle')} subtitle={t('procurementMatchSubtitle')} />
        <p className="text-sm text-muted">{t('procurementMatchDisabledHint')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader eyebrow={t('appProcurement')} title={t('procurementMatchTitle')} subtitle={t('procurementMatchSubtitle')} />

      <MasterFilters {...list.filters} searchPlaceholder={t('procurementMatchSearch')} statusOptions={statusOptions} />

      <div className="glass overflow-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('procurementInvoiceTitle')}</th>
              <th className="px-4 py-3">{t('product')}</th>
              <th className="px-4 py-3">{t('procurementMatchType')}</th>
              <th className="px-4 py-3">{t('procurementMatchExpected')}</th>
              <th className="px-4 py-3">{t('procurementMatchActual')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  {t('procurementMatchEmpty')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3 font-medium">{row.vendor_invoice?.number ?? `#${row.vendor_invoice_id}`}</td>
                  <td className="px-4 py-3">{row.vendor_invoice_item?.name_snapshot ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div>{typeLabel(row.exception_type)}</div>
                    {(() => {
                      const detail = matchExceptionDetail(row, t, locale)
                      return detail ? <div className="text-xs text-muted">{detail}</div> : null
                    })()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.field_name === 'unit_cost' && row.expected_value
                      ? formatRupiah(Number(row.expected_value), locale)
                      : row.expected_value ?? '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.field_name === 'unit_cost' && row.actual_value
                      ? formatRupiah(Number(row.actual_value), locale)
                      : row.actual_value ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'open' ? t('procurementMatchExceptionOpen') : t('procurementMatchExceptionWaived')}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && row.status === 'open' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => setWaiveTarget(row)}>
                        {t('procurementMatchWaive')}
                      </button>
                    ) : row.resolver ? (
                      <span className="text-xs text-muted">{row.resolver.name}</span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={Boolean(waiveTarget)}
        title={t('procurementMatchWaive')}
        error={error}
        saving={saving}
        onClose={() => {
          setWaiveTarget(null)
          setWaiveNote('')
          setError('')
        }}
        onSubmit={(e) => {
          e.preventDefault()
          void confirmWaive()
        }}
      >
        {waiveTarget ? (
          <>
            <p className="text-sm text-muted">{matchExceptionDetail(waiveTarget, t, locale)}</p>
            <label className="block text-sm text-muted">
              {t('purchaseNote')}
              <textarea className="field" rows={3} value={waiveNote} onChange={(e) => setWaiveNote(e.target.value)} />
            </label>
          </>
        ) : null}
      </MasterModal>
    </div>
  )
}
