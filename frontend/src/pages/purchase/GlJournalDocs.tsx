import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterModal, MasterViewModal } from '../../components/MasterModal'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'

type JournalLine = {
  line_no: number
  debit: number
  credit: number
  note?: string | null
  account?: { id: number; code: string; name: string; account_type: string } | null
}

type JournalRow = {
  id: number
  number: string
  entry_date?: string | null
  source_type: string
  source_number?: string | null
  description?: string | null
  status: string
  total_debit: number
  total_credit: number
  user?: { id: number; name: string } | null
  lines?: JournalLine[]
}

export default function GlJournalDocs() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const feedback = useFeedback()
  const list = useListQuery(20, 'all')
  const glEnabled = me?.settings?.procurement_gl_posting_enabled === true
  const [rows, setRows] = useState<JournalRow[]>([])
  const [viewing, setViewing] = useState<JournalRow | null>(null)
  const [sourceFilter, setSourceFilter] = useState('all')

  const sourceOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'goods_receipt', label: t('glJournalSourceGr') },
      { value: 'goods_receipt_void', label: t('glJournalSourceGrVoid') },
      { value: 'vendor_invoice', label: t('glJournalSourceInvoice') },
      { value: 'vendor_payment_batch', label: t('glJournalSourcePayment') },
    ],
    [t],
  )

  function sourceLabel(type: string) {
    const map: Record<string, MsgKey> = {
      goods_receipt: 'glJournalSourceGr',
      goods_receipt_void: 'glJournalSourceGrVoid',
      vendor_invoice: 'glJournalSourceInvoice',
      vendor_payment_batch: 'glJournalSourcePayment',
    }
    return t(map[type] ?? 'glJournalSourceOther')
  }

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<JournalRow[]>>('/gl-journals', {
        params: {
          page: list.page,
          per_page: list.perPage,
          search: list.search || undefined,
          source_type: sourceFilter !== 'all' ? sourceFilter : undefined,
        },
      })
      setRows(data.data ?? [])
      list.applyMeta(data.meta, data.data?.length ?? 0)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    if (!glEnabled) return
    const handle = window.setTimeout(() => void loadRows(), 200)
    return () => window.clearTimeout(handle)
  }, [list.page, list.perPage, list.search, sourceFilter, glEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(row: JournalRow) {
    try {
      const { data } = await api.get<ApiOk<JournalRow>>(`/gl-journals/${row.id}`)
      setViewing(data.data)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  if (!glEnabled) {
    return (
      <div>
        <PageHeader eyebrow={t('appProcurement')} title={t('glJournalTitle')} subtitle={t('glJournalSubtitle')} />
        <p className="text-sm text-muted">{t('glJournalDisabledHint')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader eyebrow={t('appProcurement')} title={t('glJournalTitle')} subtitle={t('glJournalSubtitle')} />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('glJournalSearch')}
        extra={
          <select className="field !mt-0 w-auto min-w-[10rem]" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            {sourceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="glass overflow-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('number')}</th>
              <th className="px-4 py-3">{t('date')}</th>
              <th className="px-4 py-3">{t('glJournalSource')}</th>
              <th className="px-4 py-3">{t('glJournalRef')}</th>
              <th className="px-4 py-3">{t('glJournalDebit')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {t('glJournalEmpty')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3 font-medium">{row.number}</td>
                  <td className="px-4 py-3">{row.entry_date ?? '—'}</td>
                  <td className="px-4 py-3">{sourceLabel(row.source_type)}</td>
                  <td className="px-4 py-3">{row.source_number ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{formatRupiah(row.total_debit, locale)}</td>
                  <td className="px-4 py-3">
                    <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void openDetail(row)}>
                      {t('view')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterViewModal open={Boolean(viewing)} title={viewing?.number ?? t('glJournalTitle')} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">{viewing.description}</p>
            <div className="overflow-auto rounded-2xl border border-line">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-line text-[11px] uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">{t('glAccountCode')}</th>
                    <th className="px-3 py-2">{t('name')}</th>
                    <th className="px-3 py-2">{t('glJournalDebit')}</th>
                    <th className="px-3 py-2">{t('glJournalCredit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.lines ?? []).map((line) => (
                    <tr key={line.line_no} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2">{line.account?.code}</td>
                      <td className="px-3 py-2">{line.account?.name}</td>
                      <td className="px-3 py-2 tabular-nums">{line.debit > 0 ? formatRupiah(line.debit, locale) : '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{line.credit > 0 ? formatRupiah(line.credit, locale) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </MasterViewModal>
    </div>
  )
}
