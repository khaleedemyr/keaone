import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Product, ProductUnitLevel } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'
import { formatRupiah } from '../../lib/money'

type Party = { id: number; name: string }

type PriceRow = {
  id: number
  supplier_id: number
  supplier?: { id: number; name: string } | null
  product_id: number
  product?: { id: number; name: string; sku?: string | null } | null
  unit_cost: number
  unit?: string | null
  unit_level?: ProductUnitLevel | null
  factor_to_base?: number
  min_qty?: number | null
  valid_from?: string | null
  valid_to?: string | null
  note?: string | null
  is_active: boolean
}

export default function VendorPriceListDocs() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20, 'all')
  const enabled = me?.settings?.procurement_vendor_price_list_enabled === true

  const [rows, setRows] = useState<PriceRow[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<PriceRow | null>(null)
  const [editing, setEditing] = useState<PriceRow | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [productId, setProductId] = useState('')
  const [unitLevel, setUnitLevel] = useState<ProductUnitLevel>('small')
  const [unitCost, setUnitCost] = useState('')
  const [minQty, setMinQty] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [note, setNote] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = can('supplierpricelists', 'create')
  const canEdit = can('supplierpricelists', 'edit')
  const canDelete = can('supplierpricelists', 'delete')

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filterAll') },
      { value: 'active', label: t('active') },
      { value: 'inactive', label: t('inactive') },
    ],
    [t],
  )

  const selectedProduct = products.find((p) => String(p.id) === productId)
  const unitOptions = selectedProduct?.units?.length
    ? selectedProduct.units
    : [{ level: 'small' as const, label: selectedProduct?.unit || 'pcs', factor_to_base: 1, unit_id: 0, unit: null }]

  async function loadRefs() {
    try {
      const [supRes, prodRes] = await Promise.all([
        api.get<ApiOk<Party[]>>('/suppliers', { params: { for_select: 1, status: 'active', per_page: 200 }, silent: true }),
        api.get<ApiOk<Product[]>>('/products', { params: { for_select: 1, for_purchase: 1, status: 'active' }, silent: true }),
      ])
      setSuppliers(supRes.data.data ?? [])
      setProducts(prodRes.data.data ?? [])
    } catch {
      setSuppliers([])
      setProducts([])
    }
  }

  async function loadRows() {
    try {
      const { data } = await api.get<ApiOk<PriceRow[]>>('/supplier-product-prices', {
        params: {
          page: list.page,
          per_page: list.perPage,
          search: list.search || undefined,
          is_active: list.status === 'all' ? undefined : list.status === 'active',
        },
      })
      setRows(data.data ?? [])
      list.applyMeta(data.meta, data.data?.length ?? 0)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void loadRefs()
  }, [])

  useEffect(() => {
    if (!enabled) return
    const handle = window.setTimeout(() => void loadRows(), 200)
    return () => window.clearTimeout(handle)
  }, [list.page, list.perPage, list.status, list.search, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setSupplierId('')
    setProductId('')
    setUnitLevel('small')
    setUnitCost('')
    setMinQty('')
    setValidFrom('')
    setValidTo('')
    setNote('')
    setIsActive(true)
    setError('')
  }

  function openCreate() {
    setEditing(null)
    resetForm()
    setOpen(true)
    logMasterForm('supplierpricelist', 'create')
  }

  function openEdit(row: PriceRow) {
    setEditing(row)
    setSupplierId(String(row.supplier_id))
    setProductId(String(row.product_id))
    setUnitLevel(row.unit_level ?? 'small')
    setUnitCost(String(row.unit_cost))
    setMinQty(row.min_qty ? String(row.min_qty) : '')
    setValidFrom(row.valid_from ?? '')
    setValidTo(row.valid_to ?? '')
    setNote(row.note ?? '')
    setIsActive(row.is_active)
    setError('')
    setOpen(true)
    const ref = row.product?.name ? `${row.product.name} / ${row.supplier?.name ?? ''}` : `#${row.id}`
    logMasterForm('supplierpricelist', 'edit', ref)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      supplier_id: Number(supplierId),
      product_id: Number(productId),
      unit_level: unitLevel,
      unit_cost: Number(unitCost || 0),
      min_qty: minQty ? Number(minQty) : null,
      valid_from: validFrom || null,
      valid_to: validTo || null,
      note: note || null,
      is_active: isActive,
    }
    try {
      if (editing) await api.put(`/supplier-product-prices/${editing.id}`, payload)
      else await api.post('/supplier-product-prices', payload)
      setOpen(false)
      await loadRows()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function removeRow(row: PriceRow) {
    const ok = await feedback.confirm({
      title: t('delete'),
      message: t('deleteConfirm', { name: row.product?.name ?? `#${row.id}` }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/supplier-product-prices/${row.id}`)
      await loadRows()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  if (!enabled) {
    return (
      <div className="glass rounded-3xl p-8 text-center text-muted">
        {t('procurementVendorPriceListNotEnabled')}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('procurementGroupSourcing')}
        title={t('procurementVendorPriceListTitle')}
        subtitle={t('procurementVendorPriceListSubtitle')}
        action={
          canCreate ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('procurementVendorPriceListNew')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('procurementVendorPriceListSearch')} statusOptions={statusOptions} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('procurementVendorPriceListSupplier')}</th>
              <th className="px-4 py-3 font-medium">{t('product')}</th>
              <th className="px-4 py-3 font-medium">{t('procurementVendorPriceListUnitCost')}</th>
              <th className="px-4 py-3 font-medium">{t('unit')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              {(canEdit || canDelete) && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3">{row.supplier?.name ?? `#${row.supplier_id}`}</td>
                <td className="px-4 py-3">
                  <MasterNameButton onClick={() => setViewing(row)}>
                    {row.product?.name ?? `#${row.product_id}`}
                  </MasterNameButton>
                </td>
                <td className="px-4 py-3 tabular-nums">{formatRupiah(row.unit_cost, locale)}</td>
                <td className="px-4 py-3 text-muted">{row.unit ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={row.is_active ? 'text-mint' : 'text-rose-300'}>
                    {row.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                {(canEdit || canDelete) && (
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <button type="button" className="mr-3 text-mint" onClick={() => openEdit(row)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="text-rose-300" onClick={() => void removeRow(row)}>
                        {t('delete')}
                      </button>
                    ) : null}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={canEdit || canDelete ? 6 : 5}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal open={open} title={editing ? t('edit') : t('procurementVendorPriceListNew')} error={error} saving={saving} onClose={() => setOpen(false)} onSubmit={onSubmit}>
        <label className="block text-sm text-muted">
          {t('procurementVendorPriceListSupplier')}
          <SearchSelect
            className="!mt-0"
            value={supplierId}
            onChange={setSupplierId}
            options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
            placeholder={t('purchaseSelectSupplier')}
            required
          />
        </label>
        <label className="block text-sm text-muted">
          {t('product')}
          <SearchSelect
            className="!mt-0"
            value={productId}
            onChange={(value) => {
              setProductId(value)
              const picked = products.find((p) => String(p.id) === value)
              const level = picked?.units?.[0]?.level ?? 'small'
              setUnitLevel(level as ProductUnitLevel)
            }}
            options={products.map((p) => ({ value: String(p.id), label: p.name, keywords: p.sku ?? '' }))}
            placeholder={t('purchasePickProduct')}
            required
          />
        </label>
        <label className="block text-sm text-muted">
          {t('unit')}
          <select className="field" value={unitLevel} onChange={(e) => setUnitLevel(e.target.value as ProductUnitLevel)}>
            {unitOptions.map((opt) => (
              <option key={opt.level} value={opt.level}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-muted">
          {t('procurementVendorPriceListUnitCost')}
          <input required type="number" min={0} className="field" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </label>
        <label className="block text-sm text-muted">
          {t('procurementVendorPriceListMinQty')}
          <input type="number" min={1} className="field" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-muted">
            {t('procurementVendorPriceListValidFrom')}
            <input type="date" className="field" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </label>
          <label className="block text-sm text-muted">
            {t('procurementVendorPriceListValidTo')}
            <input type="date" className="field" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm text-muted">
          {t('purchaseNote')}
          <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>{t('procurementVendorPriceListActive')}</span>
        </label>
      </MasterModal>

      <MasterViewModal
        open={Boolean(viewing)}
        title={t('viewRecord')}
        onClose={() => setViewing(null)}
        onEdit={
          viewing && canEdit
            ? () => {
                const row = viewing
                setViewing(null)
                openEdit(row)
              }
            : undefined
        }
      >
        {viewing ? (
          <>
            <ViewField label={t('procurementVendorPriceListSupplier')} value={viewing.supplier?.name ?? `#${viewing.supplier_id}`} />
            <ViewField label={t('product')} value={viewing.product?.name ?? `#${viewing.product_id}`} />
            <ViewField label={t('procurementVendorPriceListUnitCost')} value={formatRupiah(viewing.unit_cost, locale)} />
            <ViewField label={t('unit')} value={viewing.unit ?? '—'} />
            <ViewField label={t('procurementVendorPriceListMinQty')} value={viewing.min_qty ?? '—'} />
            <ViewField label={t('procurementVendorPriceListValidFrom')} value={viewing.valid_from ?? '—'} />
            <ViewField label={t('procurementVendorPriceListValidTo')} value={viewing.valid_to ?? '—'} />
            <ViewField label={t('purchaseNote')} value={viewing.note ?? '—'} />
            <ViewField label={t('status')} value={viewing.is_active ? t('active') : t('inactive')} />
          </>
        ) : null}
      </MasterViewModal>
    </div>
  )
}
