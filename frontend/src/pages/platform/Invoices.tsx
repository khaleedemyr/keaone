import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, BillingInvoice } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { formatRupiah } from '../../lib/money'
import { useI18n } from '../../i18n'
import { usePlatformAccess } from '../../platform/access'

export default function PlatformInvoices() {
  const { t, locale } = useI18n()
  const { canManage } = usePlatformAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<BillingInvoice[]>([])

  async function load() {
    try {
      const { data } = await api.get<ApiOk<BillingInvoice[]>>('/platform/invoices', {
        params: {
          search: list.search || undefined,
          status: list.status === 'all' ? undefined : list.status,
          page: list.page,
          per_page: list.perPage,
        },
      })
      setItems(data.data)
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

  async function pay(item: BillingInvoice) {
    const ok = await feedback.confirm({
      title: t('markPaidTitle'),
      message: t('markPaidConfirm', { number: item.number }),
      confirmLabel: t('markPaid'),
    })
    if (!ok) return
    try {
      await api.post(`/platform/invoices/${item.id}/pay`)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function voidInv(item: BillingInvoice) {
    try {
      await api.post(`/platform/invoices/${item.id}/void`)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('platformEyebrow')} title={t('invoices')} subtitle={t('invoicesLead')} />
      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('searchInvoice')}
        statusOptions={[
          { value: 'all', label: t('filterAll') },
          { value: 'issued', label: t('issued') },
          { value: 'paid', label: t('paid') },
          { value: 'void', label: t('void') },
        ]}
      />
      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('number')}</th>
              <th className="px-4 py-3 font-medium">{t('navCompany')}</th>
              <th className="px-4 py-3 font-medium">{t('total')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="px-4 py-3">{item.number}</td>
                <td className="px-4 py-3">{item.company?.name ?? '-'}</td>
                <td className="px-4 py-3">{formatRupiah(item.amount, locale)}</td>
                <td className="px-4 py-3">
                  {item.status === 'paid' ? t('paid') : item.status === 'void' ? t('void') : t('issued')}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && item.status === 'issued' ? (
                    <>
                      <button type="button" className="mr-3 text-mint" onClick={() => void pay(item)}>
                        {t('markPaid')}
                      </button>
                      <button type="button" className="text-rose-300" onClick={() => void voidInv(item)}>
                        {t('void')}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={5}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />
    </div>
  )
}
