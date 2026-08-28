import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import { formatRupiah } from '../../lib/money'
import type { ApiOk, Member, Party, Product, ProductUnitLevel, Warehouse } from '../../types'
import { PageEnter } from '../../components/motion'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { ApprovedPrPoBoard } from './ApprovedPrPoBoard'
import { PoDetailModal } from './PoDetailModal'
import { PrDetailModal } from './PrDetailModal'
import { runPrPdfExport, runPrWhatsAppShare, type PrDetailRecord } from './prDocumentActions'
import { PoTotalsSummary } from './PoTotalsSummary'
import { useSupplierSelect } from './useSupplierSelect'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
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

type LineCol = 'product' | 'qty' | 'unit' | 'cost'

function emptyLine(): LineDraft {
  return {
    key: uuid(),
    product_id: 0,
    name: '',
    qty: 1,
    unit: '',
    unit_level: 'small',
    unit_cost: 0,
  }
}

function focusLineCell(rowKey: string, col: LineCol) {
  window.requestAnimationFrame(() => {
    const root = document.querySelector(`[data-line="${rowKey}"][data-col="${col}"]`)
    if (!root) return
    const target =
      (root as HTMLElement).matches('input,select,button')
        ? (root as HTMLElement)
        : (root.querySelector('input,select,button') as HTMLElement | null)
    target?.focus()
  })
}

type ApprovalDraft = {
  key: string
  user_id: number
  name: string
}

type DocRow = {
  id: number
  number: string
  status: string
  total?: number
  note?: string | null
  needed_at?: string | null
  supplier?: { id: number; name: string } | null
  warehouse?: { id: number; name: string } | null
  purchase_order?: { id: number; number: string } | null
  requisition?: { id: number; number: string } | null
  user?: { id: number; name: string } | null
  created_at?: string
  is_direct?: boolean
  pr_need_approval?: boolean
  po_need_approval?: boolean
  can_share?: boolean
  share_token?: string | null
  current_approval_level?: number | null
  can_approve?: boolean
  approvals?: Array<{
    id: number
    level: number
    user_id: number
    user?: { id: number; name: string } | null
    status: string
    is_current?: boolean
  }>
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

function parseQtyInput(raw: string) {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits === '') return 0
  return Number.parseInt(digits, 10) || 0
}

