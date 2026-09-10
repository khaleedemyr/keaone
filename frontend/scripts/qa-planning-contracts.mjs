/**
 * QA: Perencanaan & kontrak
 * - kontrak / blanket PO
 * - auto-reorder
 * - demand planning
 * - rencana procurement tahunan
 * - landed cost
 *
 * Usage: node scripts/qa-planning-contracts.mjs
 */
import crypto from 'node:crypto'

const API = process.env.QA_API || 'http://127.0.0.1:8000/api/v1'
const EMAIL = process.env.QA_EMAIL || 'owner@demo.test'
const PASSWORD = process.env.QA_PASSWORD || 'password'

const results = []

function uuid() {
  return crypto.randomUUID()
}

function ok(id, detail = '') {
  results.push({ id, ok: true, detail })
  console.log(`OK   ${id}${detail ? ` — ${detail}` : ''}`)
}

function fail(id, detail = '') {
  results.push({ id, ok: false, detail })
  console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`)
}

async function req(method, path, { token, body, companyId } = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (companyId) headers['X-Company-Id'] = String(companyId)

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const msg = json?.message || json?.error || text || res.statusText
    const errors = json?.errors ? ` ${JSON.stringify(json.errors)}` : ''
    throw new Error(`${method} ${path} → ${res.status}: ${msg}${errors}`)
  }
  return json
}

async function createOrderedPo({
  token,
  companyId,
  productId,
  unit,
  qty,
  unitCost,
  note,
  supplierId,
  warehouseId,
  departmentId,
  outletId,
}) {
  const pr = await req('POST', '/purchase-requisitions', {
    token,
    companyId,
    body: {
      client_uuid: uuid(),
      warehouse_id: warehouseId,
      outlet_id: outletId || undefined,
      department_id: departmentId || null,
      note,
      items: [{ product_id: productId, qty, unit, unit_level: 'small' }],
      approvals: [],
    },
  })
  const prId = pr.data.id
  await req('POST', `/purchase-requisitions/${prId}/submit`, { token, companyId })
  let prShow = await req('GET', `/purchase-requisitions/${prId}`, { token, companyId })
  if (prShow.data.status === 'submitted') {
    await req('POST', `/purchase-requisitions/${prId}/approve`, { token, companyId })
    prShow = await req('GET', `/purchase-requisitions/${prId}`, { token, companyId })
  }
  const prItem = (prShow.data.items ?? [])[0]
  if (!prItem) throw new Error(`PR ${prId} tanpa items, status=${prShow.data.status}`)

  const po = await req('POST', '/purchase-orders', {
    token,
    companyId,
    body: {
      client_uuid: uuid(),
      supplier_id: supplierId,
      warehouse_id: warehouseId,
      outlet_id: outletId || undefined,
      purchase_requisition_id: prId,
      department_id: departmentId || null,
      note,
      items: [
        {
          product_id: productId,
          qty,
          unit,
          unit_level: 'small',
          unit_cost: unitCost,
          purchase_requisition_item_id: prItem.id,
        },
      ],
      approvals: [],
    },
  })
  const poId = po.data.id
  try {
    await req('POST', `/purchase-orders/${poId}/order`, { token, companyId })
  } catch {
    await req('POST', `/purchase-orders/${poId}/submit`, { token, companyId })
    try {
      await req('POST', `/purchase-orders/${poId}/approve`, { token, companyId })
    } catch {
      /* */
    }
    try {
      await req('POST', `/purchase-orders/${poId}/order`, { token, companyId })
    } catch {
      /* */
    }
  }
  const poReady = await req('GET', `/purchase-orders/${poId}`, { token, companyId })
  return { po: poReady.data, pr: prShow.data }
}

async function main() {
  const login = await req('POST', '/auth/login', {
    body: { email: EMAIL, password: PASSWORD, device_name: 'qa-planning', remember: true },
  })
  const token = login.data?.token || login.token || login.data?.access_token
  if (!token) throw new Error(`Login tanpa token: ${JSON.stringify(login).slice(0, 300)}`)
  const companyId = login.data?.company?.id || login.data?.user?.last_company_id || 1
  ok('login', `company=${companyId}`)

  // --- settings ---
  await req('PUT', '/company/settings', {
    token,
    companyId,
    body: {
      settings: {
        purchase_flow: 'strict_pr_po_gr',
        pr_need_approval: false,
        po_need_approval: false,
        procurement_contract_enabled: true,
        procurement_auto_reorder_enabled: true,
        procurement_demand_planning_enabled: true,
        procurement_annual_plan_enabled: true,
        procurement_landed_cost_enabled: true,
      },
    },
  })
  const settings = await req('GET', '/company/settings', { token, companyId })
  const s = settings.data?.settings || settings.data || {}
  ok(
    'settings',
    `contract=${s.procurement_contract_enabled} reorder=${s.procurement_auto_reorder_enabled} demand=${s.procurement_demand_planning_enabled} plan=${s.procurement_annual_plan_enabled} landed=${s.procurement_landed_cost_enabled}`,
  )

  const suppliers = await req('GET', '/suppliers?for_select=1&status=active&per_page=50', { token, companyId })
  const supplier = (suppliers.data ?? [])[0]
  const warehouses = await req('GET', '/warehouses?status=active&per_page=20', { token, companyId })
  const warehouse = (warehouses.data ?? [])[0]
  const outlets = await req('GET', '/outlets?status=active&per_page=20', { token, companyId })
  const outletId = warehouse?.outlet_id || (outlets.data ?? [])[0]?.id
  const deps = await req('GET', '/departments?status=active&per_page=50', { token, companyId })
  const dept = (deps.data ?? [])[0]
  const units = await req('GET', '/units?status=active&per_page=50', { token, companyId })
  const unitId = (units.data ?? [])[0]?.id
  const unitName = (units.data ?? [])[0]?.name || 'pcs'
  const categories = await req('GET', '/categories?per_page=100', { token, companyId })
  const rawCat = (categories.data ?? []).find((c) => c.is_raw_material) || (categories.data ?? [])[0]
  if (!supplier || !warehouse || !unitId) throw new Error('Supplier/warehouse/unit kosong')
  if (!rawCat) throw new Error('Category bahan baku kosong')

  const stamp = Date.now().toString().slice(-6)

  // --- 1) Contract create → activate → release PO ---
  try {
    const product = await req('POST', '/products', {
      token,
      companyId,
      body: {
        name: `QA Contract Item ${stamp}`,
        sku: `CTR-${stamp}`,
        type: 'goods',
        track_stock: true,
        is_procurement_item: true,
        unit_id: unitId,
        sell_price: 0,
        cost_price: 25_000,
        is_active: true,
      },
    })
    const productId = product.data.id
    const productUnit = product.data.unit || unitName

    const year = new Date().getFullYear()
    const contract = await req('POST', '/procurement-contracts', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        title: `QA Blanket ${stamp}`,
        supplier_id: supplier.id,
        warehouse_id: warehouse.id,
        outlet_id: outletId,
        department_id: dept?.id ?? null,
        period_start: `${year}-01-01`,
        period_end: `${year}-12-31`,
        note: 'QA contract',
        items: [{ product_id: productId, qty: 100, unit_cost: 25_000, unit: productUnit, unit_level: 'small' }],
      },
    })
    const contractId = contract.data.id
    await req('POST', `/procurement-contracts/${contractId}/activate`, { token, companyId })
    const active = await req('GET', `/procurement-contracts/${contractId}`, { token, companyId })
    const item = (active.data.items ?? [])[0]
    if (!item) throw new Error('Contract tanpa items')

    const release = await req('POST', `/procurement-contracts/${contractId}/release-po`, {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        note: 'QA release',
        items: [{ contract_item_id: item.id, qty: 5 }],
      },
    })
    const poId = release.data.purchase_order_id
    const po = await req('GET', `/purchase-orders/${poId}`, { token, companyId })
    ok(
      'contract',
      `id=${contractId} status=${active.data.status} release_po=${po.data.number} contract_id=${po.data.procurement_contract_id}`,
    )
    if (!po.data.procurement_contract_id) {
      fail('contract-po-link', 'PO release tanpa procurement_contract_id di payload serialize')
    }
  } catch (e) {
    fail('contract', String(e.message || e))
  }

  // --- 2) Annual plan create → activate ---
  try {
    const product = await req('POST', '/products', {
      token,
      companyId,
      body: {
        name: `QA Plan Item ${stamp}`,
        sku: `PLN-${stamp}`,
        type: 'goods',
        track_stock: true,
        is_procurement_item: true,
        unit_id: unitId,
        sell_price: 0,
        cost_price: 10_000,
        is_active: true,
      },
    })
    const plan = await req('POST', '/procurement-plans', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        name: `QA Plan ${new Date().getFullYear()} ${stamp}`,
        fiscal_year: new Date().getFullYear(),
        department_id: dept?.id ?? null,
        note: 'QA annual plan',
        lines: [
          {
            product_id: product.data.id,
            period_month: new Date().getMonth() + 1,
            qty_planned: 50,
            estimated_unit_cost: 10_000,
          },
        ],
      },
    })
    const planId = plan.data.id
    await req('POST', `/procurement-plans/${planId}/activate`, { token, companyId })
    const show = await req('GET', `/procurement-plans/${planId}`, { token, companyId })
    ok('annual-plan', `id=${planId} status=${show.data.status} lines=${(show.data.lines ?? []).length}`)
  } catch (e) {
    fail('annual-plan', String(e.message || e))
  }

  // --- 3) Auto-reorder: product below min_stock + reorder_qty ---
  try {
    const product = await req('POST', '/products', {
      token,
      companyId,
      body: {
        name: `QA Reorder Item ${stamp}`,
        sku: `ROR-${stamp}`,
        type: 'goods',
        track_stock: true,
        category_id: rawCat.id,
        unit_id: unitId,
        sell_price: 0,
        cost_price: 8_000,
        min_stock: 20,
        reorder_qty: 40,
        is_active: true,
      },
    })
    if (!product.data.track_stock) {
      fail('auto-reorder-setup', `track_stock masih false setelah create (id=${product.data.id})`)
    } else {
    // stock kosong (0) <= min_stock → masuk preview
    const preview = await req('GET', `/procurement-planning/auto-reorder/preview?warehouse_id=${warehouse.id}`, {
      token,
      companyId,
    })
    const rows = preview.data ?? []
    const hit = rows.find((r) => r.product_id === product.data.id)
    if (!hit) {
      fail('auto-reorder-preview', `produk QA tidak muncul (preview_count=${rows.length} track=${product.data.track_stock} min=${product.data.min_stock} reorder=${product.data.reorder_qty})`)
    } else {
      ok('auto-reorder-preview', `product=${hit.product_id} stock=${hit.stock_qty} suggest=${hit.suggested_qty}`)
      const run = await req('POST', '/procurement-planning/auto-reorder/run', {
        token,
        companyId,
        body: {
          warehouse_id: warehouse.id,
          items: [{ product_id: product.data.id, qty: hit.suggested_qty }],
        },
      })
      ok('auto-reorder-run', `pr=${run.data.number} id=${run.data.purchase_requisition_id}`)
    }
    }
  } catch (e) {
    fail('auto-reorder', String(e.message || e))
  }

  // --- 4) Demand planning: seed outbound stock movement via adjustment ---
  try {
    const product = await req('POST', '/products', {
      token,
      companyId,
      body: {
        name: `QA Demand Item ${stamp}`,
        sku: `DMD-${stamp}`,
        type: 'goods',
        track_stock: true,
        category_id: rawCat.id,
        unit_id: unitId,
        sell_price: 0,
        cost_price: 12_000,
        is_active: true,
      },
    })
    const productId = product.data.id
    if (!product.data.track_stock) {
      throw new Error(`track_stock false setelah create product ${productId}`)
    }

    // inbound first so outbound doesn't fail negative stock
    const adjIn = await req('POST', '/stock-adjustments', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        warehouse_id: warehouse.id,
        reason: 'found',
        note: 'QA seed stock for demand',
        items: [{ product_id: productId, qty_change: 90, unit_level: 'small' }],
      },
    })
    await req('POST', `/stock-adjustments/${adjIn.data.id}/confirm`, { token, companyId })

    const adjOut = await req('POST', '/stock-adjustments', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        warehouse_id: warehouse.id,
        reason: 'damage',
        note: 'QA usage for demand forecast',
        items: [{ product_id: productId, qty_change: -30, unit_level: 'small' }],
      },
    })
    await req('POST', `/stock-adjustments/${adjOut.data.id}/confirm`, { token, companyId })

    const generated = await req('POST', '/procurement-planning/demand/generate', {
      token,
      companyId,
      body: { warehouse_id: warehouse.id, months_ahead: 1 },
    })
    const forecasts = generated.data ?? []
    const mine = forecasts.find((f) => f.product_id === productId)
    if (!mine) {
      // generate may return only newly touched; list all suggested
      const listed = await req('GET', `/procurement-planning/demand/forecasts?warehouse_id=${warehouse.id}`, {
        token,
        companyId,
      })
      const hit = (listed.data ?? []).find((f) => f.product_id === productId)
      if (!hit) {
        fail('demand-generate', `forecast QA tidak muncul (gen=${forecasts.length} list=${(listed.data ?? []).length})`)
      } else {
        ok('demand-generate', `forecast_id=${hit.id} qty=${hit.forecast_qty}`)
        const pr = await req('POST', '/procurement-planning/demand/suggest-pr', {
          token,
          companyId,
          body: { warehouse_id: warehouse.id, forecast_ids: [hit.id] },
        })
        ok('demand-suggest-pr', `pr=${pr.data.number} id=${pr.data.purchase_requisition_id}`)
      }
    } else {
      ok('demand-generate', `forecast_id=${mine.id} qty=${mine.forecast_qty}`)
      const pr = await req('POST', '/procurement-planning/demand/suggest-pr', {
        token,
        companyId,
        body: { warehouse_id: warehouse.id, forecast_ids: [mine.id] },
      })
      ok('demand-suggest-pr', `pr=${pr.data.number} id=${pr.data.purchase_requisition_id}`)
    }
  } catch (e) {
    fail('demand-planning', String(e.message || e))
  }

  // --- 5) Landed cost on GR draft → confirm applies to unit cost ---
  try {
    const product = await req('POST', '/products', {
      token,
      companyId,
      body: {
        name: `QA Landed Item ${stamp}`,
        sku: `LND-${stamp}`,
        type: 'goods',
        track_stock: true,
        is_procurement_item: true,
        unit_id: unitId,
        sell_price: 0,
        cost_price: 50_000,
        is_active: true,
      },
    })
    const productId = product.data.id
    const productUnit = product.data.unit || unitName
    const unitCost = 50_000
    const qty = 2

    const { po } = await createOrderedPo({
      token,
      companyId,
      productId,
      unit: productUnit,
      qty,
      unitCost,
      note: 'QA landed cost',
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      departmentId: dept?.id,
      outletId,
    })
    const poItem = (po.items ?? [])[0]
    if (!poItem) throw new Error('PO tanpa items')

    const gr = await req('POST', '/goods-receipts', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        purchase_order_id: po.id,
        warehouse_id: warehouse.id,
        outlet_id: outletId || undefined,
        note: 'QA landed GR',
        items: [
          {
            purchase_order_item_id: poItem.id,
            product_id: productId,
            qty,
            unit: productUnit,
            unit_level: 'small',
            unit_cost: unitCost,
          },
        ],
      },
    })
    const grId = gr.data.id
    const freight = 20_000
    const customs = 10_000
    await req('PUT', `/goods-receipts/${grId}/landed-cost`, {
      token,
      companyId,
      body: {
        freight,
        customs,
        insurance: 0,
        other: 0,
        allocation_method: 'qty',
      },
    })
    const before = await req('GET', `/goods-receipts/${grId}`, { token, companyId })
    const unitBefore = (before.data.items ?? [])[0]?.unit_cost

    await req('POST', `/goods-receipts/${grId}/confirm`, { token, companyId })
    const after = await req('GET', `/goods-receipts/${grId}`, { token, companyId })
    const unitAfter = (after.data.items ?? [])[0]?.unit_cost
    const landed = await req('GET', `/goods-receipts/${grId}/landed-cost`, { token, companyId })
    const applied = Boolean(landed.data?.applied_at)
    const expectedBump = Math.floor((freight + customs) / qty)
    if (!applied) {
      fail('landed-cost', `tidak applied; unit ${unitBefore}→${unitAfter}`)
    } else if (unitAfter < unitBefore + expectedBump) {
      fail(
        'landed-cost',
        `applied tapi unit cost kurang naik: before=${unitBefore} after=${unitAfter} expect>=${unitBefore + expectedBump}`,
      )
    } else {
      ok(
        'landed-cost',
        `gr=${after.data.number} unit ${unitBefore}→${unitAfter} extra=${landed.data.total_extra} applied=${applied}`,
      )
    }
  } catch (e) {
    fail('landed-cost', String(e.message || e))
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n--- summary ---')
  console.log(`pass=${results.filter((r) => r.ok).length} fail=${failed.length}`)
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
