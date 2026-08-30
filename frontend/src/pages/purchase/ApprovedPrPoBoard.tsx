import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { formatDate, formatRupiah } from '../../lib/money'
import type { ApiOk, Member, Outlet, Party } from '../../types'
import { MasterModal } from '../../components/MasterModal'
import { SearchSelect } from '../../components/SearchSelect'
import { AutocompleteSelect } from '../../components/AutocompleteSelect'
import { useSupplierSelect } from './useSupplierSelect'
import { PoTotalsSummary } from './PoTotalsSummary'
import { approvalRowLabel, buildApproverMemberOptions } from './approverOptions'
import { useFeedback } from '../../components/feedback'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'

type PrLine = {
  id: number
  product_id: number
  name_snapshot: string
  qty: number
  unit?: string | null
  unit_level?: string | null
  cost_last?: number
  cost_min?: number
  cost_max?: number
  suggested_unit_cost?: number
}

type ApprovedPr = {
  id: number
  number: string
  note?: string | null
  needed_at?: string | null
  outlet?: { id: number; name: string } | null
  warehouse?: { id: number; name: string } | null
  items?: PrLine[]
}

type DiscountType = 'fixed' | 'percent'

type LineEdit = {
  id: number
  product_id: number
  name: string
  qty: number
  unit: string
  unit_level: string
  supplier_id: string
  unit_cost: number
  discount_type: DiscountType
  discount: number
  cost_last: number
  cost_min: number
  cost_max: number
}

type ApprovalDraft = {
  key: string
  user_id: number
  name: string
  position?: string | null
}

function uuid() {
  return crypto.randomUUID()
}

function moneyInput(raw: string) {
  const digits = raw.replace(/\D/g, '')
  return digits === '' ? 0 : Number(digits)
}

function percentInput(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits === '') return 0
  return Math.min(100, Number(digits))
}

function lineSubtotal(line: Pick<LineEdit, 'qty' | 'unit_cost'>) {
  return Math.max(0, line.qty * line.unit_cost)
}

function lineDiscountAmount(line: Pick<LineEdit, 'qty' | 'unit_cost' | 'discount_type' | 'discount'>) {
  const subtotal = lineSubtotal(line)
  if (subtotal <= 0 || line.discount <= 0) return 0
  if (line.discount_type === 'percent') {
    return Math.min(subtotal, Math.round((subtotal * line.discount) / 100))
  }
  return Math.min(subtotal, line.discount)
}

function lineTotal(line: Pick<LineEdit, 'qty' | 'unit_cost' | 'discount_type' | 'discount'>) {
  return Math.max(0, lineSubtotal(line) - lineDiscountAmount(line))
}

