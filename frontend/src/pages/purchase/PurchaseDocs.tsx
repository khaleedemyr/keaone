import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import { formatRupiah } from '../../lib/money'
import type { ApiOk, Member, Outlet, Party, Product, ProductUnitLevel, Warehouse } from '../../types'
import { PageEnter } from '../../components/motion'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { AutocompleteSelect } from '../../components/AutocompleteSelect'
import { ApprovedPrPoBoard } from './ApprovedPrPoBoard'
import { PoDetailModal } from './PoDetailModal'
import { PrDetailModal } from './PrDetailModal'
import { runPrPdfExport, runPrWhatsAppShare, type PrDetailRecord } from './prDocumentActions'
import { PoTotalsSummary } from './PoTotalsSummary'
import { docKindToAttachmentType, ProcurementAttachmentsPanel } from './ProcurementAttachmentsPanel'
import { ProcurementCostCenterFields } from './ProcurementCostCenterFields'
import { PoGrScanField } from './PoGrScanField'
import {
  emptyLandedCostDraft,
  GrLandedCostPanel,
  hasLandedCostInput,
  landedCostFromApi,
  landedCostPayload,
  type LandedCostDraft,
  type LandedCostRow,
} from './GrLandedCostPanel'
import { PurchaseLineEditor } from './PurchaseLineEditor'
import {
  buildProductOptions,
  emptyPurchaseLine,
  ensureTrailingEmptyPurchaseLine,
  purchaseLineUuid,
  type PurchaseLineDraft,
} from './purchaseLineUtils'
import { approvalRowLabel, buildApproverMemberOptions } from './approverOptions'
import { useSupplierSelect } from './useSupplierSelect'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n, type MsgKey } from '../../i18n'

export type PurchaseDocKind = 'pr' | 'po' | 'gr' | 'direct'

type ApprovalDraft = {
  key: string
  user_id: number
  name: string
  position?: string | null
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
  outlet?: { id: number; name: string } | null
  department?: { id: number; name: string; code?: string | null } | null
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
    user?: { id: number; name: string; position?: string | null } | null
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
    purchase_order_item_id?: number
  }>
}

function grLineFromPoItem(item: NonNullable<DocRow['items']>[number]): PurchaseLineDraft {
  const remaining = item.qty_remaining ?? item.qty
  return {
    key: purchaseLineUuid(),
    product_id: item.product_id,
    name: item.name_snapshot,
    po_qty: item.qty,
    po_qty_remaining: remaining,
    qty: 0,
    unit: item.unit ?? '',
    unit_level: (item.unit_level as ProductUnitLevel) || 'small',
    unit_cost: item.unit_cost ?? 0,
    purchase_order_item_id: item.id,
  }
}

