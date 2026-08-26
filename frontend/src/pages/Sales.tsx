import { useEffect, useState } from 'react'
import { api, apiMessage } from '../api/client'
import { formatDateTime, formatRupiah } from '../lib/money'
import type { ApiOk, ReceiptPayload, Sale } from '../types'
import { PageEnter } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { PageHeader, ReceiptModal } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { useI18n } from '../i18n'

export default function Sales() {
  const { t, locale } = useI18n()
  const feedback = useFeedback()
  const list = useListQuery()
  const [sales, setSales] = useState<Sale[]>([])
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<Sale[]>>('/sales', {
        params: {
          search: list.search || undefined,
          status: list.status === 'all' ? undefined : list.status,
          page: list.page,
          per_page: list.perPage,
        },
      })
      setSales(data.data)
      list.applyMeta(data.meta, data.data.length)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage])

  async function openReceipt(sale: Sale) {
    try {
      const { data } = await api.get<ApiOk<ReceiptPayload>>(`/sales/${sale.id}/receipt`)
      setReceipt(data.data)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function cancel(sale: Sale) {
    const ok = await feedback.confirm({
      title: t('cancelSaleTitle'),
      message: t('cancelSale', { number: sale.number }),
      confirmLabel: t('cancel'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.post(`/sales/${sale.id}/cancel`)
      await load()
      feedback.success(t('saleCancelled'))
    } catch (err) {
      feedback.error(apiMessage(err, t('cancelFailed')))
    }
  }

  return (
    <PageEnter>
      <PageHeader eyebrow={t('salesEyebrow')} title={t('salesTitle')} subtitle={t('salesSubtitle')} />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('searchSale')}
        statusOptions={[
          { value: 'all', label: t('filterAll') },
          { value: 'paid', label: t('paid') },
          { value: 'unpaid', label: t('unpaid') },
          { value: 'partial', label: t('partial') },
          { value: 'cancelled', label: t('cancelled') },
        ]}
      />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('number')}</th>
              <th className="px-4 py-3 font-medium">{t('time')}</th>
              <th className="px-4 py-3 font-medium">{t('cashier')}</th>
              <th className="px-4 py-3 font-medium">{t('total')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3 font-medium text-fg">{sale.number}</td>
                <td className="px-4 py-3 text-muted">{formatDateTime(sale.sold_at, locale)}</td>
                <td className="px-4 py-3">{sale.cashier?.name ?? '-'}</td>
                <td className="px-4 py-3 text-mint">{formatRupiah(sale.total, locale)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      sale.status === 'cancelled'
                        ? 'bg-rose-500/15 text-rose-300'
                        : sale.status === 'paid'
                          ? 'bg-mint/15 text-mint'
                          : 'bg-gold/15 text-gold'
                    }`}
                  >
                    {sale.status === 'cancelled'
                      ? t('cancelled')
                      : sale.status === 'paid'
                        ? t('paid')
                        : sale.status === 'partial'
                          ? t('partial')
                          : t('unpaid')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="mr-3 text-mint" onClick={() => void openReceipt(sale)}>
                    {t('receipt')}
                  </button>
                  {sale.status !== 'cancelled' ? (
                    <button type="button" className="text-rose-300" onClick={() => void cancel(sale)}>
                      {t('cancel')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={6}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </PageEnter>
  )
}