export function ApprovedPrPoBoard({ onCreated }: { onCreated?: () => void }) {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canCreate = can('purchaseorders', 'create')
  const poNeedApproval = Boolean(me?.settings?.po_need_approval)

  const [prs, setPrs] = useState<ApprovedPr[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [multiOutlet, setMultiOutlet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<ApprovedPr | null>(null)
  const [expectedAt, setExpectedAt] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineEdit[]>([])
  const [sameSupplier, setSameSupplier] = useState(true)
  const [sharedSupplierId, setSharedSupplierId] = useState('')
  const [approvers, setApprovers] = useState<ApprovalDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { options: supplierOptions } = useSupplierSelect(suppliers)

  const memberOptions = useMemo(
    () => buildApproverMemberOptions(
      members,
      approvers.map((row) => row.user_id),
    ),
    [members, approvers],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const requests: Promise<unknown>[] = [
        api.get<ApiOk<ApprovedPr[]>>('/purchase-requisitions', {
          params: { for_po: 1, per_page: 50 },
          silent: true,
        }),
        api.get<ApiOk<Party[]>>('/suppliers', {
          params: { for_select: 1, status: 'active', per_page: 200 },
          silent: true,
        }),
        api.get<ApiOk<Outlet[]>>('/outlets', {
          params: { for_select: 1, status: 'active', per_page: 100 },
          silent: true,
        }),
      ]
      if (poNeedApproval) {
        requests.push(
          api.get<ApiOk<Member[]>>('/users', {
            params: { for_select: 1, status: 'active' },
            silent: true,
          }),
        )
      }
      const [prRes, supplierRes, outletRes, memberRes] = (await Promise.all(requests)) as [
        { data: ApiOk<ApprovedPr[]> },
        { data: ApiOk<Party[]> },
        { data: ApiOk<Outlet[]> },
        { data: ApiOk<Member[]> } | undefined,
      ]
      setPrs(prRes.data.data ?? [])
      setSuppliers(supplierRes.data.data ?? [])
      setMultiOutlet((outletRes.data.data ?? []).filter((o) => o.is_active !== false).length > 1)
      if (memberRes) setMembers(memberRes.data.data ?? [])
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    } finally {
      setLoading(false)
    }
  }, [t, poNeedApproval]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load()
  }, [load])

  function openPr(pr: ApprovedPr) {
    setActive(pr)
    setError('')
    setExpectedAt('')
    setNote(pr.note ?? '')
    setSameSupplier(true)
    setSharedSupplierId('')
    setApprovers([])
    setLines(
      (pr.items ?? []).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        name: item.name_snapshot,
        qty: item.qty,
        unit: item.unit ?? '',
        unit_level: item.unit_level ?? 'small',
        supplier_id: '',
        unit_cost: item.suggested_unit_cost ?? item.cost_last ?? 0,
        discount_type: 'fixed' as DiscountType,
        discount: 0,
        cost_last: item.cost_last ?? 0,
        cost_min: item.cost_min ?? 0,
        cost_max: item.cost_max ?? 0,
      })),
    )
  }

  function closeModal() {
    setActive(null)
    setError('')
    setLines([])
    setSharedSupplierId('')
    setSameSupplier(true)
    setApprovers([])
  }

  function patchLine(id: number, patch: Partial<LineEdit>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  function applySharedSupplier(value: string) {
    setSharedSupplierId(value)
    setLines((current) => current.map((line) => ({ ...line, supplier_id: value })))
  }

  function setSupplierMode(same: boolean) {
    setSameSupplier(same)
    if (same) {
      const first = lines.find((line) => line.supplier_id)?.supplier_id ?? sharedSupplierId
      setSharedSupplierId(first)
      if (first) {
        setLines((current) => current.map((line) => ({ ...line, supplier_id: first })))
      }
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

  const grandTotal = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines])

  const discountTotal = useMemo(
    () => lines.reduce((sum, line) => sum + lineDiscountAmount(line), 0),
    [lines],
  )

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => String(s.id) === sharedSupplierId) ?? null,
    [suppliers, sharedSupplierId],
  )

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canCreate || !active) return

    if (sameSupplier) {
      if (!sharedSupplierId) {
        setError(t('purchaseNeedSupplier'))
        return
      }
    } else if (lines.some((line) => !line.supplier_id)) {
      setError(t('purchaseNeedSupplierPerLine'))
      return
    }

    if (poNeedApproval && approvers.length === 0) {
      setError(t('purchaseNeedApprovers'))
      return
    }

    const effectiveLines = sameSupplier
      ? lines.map((line) => ({ ...line, supplier_id: sharedSupplierId }))
      : lines

    const approvalPayload = poNeedApproval
      ? { approvals: approvers.map((row) => ({ user_id: row.user_id })) }
      : { approvals: [] as Array<{ user_id: number }> }

    setSaving(true)
    setError('')
    try {
      const bySupplier = new Map<number, LineEdit[]>()
      for (const line of effectiveLines) {
        const sid = Number(line.supplier_id)
        const bucket = bySupplier.get(sid) ?? []
        bucket.push(line)
        bySupplier.set(sid, bucket)
      }

      for (const [supplierId, group] of bySupplier) {
        await api.post('/purchase-orders', {
          client_uuid: uuid(),
          supplier_id: supplierId,
          purchase_requisition_id: active.id,
          warehouse_id: active.warehouse?.id,
          expected_at: expectedAt || undefined,
          note: note || undefined,
          ...approvalPayload,
          items: group.map((line) => ({
            product_id: line.product_id,
            qty: line.qty,
            unit: line.unit || undefined,
            unit_level: line.unit_level || undefined,
            unit_cost: line.unit_cost,
            discount: lineDiscountAmount(line),
            purchase_requisition_item_id: line.id,
          })),
        })
      }

      feedback.success(t('saved'))
      closeModal()
      await load()
      onCreated?.()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-fg">{t('purchaseApprovedPrTitle')}</h3>
        <p className="mt-0.5 text-xs text-muted">{t('purchaseApprovedPrHint')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">{t('loadingWork')}</p>
      ) : prs.length === 0 ? (
        <div className="rounded-2xl border border-line bg-fill/40 px-4 py-5 text-sm text-muted">
          {t('purchaseApprovedPrEmpty')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-fill text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">{t('purchaseNumber')}</th>
                {multiOutlet ? <th className="px-3 py-2">{t('navOutlets')}</th> : null}
                <th className="px-3 py-2">{t('navWarehouses')}</th>
                <th className="px-3 py-2">{t('purchaseNeededAt')}</th>
                <th className="px-3 py-2 text-right">{t('purchaseItems')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {prs.map((pr) => (
                <tr key={pr.id} className="border-t border-line hover:bg-fill/40">
                  <td className="px-3 py-2 font-medium text-fg">{pr.number}</td>
                  {multiOutlet ? (
                    <td className="px-3 py-2 text-muted">{pr.outlet?.name ?? '—'}</td>
                  ) : null}
                  <td className="px-3 py-2 text-muted">{pr.warehouse?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{formatDate(pr.needed_at ?? null, locale)}</td>
                  <td className="px-3 py-2 text-right text-muted">{pr.items?.length ?? 0}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => openPr(pr)}>
                      {t('purchaseCreatePo')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MasterModal
        open={Boolean(active)}
        title={active ? `${t('purchaseCreatePo')} · ${active.number}` : t('purchaseCreatePo')}
        error={error}
        saving={saving}
        size="xl"
        defaultMaximized
        onClose={closeModal}
        onSubmit={(e) => void onSubmit(e)}
      >
        {active ? (
          <>
            <div className="grid gap-2 text-sm text-muted sm:grid-cols-2">
              <div>
                {t('navWarehouses')}: <span className="text-fg">{active.warehouse?.name ?? '—'}</span>
              </div>
              {multiOutlet ? (
                <div>
                  {t('navOutlets')}: <span className="text-fg">{active.outlet?.name ?? '—'}</span>
                </div>
              ) : null}
              <div>
                {t('purchaseNeededAt')}:{' '}
                <span className="text-fg">{formatDate(active.needed_at ?? null, locale)}</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-muted">
                {t('purchaseExpectedAt')}
                <input
                  type="date"
                  className="field"
                  value={expectedAt}
                  onChange={(e) => setExpectedAt(e.target.value)}
                />
              </label>
              <label className="block text-sm text-muted">
                {t('purchaseNote')}
                <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>

            <div className="rounded-2xl border border-line bg-fill/30 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={sameSupplier}
                  disabled={!canCreate}
                  onChange={(e) => setSupplierMode(e.target.checked)}
                />
                {t('purchaseSameSupplierAll')}
              </label>
              {sameSupplier ? (
                <label className="block text-sm text-muted">
                  {t('navSuppliers')}
                  <SearchSelect
                    value={sharedSupplierId}
                    onChange={applySharedSupplier}
                    options={supplierOptions}
                    placeholder={t('purchaseSelectSupplier')}
                    allowEmpty
                    emptyLabel={t('purchaseSelectSupplier')}
                    required
                    disabled={!canCreate}
                    pinnedSectionLabel={t('purchaseTopSuppliers')}
                  />
                </label>
              ) : (
                <p className="text-[11px] text-muted">{t('purchasePerLineSupplierHint')}</p>
              )}
            </div>

            {poNeedApproval ? (
              <div className="rounded-2xl border border-line p-3">
                <div className="mb-1 text-sm font-medium text-fg">{t('purchaseApprovers')}</div>
                <div className="mb-2 text-[11px] text-muted">{t('purchaseApproversHint')}</div>
                <div className="mb-2 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <AutocompleteSelect
                      key={active?.id ?? 'new'}
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
                    <p className="text-[11px] text-muted">{t('purchaseApproversEmpty')}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="overflow-auto rounded-xl border border-line">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-fill text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-2 py-2">{t('navProducts')}</th>
                    <th className="px-2 py-2 whitespace-nowrap">{t('stockQty')}</th>
                    <th className="px-2 py-2 whitespace-nowrap">{t('purchaseSelectUnit')}</th>
                    {!sameSupplier ? <th className="px-2 py-2">{t('navSuppliers')}</th> : null}
                    <th className="px-2 py-2 whitespace-nowrap">{t('purchaseCostHint')}</th>
                    <th className="px-2 py-2 whitespace-nowrap">{t('purchaseUnitCost')}</th>
                    <th className="px-2 py-2 whitespace-nowrap">{t('purchaseDiscount')}</th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">{t('purchaseTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const total = lineTotal(line)
                    const discAmt = lineDiscountAmount(line)
                    return (
                      <tr key={line.id} className="border-t border-line align-top">
                        <td className="px-2 py-2 font-medium text-fg">{line.name}</td>
                        <td className="px-2 py-2 text-muted">{line.qty}</td>
                        <td className="px-2 py-2 text-muted">{line.unit || '—'}</td>
                        {!sameSupplier ? (
                          <td className="px-2 py-2 min-w-[11rem]">
                            <SearchSelect
                              className="!mt-0"
                              value={line.supplier_id}
                              onChange={(value) => patchLine(line.id, { supplier_id: value })}
                              options={supplierOptions}
                              placeholder={t('purchaseSelectSupplier')}
                              allowEmpty
                              emptyLabel={t('purchaseSelectSupplier')}
                              required
                              disabled={!canCreate}
                              pinnedSectionLabel={t('purchaseTopSuppliers')}
                            />
                          </td>
                        ) : null}
                        <td className="px-2 py-2 text-[11px] leading-5 text-muted whitespace-nowrap">
                          <div>
                            {t('purchaseCostLast')}:{' '}
                            {line.cost_last ? formatRupiah(line.cost_last, locale) : '—'}
                          </div>
                          <div>
                            {t('purchaseCostMin')}:{' '}
                            {line.cost_min ? formatRupiah(line.cost_min, locale) : '—'}
                          </div>
                          <div>
                            {t('purchaseCostMax')}:{' '}
                            {line.cost_max ? formatRupiah(line.cost_max, locale) : '—'}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field !mt-0 !w-28 py-1.5"
                            inputMode="numeric"
                            value={line.unit_cost || ''}
                            disabled={!canCreate}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => patchLine(line.id, { unit_cost: moneyInput(e.target.value) })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="inline-flex w-[12rem] items-stretch overflow-hidden rounded-lg border border-line bg-[var(--field-bg)]">
                            <input
                              className="min-w-0 flex-1 border-0 bg-transparent px-2.5 py-1.5 text-sm text-fg outline-none"
                              inputMode="numeric"
                              value={line.discount || ''}
                              disabled={!canCreate}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) =>
                                patchLine(line.id, {
                                  discount:
                                    line.discount_type === 'percent'
                                      ? percentInput(e.target.value)
                                      : moneyInput(e.target.value),
                                })
                              }
                            />
                            <div
                              className="flex shrink-0 border-l border-line"
                              role="group"
                              aria-label={t('discountValueType')}
                            >
                              <button
                                type="button"
                                disabled={!canCreate}
                                className={`px-2 text-[11px] font-semibold transition ${
                                  line.discount_type === 'fixed'
                                    ? 'bg-mint/25 text-fg'
                                    : 'text-muted hover:bg-fill hover:text-fg'
                                }`}
                                onClick={() =>
                                  patchLine(line.id, { discount_type: 'fixed', discount: 0 })
                                }
                              >
                                Rp
                              </button>
                              <button
                                type="button"
                                disabled={!canCreate}
                                className={`border-l border-line px-2.5 text-[11px] font-semibold transition ${
                                  line.discount_type === 'percent'
                                    ? 'bg-mint/25 text-fg'
                                    : 'text-muted hover:bg-fill hover:text-fg'
                                }`}
                                onClick={() =>
                                  patchLine(line.id, { discount_type: 'percent', discount: 0 })
                                }
                              >
                                %
                              </button>
                            </div>
                          </div>
                          {line.discount_type === 'percent' && discAmt > 0 ? (
                            <div className="mt-1 text-[10px] text-muted">
                              = {formatRupiah(discAmt, locale)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-right font-medium whitespace-nowrap">
                          {formatRupiah(total, locale)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <PoTotalsSummary
              subtotal={grandTotal}
              discountTotal={discountTotal}
              supplier={sameSupplier ? selectedSupplier : null}
              locale={locale}
              t={t}
            />
            {!sameSupplier ? (
              <p className="text-[11px] text-muted">{t('purchaseMultiSupplierHint')}</p>
            ) : null}
          </>
        ) : null}
      </MasterModal>
    </div>
  )
}