function parseCostInput(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (cleaned === '' || cleaned === '.') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function defaultUnitPick(product: Product) {
  const options = productUnitOptions(product)
  const small = options.find((o) => o.level === 'small') ?? options[0]
  return { unit: small.label, unit_level: small.level as ProductUnitLevel }
}

export default function PurchaseDocs({ kind }: { kind: PurchaseDocKind }) {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const menu = MENU[kind]
  const canCreate = can(menu, 'create')
  const canEdit = can(menu, 'edit')
  const prNeedApproval = Boolean(me?.settings?.pr_need_approval)
  const poNeedApproval = Boolean(me?.settings?.po_need_approval)
  const docNeedApproval = (kind === 'pr' && prNeedApproval) || (kind === 'po' && poNeedApproval)
  const purchaseFlow = (me?.settings?.purchase_flow ?? 'direct') as 'strict_pr_po_gr' | 'po_gr' | 'direct'
  const poFromPrBoard = kind === 'po' && purchaseFlow === 'strict_pr_po_gr'

  const [rows, setRows] = useState<DocRow[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DocRow | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [prs, setPrs] = useState<DocRow[]>([])
  const [pos, setPos] = useState<DocRow[]>([])

  const [warehouseId, setWarehouseId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [prId, setPrId] = useState('')
  const [poId, setPoId] = useState('')
  const [note, setNote] = useState('')
  const [neededAt, setNeededAt] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])
  const [approvers, setApprovers] = useState<ApprovalDraft[]>([])
  const [approverPick, setApproverPick] = useState('')
  const [focusHint, setFocusHint] = useState<{ key: string; col: LineCol } | null>(null)
  const [detailPoId, setDetailPoId] = useState<number | null>(null)
  const [detailPrId, setDetailPrId] = useState<number | null>(null)
  const [prActionId, setPrActionId] = useState<number | null>(null)

  const { options: supplierOptions } = useSupplierSelect(suppliers)

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => String(s.id) === supplierId) ?? null,
    [suppliers, supplierId],
  )

  const linesSubtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        if (!line.product_id || line.qty <= 0) return sum
        return sum + line.qty * (line.unit_cost ?? 0)
      }, 0),
    [lines],
  )

  const needsSupplier = kind === 'po' || kind === 'direct' || kind === 'gr'
  const needsCost = kind !== 'pr'

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: String(p.id),
        label: p.name,
        keywords: `${p.sku ?? ''} ${p.barcode ?? ''}`,
      })),
    [products],
  )

  const memberOptions = useMemo(
    () =>
      members
        .filter((m) => m.is_active && !approvers.some((a) => a.user_id === m.id))
        .map((m) => ({
          value: String(m.id),
          label: `${m.name}${m.role ? ` · ${m.role}` : ''}`,
          keywords: `${m.email ?? ''} ${m.username ?? ''}`,
        })),
    [members, approvers],
  )

  useEffect(() => {
    if (!focusHint) return
    focusLineCell(focusHint.key, focusHint.col)
    setFocusHint(null)
  }, [focusHint, lines])

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
        { value: 'submitted', label: t('purchaseStatusSubmitted') },
        { value: 'approved', label: t('purchaseStatusApproved') },
        { value: 'rejected', label: t('purchaseStatusRejected') },
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
      .get<ApiOk<Product[]>>('/products', {
        params: { for_select: 1, for_purchase: 1, status: 'active' },
        silent: true,
      })
      .then(({ data }) => setProducts(data.data))
      .catch(() => {})
    void api
      .get<ApiOk<Warehouse[]>>('/warehouses', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true })
      .then(({ data }) => setWarehouses(data.data))
      .catch(() => {})
    if (needsSupplier) {
      void api
        .get<ApiOk<Party[]>>('/suppliers', { params: { for_select: 1, status: 'active', per_page: 200 }, silent: true })
        .then(({ data }) => setSuppliers(data.data))
        .catch(() => {})
    }
    if (docNeedApproval) {
      void api
        .get<ApiOk<Member[]>>('/users', { params: { for_select: 1, status: 'active' }, silent: true })
        .then(({ data }) => setMembers(data.data))
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
  }, [kind, needsSupplier, docNeedApproval])

  function resetForm() {
    setEditing(null)
    setWarehouseId(warehouses.find((w) => w.is_default)?.id?.toString() ?? '')
    setSupplierId('')
    setPrId('')
    setPoId('')
    setNote('')
    setNeededAt('')
    setExpectedAt('')
    setLines([emptyLine()])
    setApprovers([])
    setApproverPick('')
    setError('')
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    if (kind === 'pr' || kind === 'po' || kind === 'gr') {
      logMasterForm(kind, 'create')
    }
  }

  function ensureTrailingEmpty(rows: LineDraft[]) {
    if (rows.length === 0) return [emptyLine()]
    const last = rows[rows.length - 1]
    if (last.product_id > 0) return [...rows, emptyLine()]
    return rows
  }

  function setProductOnLine(rowKey: string, productId: string) {
    const id = Number(productId)
    const product = products.find((p) => p.id === id)
    setLines((current) => {
      const next = current.map((item) => {
        if (item.key !== rowKey) return item
        if (!product) {
          return { ...item, product_id: 0, name: '', unit: '', unit_level: 'small' as ProductUnitLevel }
        }
        const pick = defaultUnitPick(product)
        return {
          ...item,
          product_id: product.id,
          name: product.name,
          unit: pick.unit,
          unit_level: pick.unit_level,
        }
      })
      return ensureTrailingEmpty(next)
    })
    if (product) setFocusHint({ key: rowKey, col: 'qty' })
  }

  function advanceFrom(rowKey: string, col: LineCol) {
    if (col === 'product') {
      setFocusHint({ key: rowKey, col: 'qty' })
      return
    }
    if (col === 'qty') {
      setFocusHint({ key: rowKey, col: 'unit' })
      return
    }
    if (col === 'unit' && needsCost) {
      setFocusHint({ key: rowKey, col: 'cost' })
      return
    }
    // last column → new row
    let nextKey = ''
    setLines((current) => {
      const idx = current.findIndex((item) => item.key === rowKey)
      const row = current[idx]
      if (row && row.product_id === 0) return current
      if (idx >= 0 && idx < current.length - 1) {
        nextKey = current[idx + 1].key
        return current
      }
      const blank = emptyLine()
      nextKey = blank.key
      return [...current, blank]
    })
    if (nextKey) setFocusHint({ key: nextKey, col: 'product' })
  }

  function onLineEnter(event: KeyboardEvent, rowKey: string, col: LineCol) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    advanceFrom(rowKey, col)
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
      setNeededAt(doc.needed_at ?? '')
      setApprovers(
        (doc.approvals ?? [])
          .slice()
          .sort((a, b) => a.level - b.level)
          .map((row) => ({
            key: uuid(),
            user_id: row.user_id,
            name: row.user?.name ?? `#${row.user_id}`,
          })),
      )
      setApproverPick('')
      setLines(
        ensureTrailingEmpty(
          (doc.items ?? []).map((item) => ({
            key: uuid(),
            product_id: item.product_id,
            name: item.name_snapshot,
            qty: item.qty,
            unit: item.unit ?? '',
            unit_level: (item.unit_level as ProductUnitLevel) || 'small',
            unit_cost: item.unit_cost ?? 0,
          })),
        ),
      )
      setOpen(true)
      if (kind === 'pr' || kind === 'po' || kind === 'gr') {
        logMasterForm(kind, 'edit', doc.number)
      }
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const filled = lines.filter((line) => line.product_id > 0 && line.qty > 0)
    if (filled.length === 0) {
      setError(t('purchaseNeedItems'))
      return
    }
    if (docNeedApproval && approvers.length === 0) {
      setError(t('purchaseNeedApprovers'))
      return
    }
    setSaving(true)
    setError('')
    const items = filled.map((line) => ({
      product_id: line.product_id,
      qty: line.qty,
      unit: line.unit || undefined,
      unit_level: line.unit_level || undefined,
      unit_cost: needsCost ? line.unit_cost : undefined,
      purchase_order_item_id: line.purchase_order_item_id,
      purchase_requisition_item_id: line.purchase_requisition_item_id,
    }))
    const approvalPayload = docNeedApproval
      ? { approvals: approvers.map((row) => ({ user_id: row.user_id })) }
      : kind === 'pr' || kind === 'po'
        ? { approvals: [] }
        : {}
    try {
      if (editing) {
        await api.put(`${ENDPOINTS[kind]}/${editing.id}`, {
          warehouse_id: warehouseId ? Number(warehouseId) : undefined,
          supplier_id: supplierId ? Number(supplierId) : undefined,
          note: note || undefined,
          needed_at: neededAt || undefined,
          expected_at: expectedAt || undefined,
          items,
          ...approvalPayload,
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
          ...approvalPayload,
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
        ensureTrailingEmpty(
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
        ),
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
        ensureTrailingEmpty(
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
        ),
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
      if (row.status === 'submitted') {
        if (row.pr_need_approval && row.approvals && row.approvals.length > 0) {
          return row.can_approve ? ['approve', 'reject'] : []
        }
        return ['approve', 'reject']
      }
      return []
    }
    if (kind === 'po') {
      if (row.status === 'draft' || row.status === 'rejected') {
        return poNeedApproval ? ['submit', 'cancel'] : ['order', 'cancel']
      }
      if (row.status === 'submitted') {
        if (row.po_need_approval && row.approvals && row.approvals.length > 0) {
          return row.can_approve ? ['approve', 'reject'] : []
        }
        return ['approve', 'reject']
      }
      if (row.status === 'approved') return ['order', 'cancel']
      if (row.status === 'ordered') return ['cancel']
      return []
    }
    if (row.status === 'draft') return ['confirm', 'cancel']
    return []
  }

  async function loadPrDetail(prId: number) {
    const { data } = await api.get<ApiOk<PrDetailRecord>>(`/purchase-requisitions/${prId}`, { silent: true })
    return data.data
  }

  async function exportPrFromList(row: DocRow) {
    setPrActionId(row.id)
    try {
      const pr = await loadPrDetail(row.id)
      await runPrPdfExport(pr, {
        t,
        locale,
        companyName: me?.company?.name,
        companyPhone: me?.company?.phone ?? undefined,
        companyAddress: me?.company?.address ?? undefined,
      })
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    } finally {
      setPrActionId(null)
    }
  }

  async function sharePrFromList(row: DocRow) {
    if (!row.can_share) return
    setPrActionId(row.id)
    try {
      const pr = await loadPrDetail(row.id)
      await runPrWhatsAppShare(pr, t)
    } catch (err) {
      feedback.error(apiMessage(err, t('purchaseShareFailed')))
    } finally {
      setPrActionId(null)
    }
  }

  function addApprover(userId: string) {
    const id = Number(userId)
    const member = members.find((m) => m.id === id)
    if (!member || approvers.some((a) => a.user_id === id)) {
      setApproverPick('')
      return
    }
    setApprovers((current) => [...current, { key: uuid(), user_id: member.id, name: member.name }])
    setApproverPick('')
  }

  function moveApprover(index: number, dir: -1 | 1) {
    setApprovers((current) => {
      const next = [...current]
      const target = index + dir
      if (target < 0 || target >= next.length) return current
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  return (
    <PageEnter>
      <PageHeader
        eyebrow={t('appPurchase')}
        title={t(TITLE[kind])}
        subtitle={t(SUBTITLE[kind])}
        action={
          canCreate && !poFromPrBoard ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('purchaseAdd')}
            </button>
          ) : null
        }
      />

      {kind === 'po' ? <ApprovedPrPoBoard onCreated={() => void load()} /> : null}

      {kind === 'po' ? (
        <h3 className="mb-2 mt-2 text-sm font-semibold text-fg">{t('purchasePoListTitle')}</h3>
      ) : null}

      <MasterFilters {...list.filters} searchPlaceholder={t('purchaseSearch')} statusOptions={statusOptions} />

      <div className="mt-4 overflow-auto rounded-2xl border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-fill text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">{t('purchaseNumber')}</th>
              <th className="px-3 py-2">{t('status')}</th>
              {docNeedApproval ? <th className="px-3 py-2">{t('purchaseApprovers')}</th> : null}
              {kind === 'pr' || kind === 'po' ? (
                <th className="px-3 py-2">{t('purchaseCreatedBy')}</th>
              ) : null}
              {needsSupplier ? <th className="px-3 py-2">{t('navSuppliers')}</th> : null}
              <th className="px-3 py-2">{t('navWarehouses')}</th>
              {needsCost ? <th className="px-3 py-2">{t('purchaseTotal')}</th> : null}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2 font-medium">
                  {kind === 'po' || kind === 'pr' ? (
                    <button
                      type="button"
                      className="text-left font-medium text-fg hover:text-mint"
                      onClick={() => {
                        if (kind === 'po') setDetailPoId(row.id)
                        else setDetailPrId(row.id)
                      }}
                    >
                      {row.number}
                    </button>
                  ) : (
                    row.number
                  )}
                </td>
                <td className="px-3 py-2">{statusLabel(row.status)}</td>
                {docNeedApproval ? (
                  <td className="px-3 py-2 text-xs text-muted">
                    {(row.approvals ?? []).length === 0
                      ? '—'
                      : (row.approvals ?? [])
                          .slice()
                          .sort((a, b) => a.level - b.level)
                          .map((step) => {
                            const mark =
                              step.status === 'approved' ? '✓' : step.status === 'rejected' ? '✕' : step.is_current ? '→' : '·'
                            return `${mark} L${step.level} ${step.user?.name ?? ''}`
                          })
                          .join(' · ')}
                  </td>
                ) : null}
                {kind === 'pr' || kind === 'po' ? (
                  <td className="px-3 py-2">{row.user?.name ?? '—'}</td>
                ) : null}
                {needsSupplier ? <td className="px-3 py-2">{row.supplier?.name ?? '—'}</td> : null}
                <td className="px-3 py-2">{row.warehouse?.name ?? '—'}</td>
                {needsCost ? (
                  <td className="px-3 py-2">{formatRupiah(row.total ?? 0, locale)}</td>
                ) : null}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    {kind === 'po' ? (
                      <button
                        type="button"
                        className="btn-ghost !px-2 !text-xs"
                        onClick={() => setDetailPoId(row.id)}
                      >
                        {t('purchaseViewDetail')}
                      </button>
                    ) : null}
                    {kind === 'pr' ? (
                      <button
                        type="button"
                        className="btn-ghost !px-2 !text-xs"
                        onClick={() => setDetailPrId(row.id)}
                      >
                        {t('purchaseViewDetail')}
                      </button>
                    ) : null}
                    {kind === 'pr' ? (
                      <>
                        <button
                          type="button"
                          className="btn-ghost !px-2 !text-xs"
                          disabled={prActionId === row.id}
                          onClick={() => void exportPrFromList(row)}
                        >
                          {t('exportPdf')}
                        </button>
                        {row.can_share ? (
                          <button
                            type="button"
                            className="btn-ghost !px-2 !text-xs"
                            disabled={prActionId === row.id}
                            onClick={() => void sharePrFromList(row)}
                          >
                            {t('purchaseShareWhatsApp')}
                          </button>
                        ) : null}
                      </>
                    ) : null}
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
        defaultMaximized={kind === 'po' && !editing}
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
              <SearchSelect
                value={supplierId}
                onChange={setSupplierId}
                options={supplierOptions}
                placeholder={t('purchaseSelectSupplier')}
                allowEmpty
                emptyLabel={t('purchaseSelectSupplier')}
                required={kind === 'po' || kind === 'direct'}
                pinnedSectionLabel={t('purchaseTopSuppliers')}
              />
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

          {docNeedApproval ? (
            <div className="rounded-2xl border border-line p-3">
              <div className="mb-1 text-sm font-medium text-fg">{t('purchaseApprovers')}</div>
              <div className="mb-2 text-[11px] text-muted">{t('purchaseApproversHint')}</div>
              <div className="mb-2 flex gap-2">
                <div className="min-w-0 flex-1">
                  <SearchSelect
                    className="!mt-0"
                    value={approverPick}
                    onChange={(value) => {
                      setApproverPick(value)
                      if (value) addApprover(value)
                    }}
                    options={memberOptions}
                    placeholder={t('purchaseSearchApprover')}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                {approvers.map((row, index) => (
                  <div key={row.key} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5 text-sm">
                    <span className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-muted">
                      {t('purchaseApprovalLevel', { n: String(index + 1) })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-fg">{row.name}</span>
                    <button
                      type="button"
                      className="btn-ghost !px-2 !text-xs"
                      disabled={index === 0}
                      onClick={() => moveApprover(index, -1)}
                      title={t('purchaseMoveUp')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !px-2 !text-xs"
                      disabled={index === approvers.length - 1}
                      onClick={() => moveApprover(index, 1)}
                      title={t('purchaseMoveDown')}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !px-2"
                      onClick={() => setApprovers((current) => current.filter((item) => item.key !== row.key))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {approvers.length === 0 ? (
                  <div className="px-1 py-2 text-xs text-muted">{t('purchaseApproversEmpty')}</div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-line p-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <div className="text-sm font-medium text-fg">{t('purchaseItems')}</div>
              <div className="text-[11px] text-muted">{t('purchaseGridHint')}</div>
            </div>
            <div
              className={`mb-1 grid gap-2 text-[10px] uppercase tracking-wide text-muted ${
                needsCost ? 'grid-cols-[minmax(0,1.6fr)_72px_88px_110px_auto]' : 'grid-cols-[minmax(0,1.6fr)_72px_88px_auto]'
              }`}
            >
              <span>{t('product')}</span>
              <span>{t('stockQty')}</span>
              <span>{t('unit')}</span>
              {needsCost ? <span>{t('purchaseUnitCost')}</span> : null}
              <span />
            </div>
            <div className="space-y-1.5">
              {lines.map((line, index) => {
                const product = products.find((p) => p.id === line.product_id)
                const options = productUnitOptions(product)
                const known = options.some((o) => o.level === line.unit_level || o.label === line.unit)
                return (
                  <div
                    key={line.key}
                    className={`grid items-center gap-2 text-sm ${
                      needsCost
                        ? 'grid-cols-[minmax(0,1.6fr)_72px_88px_110px_auto]'
                        : 'grid-cols-[minmax(0,1.6fr)_72px_88px_auto]'
                    }`}
                  >
                    <div data-line={line.key} data-col="product">
                      <SearchSelect
                        className="!mt-0"
                        value={line.product_id ? String(line.product_id) : ''}
                        onChange={(value) => setProductOnLine(line.key, value)}
                        onCommit={() => setFocusHint({ key: line.key, col: 'qty' })}
                        options={productOptions}
                        placeholder={t('purchasePickProduct')}
                        allowEmpty
                        emptyLabel={t('purchasePickProduct')}
                        autoFocus={index === 0 && !editing}
                      />
                    </div>
                    <input
                      data-line={line.key}
                      data-col="qty"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className="field !mt-0 tabular-nums"
                      value={line.qty > 0 ? String(line.qty) : ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((item) =>
                            item.key === line.key ? { ...item, qty: parseQtyInput(e.target.value) } : item,
                          ),
                        )
                      }
                      onKeyDown={(e) => onLineEnter(e, line.key, 'qty')}
                    />
                    <select
                      data-line={line.key}
                      data-col="unit"
                      className="field !mt-0"
                      value={line.unit_level}
                      disabled={!line.product_id}
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
                      onKeyDown={(e) => onLineEnter(e, line.key, 'unit')}
                    >
                      {!known ? (
                        <option value={line.unit_level}>{line.unit || t('purchaseSelectUnit')}</option>
                      ) : null}
                      {options.map((opt) => (
                        <option key={opt.level} value={opt.level}>
                          {opt.label}
                          {opt.factor_to_base > 1 ? ` (=${opt.factor_to_base})` : ''}
                        </option>
                      ))}
                    </select>
                    {needsCost ? (
                      <input
                        data-line={line.key}
                        data-col="cost"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className="field !mt-0 tabular-nums"
                        value={line.unit_cost > 0 ? String(line.unit_cost) : ''}
                        disabled={!line.product_id}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          setLines((current) =>
                            current.map((item) =>
                              item.key === line.key ? { ...item, unit_cost: parseCostInput(e.target.value) } : item,
                            ),
                          )
                        }
                        onKeyDown={(e) => onLineEnter(e, line.key, 'cost')}
                      />
                    ) : null}
                    <button
                      type="button"
                      className="btn-ghost !px-2"
                      disabled={lines.length <= 1 && line.product_id === 0}
                      onClick={() =>
                        setLines((current) => {
                          const next = current.filter((item) => item.key !== line.key)
                          return next.length === 0 ? [emptyLine()] : ensureTrailingEmpty(next)
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {kind === 'po' ? (
            <PoTotalsSummary subtotal={linesSubtotal} supplier={selectedSupplier} locale={locale} t={t} />
          ) : null}
      </MasterModal>

      {kind === 'po' ? (
        <PoDetailModal
          poId={detailPoId}
          open={detailPoId !== null}
          onClose={() => setDetailPoId(null)}
        />
      ) : null}
      {kind === 'pr' ? (
        <PrDetailModal
          prId={detailPrId}
          open={detailPrId !== null}
          onClose={() => setDetailPrId(null)}
        />
      ) : null}
    </PageEnter>
  )
}
