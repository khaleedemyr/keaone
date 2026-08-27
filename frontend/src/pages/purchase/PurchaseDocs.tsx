import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { formatRupiah } from '../../lib/money'
import type { ApiOk, Party, Product, ProductUnitLevel, Warehouse } from '../../types'
import { PageEnter } from '../../components/motion'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal } from '../../components/MasterModal'
import { useAccess } from '../../access'
import { useI18n, type MsgKey } from '../../i18n'

export type PurchaseDocKind = 'pr' | 'po' | 'gr' | 'direct'

type LineDraft = {
  key: string
  product_id: number
  name: string
  qty: number
  unit: string
  unit_level: ProductUnitLevel
  unit_cost: number
  purchase_order_item_id?: number
  purchase_requisition_item_id?: number
}

type DocRow = {
  id: number
  number: string
  status: string
  total?: number
  note?: string | null
  supplier?: { id: number; name: string } | null
  warehouse?: { id: number; name: string } | null
  purchase_order?: { id: number; number: string } | null
  requisition?: { id: number; number: string } | null
  created_at?: string
  is_direct?: boolean
  items?: Array<{
    id: number
    product_id: number
    name_snapshot: string
    qty: number
    unit?: string | null
    unit_level?: ProductUnitLevel | null
    unit_cost?: number
    qty_remaining?: number
  }>
}

const ENDPOINTS: Record<PurchaseDocKind, string> = {
  pr: '/purchase-requisitions',
  po: '/purchase-orders',
  gr: '/goods-receipts',
  direct: '/goods-receipts',
}

const MENU: Record<PurchaseDocKind, string> = {
  pr: 'purchaserequisitions',
  po: 'purchaseorders',
  gr: 'goodsreceipts',
  direct: 'goodsreceipts',
}

const TITLE: Record<PurchaseDocKind, MsgKey> = {
  pr: 'purchasePrTitle',
  po: 'purchasePoTitle',
  gr: 'purchaseGrTitle',
  direct: 'purchaseDirectTitle',
}

const SUBTITLE: Record<PurchaseDocKind, MsgKey> = {
  pr: 'purchasePrSubtitle',
  po: 'purchasePoSubtitle',
  gr: 'purchaseGrSubtitle',
  direct: 'purchaseDirectSubtitle',
}

function uuid() {
  return crypto.randomUUID()
}

function productUnitOptions(product?: Product | null) {
  if (product?.units && product.units.length > 0) {
    return product.units.map((u) => ({
      level: u.level,
      label: u.label,
      factor_to_base: u.factor_to_base,
    }))
  }
  const label = product?.unit || 'pcs'
  return [{ level: 'small' as const, label, factor_to_base: 1 }]
}

function defaultUnitPick(product: Product) {
  const options = productUnitOptions(product)
  const small = options.find((o) => o.level === 'small') ?? options[0]
  return { unit: small.label, unit_level: small.level as ProductUnitLevel }
}