async function enrichGrLinesFromPo(
  items: PurchaseLineDraft[],
  purchaseOrderId: string,
): Promise<PurchaseLineDraft[]> {
  if (!purchaseOrderId) return items
  try {
    const { data } = await api.get<ApiOk<DocRow>>(`/purchase-orders/${purchaseOrderId}`)
    const poItems = data.data.items ?? []
    return items.map((line) => {
      const poItemId = line.purchase_order_item_id
      if (!poItemId) return line
      const poItem = poItems.find((item) => item.id === poItemId)
      if (!poItem) return line
      const remaining = poItem.qty_remaining ?? poItem.qty
      return {
        ...line,
        po_qty: poItem.qty,
        po_qty_remaining: remaining + line.qty,
      }
    })
  } catch {
    return items
  }
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
  return purchaseLineUuid()
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
  const grReversalEnabled = Boolean(me?.settings?.gr_reversal_enabled)
  const landedCostEnabled = me?.settings?.procurement_landed_cost_enabled === true
  const costCenterEnabled = me?.settings?.procurement_cost_center_enabled !== false
  const showCostCenter = costCenterEnabled && (kind === 'pr' || kind === 'po')
  const docNeedApproval = (kind === 'pr' && prNeedApproval) || (kind === 'po' && poNeedApproval)
  const approvalMatrixMode = me?.settings?.procurement_approval_mode === 'matrix'
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
  const [departments, setDepartments] = useState<Array<{ id: number; name: string; code?: string | null }>>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [multiOutlet, setMultiOutlet] = useState(false)

  const [warehouseId, setWarehouseId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [outletId, setOutletId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [prId, setPrId] = useState('')
  const [poId, setPoId] = useState('')
  const [note, setNote] = useState('')
  const [neededAt, setNeededAt] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [lines, setLines] = useState<PurchaseLineDraft[]>([emptyPurchaseLine()])
  const [approvers, setApprovers] = useState<ApprovalDraft[]>([])
  const [detailPoId, setDetailPoId] = useState<number | null>(null)
  const [detailPrId, setDetailPrId] = useState<number | null>(null)
  const [prActionId, setPrActionId] = useState<number | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterDepartmentId, setFilterDepartmentId] = useState('')
  const [landedCost, setLandedCost] = useState<LandedCostDraft>(emptyLandedCostDraft())
  const [landedCostAppliedAt, setLandedCostAppliedAt] = useState<string | null>(null)

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

  const selectedPo = useMemo(
    () => pos.find((po) => String(po.id) === poId) ?? null,
    [pos, poId],
  )

  const productOptions = useMemo(() => buildProductOptions(products), [products])

  const memberOptions = useMemo(
    () => buildApproverMemberOptions(
      members,
      approvers.map((row) => row.user_id),
    ),
    [members, approvers],
  )

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
        { value: 'closed', label: t('procurementPoStatusClosed') },
        { value: 'cancelled', label: t('purchaseStatusCancelled') },
      ]
    }
    return [
      ...base,
      { value: 'draft', label: t('purchaseStatusDraft') },
      { value: 'confirmed', label: t('purchaseStatusConfirmed') },
      { value: 'voided', label: t('procurementGrStatusVoided') },
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
          from: (kind === 'pr' || kind === 'po') && dateFrom ? dateFrom : undefined,
          to: (kind === 'pr' || kind === 'po') && dateTo ? dateTo : undefined,
          department_id: showCostCenter && filterDepartmentId ? Number(filterDepartmentId) : undefined,
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
  }, [list.search, list.status, list.page, list.perPage, kind, dateFrom, dateTo, filterDepartmentId, showCostCenter])

  useEffect(() => {
    setDateFrom('')
    setDateTo('')
    setFilterDepartmentId('')
    list.setPage(1)
  }, [kind])

  useEffect(() => {
    void api
      .get<ApiOk<Product[]>>('/products', {
        params: {
          for_select: 1,
          for_purchase: 1,
          status: 'active',
          supplier_id: kind === 'po' && supplierId ? Number(supplierId) : undefined,
        },
        silent: true,
      })
      .then(({ data }) => setProducts(data.data))
      .catch(() => {})
  }, [kind, supplierId])

  useEffect(() => {
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
    if (showCostCenter) {
      void api
        .get<ApiOk<Array<{ id: number; name: string; code?: string | null }>>>('/departments', {
          params: { for_select: 1, status: 'active', per_page: 200 },
          silent: true,
        })
        .then(({ data }) => setDepartments(data.data))
        .catch(() => {})
      void api
        .get<ApiOk<Outlet[]>>('/outlets', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true })
        .then(({ data }) => {
          const rows = (data.data ?? []).filter((o) => o.is_active !== false)
          setOutlets(rows)
          setMultiOutlet(rows.length > 1)
        })
        .catch(() => {})
    }
  }, [kind, needsSupplier, docNeedApproval, showCostCenter])

  function resetForm() {
    setEditing(null)
    setWarehouseId(warehouses.find((w) => w.is_default)?.id?.toString() ?? '')
    setSupplierId('')
    setPrId('')
    setPoId('')
    setDepartmentId('')
    setOutletId(me?.outlet?.id ? String(me.outlet.id) : '')
    setNote('')
    setNeededAt('')
    setExpectedAt('')
    setLines([emptyPurchaseLine()])
    setApprovers([])
    setError('')
    setLandedCost(emptyLandedCostDraft())
    setLandedCostAppliedAt(null)
  }

  function openCreate() {
    resetForm()
    setOpen(true)
    if (kind === 'pr' || kind === 'po' || kind === 'gr') {
      logMasterForm(kind, 'create')
    }
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
      setDepartmentId(doc.department?.id?.toString() ?? '')
      setOutletId(doc.outlet?.id?.toString() ?? me?.outlet?.id?.toString() ?? '')
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
            position: row.user?.position ?? null,
          })),
      )
      setLines(
        ensureTrailingEmptyPurchaseLine(
          await (async () => {
            const docPoId = doc.purchase_order?.id?.toString() ?? ''
            let mappedLines = (doc.items ?? []).map((item) => ({
              key: uuid(),
              product_id: item.product_id,
              name: item.name_snapshot,
              qty: item.qty,
              unit: item.unit ?? '',
              unit_level: (item.unit_level as ProductUnitLevel) || 'small',
              unit_cost: item.unit_cost ?? 0,
              purchase_order_item_id: item.purchase_order_item_id,
            }))
            if (kind === 'gr' && docPoId) {
              mappedLines = await enrichGrLinesFromPo(mappedLines, docPoId)
            }
            return mappedLines
          })(),
        ),
      )
      if (kind === 'gr' && landedCostEnabled) {
        try {
          const landedRes = await api.get<ApiOk<LandedCostRow | null>>(`/goods-receipts/${doc.id}/landed-cost`, { silent: true })
          const row = landedRes.data.data
          setLandedCost(landedCostFromApi(row ?? undefined))
          setLandedCostAppliedAt(row?.applied_at ?? null)
        } catch {
          setLandedCost(emptyLandedCostDraft())
          setLandedCostAppliedAt(null)
        }
      } else {
        setLandedCost(emptyLandedCostDraft())
        setLandedCostAppliedAt(null)
      }
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
    if (kind === 'gr') {
      const over = filled.find(
        (line) =>
          line.purchase_order_item_id &&
          line.po_qty_remaining != null &&
          line.qty > line.po_qty_remaining,
      )
      if (over) {
        setError(t('purchaseReceiveQtyExceedsPo'))
        return
      }
    }
    if (docNeedApproval && !approvalMatrixMode && approvers.length === 0) {
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
    const approvalPayload = docNeedApproval && !approvalMatrixMode
      ? { approvals: approvers.map((row) => ({ user_id: row.user_id })) }
      : kind === 'pr' || kind === 'po'
        ? { approvals: [] }
        : {}
    const costCenterPayload = showCostCenter
      ? {
          department_id: departmentId ? Number(departmentId) : null,
          outlet_id: multiOutlet && outletId ? Number(outletId) : undefined,
        }
      : {}
    try {
      let savedId = editing?.id
      if (editing) {
        await api.put(`${ENDPOINTS[kind]}/${editing.id}`, {
          warehouse_id: warehouseId ? Number(warehouseId) : undefined,
          supplier_id: supplierId ? Number(supplierId) : undefined,
          note: note || undefined,
          needed_at: neededAt || undefined,
          expected_at: expectedAt || undefined,
          items,
          ...approvalPayload,
          ...costCenterPayload,
        })
      } else {
        const { data: created } = await api.post<ApiOk<{ id: number }>>(ENDPOINTS[kind], {
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
          ...costCenterPayload,
        })
        savedId = created.data.id
      }
      if (kind === 'gr' && landedCostEnabled && savedId && !landedCostAppliedAt && (hasLandedCostInput(landedCost) || editing)) {
        await api.put(`/goods-receipts/${savedId}/landed-cost`, landedCostPayload(landedCost))
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
      message: `${row.number} · ${
        action === 'void'
          ? t('procurementGrVoid')
          : action === 'close'
            ? t('procurementPoClose')
            : action === 'submit'
            ? t('purchaseSubmit')
            : action === 'approve'
              ? t('purchaseApprove')
              : action === 'reject'
                ? t('purchaseReject')
                : action === 'order'
                  ? t('purchaseMarkOrdered')
                  : action === 'confirm'
                    ? t('purchaseConfirm')
                    : t('purchaseCancel')
      }`,
      tone: action === 'cancel' || action === 'reject' || action === 'void' || action === 'close' ? 'danger' : 'default',
    })
    if (!ok) return
    try {
      if (action === 'void') {
        await api.post(`${ENDPOINTS[kind]}/${row.id}/void`, {})
      } else if (action === 'close') {
        await api.post(`${ENDPOINTS[kind]}/${row.id}/close`, {})
      } else {
        await api.post(`${ENDPOINTS[kind]}/${row.id}/${action}`)
      }
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
      setPos((current) => (current.some((row) => row.id === doc.id) ? current : [doc, ...current]))
      setSupplierId(doc.supplier?.id?.toString() ?? '')
      setWarehouseId(doc.warehouse?.id?.toString() ?? '')
      setLines(
        ensureTrailingEmptyPurchaseLine(
          (doc.items ?? [])
            .filter((item) => (item.qty_remaining ?? item.qty) > 0)
            .map((item) => grLineFromPoItem(item)),
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
      setDepartmentId(doc.department?.id?.toString() ?? '')
      setOutletId(doc.outlet?.id?.toString() ?? '')
      setLines(
        ensureTrailingEmptyPurchaseLine(
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
      closed: 'procurementPoStatusClosed',
      confirmed: 'purchaseStatusConfirmed',
      voided: 'procurementGrStatusVoided',
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
      if (row.status === 'ordered') return ['close', 'cancel']
      if (row.status === 'partial') return ['close']
      return []
    }
    if (row.status === 'draft') return ['confirm', 'cancel']
    if ((kind === 'gr' || kind === 'direct') && row.status === 'confirmed' && grReversalEnabled) {
      return ['void']
    }
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
      return
    }
    setApprovers((current) => [
      ...current,
      {
        key: uuid(),
        user_id: member.id,
        name: member.name,
        position: member.position?.name ?? null,
      },
    ])
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

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('purchaseSearch')}
        statusOptions={statusOptions}
        dateFrom={kind === 'pr' || kind === 'po' ? dateFrom : undefined}
        dateTo={kind === 'pr' || kind === 'po' ? dateTo : undefined}
        onDateFrom={
          kind === 'pr' || kind === 'po'
            ? (value) => {
                list.setPage(1)
                setDateFrom(value)
              }
            : undefined
        }
        onDateTo={
          kind === 'pr' || kind === 'po'
            ? (value) => {
                list.setPage(1)
                setDateTo(value)
              }
            : undefined
        }
        extra={
          showCostCenter ? (
            <label className="block min-w-[10rem] text-xs text-muted">
              {t('navDepartments')}
              <select
                className="field !mt-1"
                value={filterDepartmentId}
                onChange={(e) => {
                  list.setPage(1)
                  setFilterDepartmentId(e.target.value)
                }}
              >
                <option value="">{t('filterAll')}</option>
                {departments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code ? `${row.name} (${row.code})` : row.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />

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
              {showCostCenter ? <th className="px-3 py-2">{t('navDepartments')}</th> : null}
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
                {showCostCenter ? (
                  <td className="px-3 py-2">{row.department?.name ?? '—'}</td>
                ) : null}
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
                    {canEdit && (row.status === 'draft' || row.status === 'rejected') ? (
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
                                    : action === 'void'
                                      ? 'procurementGrVoid'
                                      : action === 'close'
                                        ? 'procurementPoClose'
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
        mobileFullscreen
        defaultMaximized={kind === 'po' && !editing}
        onClose={() => setOpen(false)}
        onSubmit={(e) => void onSubmit(e)}
        submitLabel={editing ? t('save') : t('purchaseAdd')}
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
            <>
              {!editing ? (
                <PoGrScanField
                  selectedPoNumber={selectedPo?.number}
                  onPoLoaded={(id) => fillFromPo(id)}
                />
              ) : null}
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
            </>
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

          {showCostCenter ? (
            <ProcurementCostCenterFields
              departments={departments}
              outlets={outlets}
              multiOutlet={multiOutlet}
              departmentId={departmentId}
              outletId={outletId}
              onDepartmentChange={setDepartmentId}
              onOutletChange={setOutletId}
            />
          ) : null}

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
              {approvalMatrixMode ? (
                <p className="text-sm text-muted">{t('procurementApprovalMatrixHint')}</p>
              ) : (
                <>
                  <div className="mb-2 text-[11px] text-muted">{t('purchaseApproversHint')}</div>
                  <div className="mb-2 flex gap-2">
                    <div className="min-w-0 flex-1">
                      <AutocompleteSelect
                        key={`${open ? 'open' : 'closed'}-${editing?.id ?? 'new'}`}
                        className="!mt-0"
                        options={memberOptions}
                        placeholder={t('purchaseSearchApprover')}
                        onSelect={addApprover}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {approvers.map((row, index) => (
                      <div key={row.key} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5 text-sm">
                        <span className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-muted">
                          {t('purchaseApprovalLevel', { n: String(index + 1) })}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-fg">{approvalRowLabel(row)}</span>
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
                </>
              )}
            </div>
          ) : null}

          <PurchaseLineEditor
            lines={lines}
            setLines={setLines}
            products={products}
            productOptions={productOptions}
            needsCost={needsCost}
            grFromPo={kind === 'gr' && Boolean(poId)}
            autoFocusFirst={!editing}
            onProductSelected={(product) => {
              if (kind === 'po' && !supplierId && product.preferred_supplier_id) {
                setSupplierId(String(product.preferred_supplier_id))
              }
            }}
          />

          {kind === 'po' ? (
            <PoTotalsSummary subtotal={linesSubtotal} supplier={selectedSupplier} locale={locale} t={t} />
          ) : null}

          {kind === 'gr' && landedCostEnabled && (!editing || editing.status === 'draft') ? (
            <GrLandedCostPanel
              draft={landedCost}
              appliedAt={landedCostAppliedAt}
              readOnly={Boolean(landedCostAppliedAt)}
              locale={locale}
              onChange={setLandedCost}
            />
          ) : null}

          {editing && (kind === 'pr' || kind === 'po' || kind === 'gr') ? (
            <ProcurementAttachmentsPanel
              documentType={docKindToAttachmentType(kind)}
              documentId={editing.id}
            />
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
