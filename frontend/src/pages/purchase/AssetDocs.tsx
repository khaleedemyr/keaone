import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'

type AssetRow = {
  id: number
  number: string
  product_id: number
  product?: { id: number; name: string; sku?: string | null }
  goods_receipt_id?: number | null
  outlet?: { id: number; name: string } | null
  name_snapshot: string
  acquisition_cost: number
  status: string
  serial_number?: string | null
  location?: string | null
  acquired_at?: string | null
  note?: string | null
}

function statusLabel(t: (k: MsgKey) => string, status: string) {
  const map: Record<string, MsgKey> = {
    active: 'procurementFixedAssetStatusActive',
    voided: 'procurementFixedAssetStatusVoided',
  }
  return t(map[status] ?? 'procurementFixedAssetStatusActive')
}

export default function AssetDocs() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'all')

  const [rows, setRows] = useState<AssetRow[]>([])
  const [viewing, setViewing] = useState<AssetRow | null>(null)
  const [editing, setEditing] = useState<AssetRow | null>(null)
  const [serialNumber, setSerialNumber] = useState('')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const canEdit = can('fixedassets', 'edit')

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'active', label: t('procurementFixedAssetStatusActive') },
      { value: 'voided', label: t('procurementFixedAssetStatusVoided') },
    ],
    [t],
  )

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<AssetRow[]>>('/assets', {
        params: {
          page: list.page,
          per_page: list.perPage,
          search: list.search || undefined,
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
    const handle = window.setTimeout(() => void loadRows(), 200)
    return () => window.clearTimeout(handle)
  }, [list.page, list.perPage, list.status, list.search]) // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit(row: AssetRow) {
    setEditing(row)
    setSerialNumber(row.serial_number ?? '')
    setLocation(row.location ?? '')
    setNote(row.note ?? '')
    setError('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      const { data } = await api.put<ApiOk<AssetRow>>(`/assets/${editing.id}`, {
        serial_number: serialNumber.trim() || null,
        location: location.trim() || null,
        note: note.trim() || null,
      })
      feedback.success(t('saved'))
      setEditing(null)
      setViewing(data.data)
      void loadRows()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('appProcurement')} title={t('procurementFixedAssetTitle')} />

      <MasterFilters
        search={list.search}
        onSearch={list.filters.onSearch}
        status={list.status}
        onStatus={list.filters.onStatus}
        statusOptions={statusOptions}
        searchPlaceholder={t('search')}
        perPage={list.perPage}
        onPerPage={list.filters.onPerPage}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3">{t('procurementFixedAssetNumber')}</th>
              <th className="px-4 py-3">{t('product')}</th>
              <th className="px-4 py-3 text-right">{t('procurementFixedAssetAcquisitionCost')}</th>
              <th className="px-4 py-3">{t('procurementFixedAssetAcquiredAt')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {t('emptyList')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <MasterNameButton onClick={() => setViewing(row)}>{row.number}</MasterNameButton>
                  </td>
                  <td className="px-4 py-3">{row.product?.name ?? row.name_snapshot}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(row.acquisition_cost, locale)}</td>
                  <td className="px-4 py-3 tabular-nums">{row.acquired_at ?? '—'}</td>
                  <td className="px-4 py-3">{statusLabel(t, row.status)}</td>
                  <td className="px-4 py-3">
                    {canEdit && row.status === 'active' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => openEdit(row)}>
                        {t('edit')}
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

      <MasterViewModal open={Boolean(viewing)} title={viewing?.number ?? ''} onClose={() => setViewing(null)} size="lg">
        {viewing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ViewField label={t('product')} value={viewing.product?.name ?? viewing.name_snapshot} />
            <ViewField label={t('status')} value={statusLabel(t, viewing.status)} />
            <ViewField
              label={t('procurementFixedAssetAcquisitionCost')}
              value={formatRupiah(viewing.acquisition_cost, locale)}
            />
            <ViewField label={t('procurementFixedAssetAcquiredAt')} value={viewing.acquired_at ?? '—'} />
            <ViewField label={t('procurementFixedAssetSerial')} value={viewing.serial_number ?? '—'} />
            <ViewField label={t('procurementFixedAssetLocation')} value={viewing.location ?? '—'} />
            <ViewField label={t('navOutlets')} value={viewing.outlet?.name ?? '—'} />
            <ViewField label={t('procurementFixedAssetGrLink')} value={viewing.goods_receipt_id ? `#${viewing.goods_receipt_id}` : '—'} />
            {viewing.note ? <ViewField label={t('purchaseNote')} value={viewing.note} /> : null}
          </div>
        ) : null}
      </MasterViewModal>

      <MasterModal
        open={Boolean(editing)}
        title={editing?.number ?? ''}
        onClose={() => setEditing(null)}
        error={error}
        saving={saving}
        onSubmit={onSubmit}
      >
        <div className="space-y-4">
          <label className="field-block">
            <span>{t('procurementFixedAssetSerial')}</span>
            <input className="field !mt-0" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </label>
          <label className="field-block">
            <span>{t('procurementFixedAssetLocation')}</span>
            <input className="field !mt-0" value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label className="field-block">
            <span>{t('purchaseNote')}</span>
            <textarea className="field !mt-0 min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </MasterModal>
    </div>
  )
}
