import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'

type WithholdingRow = {
  id: number
  supplier?: { id: number; name: string } | null
  invoice_number: string
  withholding_tax_type: string
  withholding_tax_rate: number
  withholding_tax_base: string
  base_amount: number
  withholding_amount: number
  payment_amount: number
  status: string
  withheld_at?: string | null
  remitted_at?: string | null
}

export default function WithholdingTaxDocs() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'withheld')
  const whtEnabled = me?.settings?.procurement_withholding_tax_enabled === true
  const canEdit = can('vendorwithholding', 'edit')

  const [rows, setRows] = useState<WithholdingRow[]>([])
  const [typeFilter, setTypeFilter] = useState('all')
  const [saving, setSaving] = useState(false)

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'withheld', label: t('procurementWithholdingStatusWithheld') },
      { value: 'remitted', label: t('procurementWithholdingStatusRemitted') },
    ],
    [t],
  )

  const typeOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'pph23', label: t('supplierWithholdingTypePph23') },
      { value: 'pph22', label: t('supplierWithholdingTypePph22') },
      { value: 'pph42', label: t('supplierWithholdingTypePph42') },
    ],
    [t],
  )

  function typeLabel(type: string) {
    const map: Record<string, MsgKey> = {
      pph23: 'supplierWithholdingTypePph23',
      pph22: 'supplierWithholdingTypePph22',
      pph42: 'supplierWithholdingTypePph42',
    }
    return t(map[type] ?? 'supplierWithholdingTypePph23')
  }

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<WithholdingRow[]>>('/vendor-withholding', {
        params: {
          page: list.page,
          per_page: list.perPage,
          search: list.search || undefined,
          status: list.status !== 'all' ? list.status : undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
        },
      })
      setRows(data.data ?? [])
      list.applyMeta(data.meta, data.data?.length ?? 0)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    if (!whtEnabled) return
    const handle = window.setTimeout(() => void loadRows(), 200)
    return () => window.clearTimeout(handle)
  }, [list.page, list.perPage, list.status, list.search, typeFilter, whtEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  async function remit(row: WithholdingRow) {
    if (!window.confirm(t('procurementWithholdingRemitConfirm', { number: row.invoice_number }))) return
    setSaving(true)
    try {
      await api.post(`/vendor-withholding/${row.id}/remit`)
      feedback.success(t('saved'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  if (!whtEnabled) {
    return (
      <div>
        <PageHeader eyebrow={t('appProcurement')} title={t('procurementWithholdingTitle')} subtitle={t('procurementWithholdingSubtitle')} />
        <p className="text-sm text-muted">{t('procurementWithholdingDisabledHint')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader eyebrow={t('appProcurement')} title={t('procurementWithholdingTitle')} subtitle={t('procurementWithholdingSubtitle')} />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('procurementWithholdingSearch')}
        statusOptions={statusOptions}
        extra={
          <select className="field !mt-0 w-auto min-w-[10rem]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {typeOptions.map((opt) => (
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
              <th className="px-4 py-3">{t('procurementInvoiceTitle')}</th>
              <th className="px-4 py-3">{t('navSuppliers')}</th>
              <th className="px-4 py-3">{t('supplierWithholdingType')}</th>
              <th className="px-4 py-3">{t('procurementWithholdingPaymentAmount')}</th>
              <th className="px-4 py-3">{t('procurementWithholdingAmount')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  {t('procurementWithholdingEmpty')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3 font-medium">{row.invoice_number}</td>
                  <td className="px-4 py-3">{row.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {typeLabel(row.withholding_tax_type)}
                    <div className="text-xs text-muted">{row.withholding_tax_rate}%</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatRupiah(row.payment_amount, locale)}</td>
                  <td className="px-4 py-3 tabular-nums font-medium">{formatRupiah(row.withholding_amount, locale)}</td>
                  <td className="px-4 py-3">
                    {row.status === 'remitted' ? t('procurementWithholdingStatusRemitted') : t('procurementWithholdingStatusWithheld')}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && row.status === 'withheld' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" disabled={saving} onClick={() => void remit(row)}>
                        {t('procurementWithholdingRemit')}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />
    </div>
  )
}