export default function PurchaseDocs({ kind }: { kind: PurchaseDocKind }) {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const menu = MENU[kind]
  const canCreate = can(menu, 'create')
  const canEdit = can(menu, 'edit')

  const [rows, setRows] = useState<DocRow[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DocRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [prs, setPrs] = useState<DocRow[]>([])
  const [pos, setPos] = useState<DocRow[]>([])

  const [warehouseId, setWarehouseId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [prId, setPrId] = useState('')
  const [poId, setPoId] = useState('')
  const [note, setNote] = useState('')
  const [neededAt, setNeededAt] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [productPick, setProductPick] = useState('')

  const needsSupplier = kind === 'po' || kind === 'direct' || kind === 'gr'
  const needsCost = kind !== 'pr'

  const statusOptions = useMemo(() => {
    const base = [{ value: 'all', label: t('filterAll') }]
    if (kind === 'pr') {
      return [
        ...base,
        { value: 'draft', label: t('purchaseStatusDraft') },
        { value: 'submitted', label: t('purchaseStatusSubmitted') },
        { value: 'approved', label: t('purchaseStatusApproved') },
        { value: 'rejected', label: t('purchaseStatusRejected') },
        { value: 'cancelled', label: t('purchaseStatusCancelled') },
      ]
    }
    if (kind === 'po') {
      return [
        ...base,
        { value: 'draft', label: t('purchaseStatusDraft') },
        { value: 'ordered', label: t('purchaseStatusOrdered') },
        { value: 'partial', label: t('purchaseStatusPartial') },
        { value: 'received', label: t('purchaseStatusReceived') },
        { value: 'cancelled', label: t('purchaseStatusCancelled') },
      ]
    }
    return [
      ...base,
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'confirmed', label: t('purchaseStatusConfirmed') },
      { value: 'cancelled', label: t('purchaseStatusCancelled') },
    ]
  }, [kind, t])

  async function load() {
    try {
      const { data } = await api.get<ApiOk<DocRow[]>>(ENDPOINTS[kind], {
        params: {
          search: list.search || undefined,
          status: list.status === 'all' ? undefined : list.status,
          page: list.page,
          per_page: list.perPage,
          direct_only: kind === 'direct' ? 1 : undefined,
        },
      })
      setRows(data.data)
      list.applyMeta(data.meta, data.data.length)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage, kind])

  useEffect(() => {
    void api
      .get<ApiOk<Product[]>>('/products', { params: { per_page: 100, status: 'active' }, silent: true })
      .then(({ data }) => setProducts(data.data))
      .catch(() => {})
    void api
      .get<ApiOk<Warehouse[]>>('/warehouses', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true })
      .then(({ data }) => setWarehouses(data.data))
      .catch(() => {})
    if (needsSupplier) {
      void api
        .get<ApiOk<Party[]>>('/suppliers', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true })
        .then(({ data }) => setSuppliers(data.data))
        .catch(() => {})
    }
    if (kind === 'po') {
      void api
        .get<ApiOk<DocRow[]>>('/purchase-requisitions', { params: { status: 'approved', per_page: 50 }, silent: true })
        .then(({ data }) => setPrs(data.data))
        .catch(() => {})
    }
    if (kind === 'gr') {
      void api
        .get<ApiOk<DocRow[]>>('/purchase-orders', { params: { per_page: 50 }, silent: true })
        .then(({ data }) => setPos(data.data.filter((row) => row.status === 'ordered' || row.status === 'partial')))
        .catch(() => {})
    }
  }, [kind, needsSupplier])

  function resetForm() {
    setEditing(null)
    setWarehouseId(warehouses.find((w) => w.is_default)?.id?.toString() ?? '')
    setSupplierId('')
    setPrId('')
    setPoId('')
    setNote('')
    setNeededAt('')
    setExpectedAt('')
    setLines([])
    setProductPick('')
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
  }

  async function openEdit(row: DocRow) {
    try {
      const { data } = await api.get<ApiOk<DocRow>>(`${ENDPOINTS[kind]}/${row.id}`)
      const doc = data.data
      setEditing(doc)
      setWarehouseId(doc.warehouse?.id?.toString() ?? '')
      setSupplierId(doc.supplier?.id?.toString() ?? '')
      setPrId(doc.requisition?.id?.toString() ?? '')
      setPoId(doc.purchase_order?.id?.toString() ?? '')
      setNote(doc.note ?? '')
      setLines(
        (doc.items ?? []).map((item) => ({
          key: uuid(),
          product_id: item.product_id,
          name: item.name_snapshot,
          qty: item.qty,
          unit: item.unit ?? '',
          unit_level: (item.unit_level as ProductUnitLevel) || 'small',
          unit_cost: item.unit_cost ?? 0,
        })),
      )
      setOpen(true)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  function addProduct() {
    const id = Number(productPick)
    const product = products.find((p) => p.id === id)
    if (!product) return
    const pick = defaultUnitPick(product)
    setLines((current) => [
      ...current,
      {
        key: uuid(),
        product_id: product.id,
        name: product.name,
        qty: 1,
        unit: pick.unit,
        unit_level: pick.unit_level,
        unit_cost: 0,
      },
    ])
    setProductPick('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (lines.length === 0) {
      setError(t('purchaseNeedItems'))
      return
    }
    setSaving(true)
    setError('')
    const items = lines.map((line) => ({
      product_id: line.product_id,
      qty: line.qty,
      unit: line.unit || undefined,
      unit_level: line.unit_level || undefined,
      unit_cost: needsCost ? line.unit_cost : undefined,
      purchase_order_item_id: line.purchase_order_item_id,
      purchase_requisition_item_id: line.purchase_requisition_item_id,
    }))
    try {
      if (editing) {
        await api.put(`${ENDPOINTS[kind]}/${editing.id}`, {
          warehouse_id: warehouseId ? Number(warehouseId) : undefined,
          supplier_id: supplierId ? Number(supplierId) : undefined,
          note: note || undefined,
          needed_at: neededAt || undefined,
          expected_at: expectedAt || undefined,
          items,
        })
      } else {
        await api.post(ENDPOINTS[kind], {
          client_uuid: uuid(),
          warehouse_id: warehouseId ? Number(warehouseId) : undefined,
          supplier_id: supplierId ? Number(supplierId) : undefined,
          purchase_requisition_id: prId ? Number(prId) : undefined,
          purchase_order_id: poId ? Number(poId) : undefined,
          note: note || undefined,
          needed_at: neededAt || undefined,
          expected_at: expectedAt || undefined,
          items: kind === 'po' && prId && items.length === 0 ? undefined : items,
        })
      }
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(row: DocRow, action: string) {
    const ok = await feedback.confirm({
      title: t('purchaseActionConfirm'),
      message: `${row.number} · ${action}`,
      tone: action === 'cancel' || action === 'reject' ? 'danger' : 'default',
    })
    if (!ok) return
    try {
      await api.post(`${ENDPOINTS[kind]}/${row.id}/${action}`)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function fillFromPo(id: string) {
    setPoId(id)
    if (!id) return
    try {
      const { data } = await api.get<ApiOk<DocRow>>(`/purchase-orders/${id}`)
      const doc = data.data
      setSupplierId(doc.supplier?.id?.toString() ?? '')
      setWarehouseId(doc.warehouse?.id?.toString() ?? '')
      setLines(
        (doc.items ?? [])
          .filter((item) => (item.qty_remaining ?? item.qty) > 0)
          .map((item) => ({
            key: uuid(),
            product_id: item.product_id,
            name: item.name_snapshot,
            qty: item.qty_remaining ?? item.qty,
            unit: item.unit ?? '',
            unit_level: (item.unit_level as ProductUnitLevel) || 'small',
            unit_cost: item.unit_cost ?? 0,
            purchase_order_item_id: item.id,
          })),
      )
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function fillFromPr(id: string) {
    setPrId(id)
    if (!id) return
    try {
      const { data } = await api.get<ApiOk<DocRow>>(`/purchase-requisitions/${id}`)
      const doc = data.data
      setWarehouseId(doc.warehouse?.id?.toString() ?? '')
      setLines(
        (doc.items ?? []).map((item) => ({
          key: uuid(),
          product_id: item.product_id,
          name: item.name_snapshot,
          qty: item.qty,
          unit: item.unit ?? '',
          unit_level: (item.unit_level as ProductUnitLevel) || 'small',
          unit_cost: 0,
          purchase_requisition_item_id: item.id,
        })),
      )
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  function statusLabel(status: string) {
    const map: Record<string, MsgKey> = {
      draft: 'purchaseStatusDraft',
      submitted: 'purchaseStatusSubmitted',
      approved: 'purchaseStatusApproved',
      rejected: 'purchaseStatusRejected',
      cancelled: 'purchaseStatusCancelled',
      ordered: 'purchaseStatusOrdered',
      partial: 'purchaseStatusPartial',
      received: 'purchaseStatusReceived',
      confirmed: 'purchaseStatusConfirmed',
    }
    return t(map[status] ?? 'purchaseStatusDraft')
  }

  function actionsFor(row: DocRow) {
    if (!canEdit) return []
    if (kind === 'pr') {
      if (row.status === 'draft' || row.status === 'rejected') return ['submit', 'cancel']
      if (row.status === 'submitted') return ['approve', 'reject']
      return []
    }
    if (kind === 'po') {
      if (row.status === 'draft') return ['order', 'cancel']
      if (row.status === 'ordered') return ['cancel']
      return []
    }
    if (row.status === 'draft') return ['confirm', 'cancel']
    return []
  }

  return (
    <PageEnter>
      <PageHeader
        eyebrow={t('appPurchase')}
        title={t(TITLE[kind])}
        subtitle={t(SUBTITLE[kind])}
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('purchaseAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('purchaseSearch')} statusOptions={statusOptions} />

      <div className="mt-4 overflow-auto rounded-2xl border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-fill text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">{t('purchaseNumber')}</th>
              <th className="px-3 py-2">{t('status')}</th>
              {needsSupplier ? <th className="px-3 py-2">{t('navSuppliers')}</th> : null}
              <th className="px-3 py-2">{t('navWarehouses')}</th>
              {needsCost ? <th className="px-3 py-2">{t('purchaseTotal')}</th> : null}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2 font-medium">{row.number}</td>
                <td className="px-3 py-2">{statusLabel(row.status)}</td>
                {needsSupplier ? <td className="px-3 py-2">{row.supplier?.name ?? '—'}</td> : null}
                <td className="px-3 py-2">{row.warehouse?.name ?? '—'}</td>
                {needsCost ? (
                  <td className="px-3 py-2">{formatRupiah(row.total ?? 0, locale)}</td>
                ) : null}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    {row.status === 'draft' || row.status === 'rejected' ? (
                      <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void openEdit(row)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {actionsFor(row).map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="btn-ghost !px-2 !text-xs"
                        onClick={() => void runAction(row, action)}
                      >
                        {t(
                          action === 'submit'
                            ? 'purchaseSubmit'
                            : action === 'approve'
                              ? 'purchaseApprove'
                              : action === 'reject'
                                ? 'purchaseReject'
                                : action === 'order'
                                  ? 'purchaseMarkOrdered'
                                  : action === 'confirm'
                                    ? 'purchaseConfirm'
                                    : 'purchaseCancel',
                        )}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  {t('purchaseEmpty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t('purchaseEdit') : t('purchaseAdd')}
        error={error}
        saving={saving}
        size="xl"
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
      >
          {kind === 'po' ? (
            <label className="block text-sm text-muted">
              {t('purchaseFromPr')}
              <select className="field" value={prId} onChange={(e) => void fillFromPr(e.target.value)} disabled={Boolean(editing)}>
                <option value="">{t('purchaseNoPr')}</option>
                {prs.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.number}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {kind === 'gr' ? (
            <label className="block text-sm text-muted">
              {t('purchaseFromPo')}
              <select className="field" value={poId} onChange={(e) => void fillFromPo(e.target.value)} disabled={Boolean(editing)}>
                <option value="">{t('purchaseSelectPo')}</option>
                {pos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.number} · {po.supplier?.name ?? ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block text-sm text-muted">
            {t('navWarehouses')}
            <select className="field" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required={kind === 'gr' || kind === 'direct'}>
              <option value="">{t('purchaseSelectWarehouse')}</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </label>

          {needsSupplier ? (
            <label className="block text-sm text-muted">
              {t('navSuppliers')}
              <select className="field" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required={kind === 'po' || kind === 'direct'}>
                <option value="">{t('purchaseSelectSupplier')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {kind === 'pr' ? (
            <label className="block text-sm text-muted">
              {t('purchaseNeededAt')}
              <input type="date" className="field" value={neededAt} onChange={(e) => setNeededAt(e.target.value)} />
            </label>
          ) : null}

          {kind === 'po' ? (
            <label className="block text-sm text-muted">
              {t('purchaseExpectedAt')}
              <input type="date" className="field" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
            </label>
          ) : null}

          <label className="block text-sm text-muted">
            {t('purchaseNote')}
            <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div className="rounded-2xl border border-line p-3">
            <div className="mb-2 text-sm font-medium text-fg">{t('purchaseItems')}</div>
            <div className="mb-2 flex gap-2">
              <select className="field !mt-0 flex-1" value={productPick} onChange={(e) => setProductPick(e.target.value)}>
                <option value="">{t('purchasePickProduct')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-ghost" onClick={addProduct}>
                {t('purchaseAddLine')}
              </button>
            </div>
            <div className="mb-1 grid grid-cols-[1fr_72px_88px_110px_auto] gap-2 text-[10px] uppercase tracking-wide text-muted">
              <span>{t('product')}</span>
              <span>{t('stockQty')}</span>
              <span>{t('unit')}</span>
              <span>{needsCost ? t('purchaseUnitCost') : ''}</span>
              <span />
            </div>
            <div className="space-y-2">
              {lines.map((line) => {
                const product = products.find((p) => p.id === line.product_id)
                const options = productUnitOptions(product)
                const known = options.some((o) => o.level === line.unit_level || o.label === line.unit)
                return (
                <div key={line.key} className="grid grid-cols-[1fr_72px_88px_110px_auto] items-center gap-2 text-sm">
                  <div className="truncate">{line.name}</div>
                  <input
                    type="number"
                    min={1}
                    className="field !mt-0"
                    value={line.qty}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((item) => (item.key === line.key ? { ...item, qty: Number(e.target.value) } : item)),
                      )
                    }
                  />
                  <select
                    className="field !mt-0"
                    value={line.unit_level}
                    onChange={(e) => {
                      const level = e.target.value as ProductUnitLevel
                      const picked = options.find((o) => o.level === level)
                      setLines((current) =>
                        current.map((item) =>
                          item.key === line.key
                            ? {
                                ...item,
                                unit_level: level,
                                unit: picked?.label || item.unit,
                              }
                            : item,
                        ),
                      )
                    }}
                  >
                    {!known ? <option value={line.unit_level}>{line.unit || t('purchaseSelectUnit')}</option> : null}
                    {options.map((opt) => (
                      <option key={opt.level} value={opt.level}>
                        {opt.label}
                        {opt.factor_to_base > 1 ? ` (=${opt.factor_to_base})` : ''}
                      </option>
                    ))}
                  </select>
                  {needsCost ? (
                    <input
                      type="number"
                      min={0}
                      className="field !mt-0"
                      value={line.unit_cost}
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((item) =>
                            item.key === line.key ? { ...item, unit_cost: Number(e.target.value) } : item,
                          ),
                        )
                      }
                    />
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="btn-ghost !px-2"
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  >
                    ×
                  </button>
                </div>
                )
              })}
            </div>
          </div>
      </MasterModal>
    </PageEnter>
  )
}
