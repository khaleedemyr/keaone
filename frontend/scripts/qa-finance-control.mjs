/**
 * Enable finance/control procurement flags and smoke-test APIs.
 * Usage: node scripts/qa-finance-control.mjs
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

async function ensureAccount(token, companyId, code, name, account_type) {
  const list = await req('GET', '/gl-accounts?for_select=1&per_page=200', { token, companyId })
  const found = (list.data ?? []).find((a) => a.code === code)
  if (found) return found
  const created = await req('POST', '/gl-accounts', {
    token,
    companyId,
    body: { code, name, account_type, is_active: true },
  })
  return created.data
}

async function main() {
  const login = await req('POST', '/auth/login', {
    body: { email: EMAIL, password: PASSWORD, device_name: 'qa-finance', remember: true },
  })
  const token = login.data?.token || login.token || login.data?.access_token
  if (!token) throw new Error(`Login tidak mengembalikan token: ${JSON.stringify(login).slice(0, 300)}`)
  const companyId = login.data?.company?.id || login.data?.user?.last_company_id || login.data?.me?.company?.id || 1
  let adminId = login.data?.user?.id
  try {
    const me = await req('GET', '/me', { token, companyId })
    adminId = me.data?.user?.id || me.data?.id || adminId
  } catch {
    /* /auth/me maybe */
    try {
      const me = await req('GET', '/auth/me', { token, companyId })
      adminId = me.data?.user?.id || me.data?.id || adminId
    } catch {
      /* use login payload */
    }
  }
  ok('login', `company=${companyId} user=${adminId}`)

  // --- 1) Enable settings + map GL ---
  const inv = await ensureAccount(token, companyId, '1101', 'Persediaan', 'asset')
  const grni = await ensureAccount(token, companyId, '2101', 'GRNI', 'liability')
  const ap = await ensureAccount(token, companyId, '2102', 'Hutang Usaha', 'liability')
  const vat = await ensureAccount(token, companyId, '1201', 'PPN Masukan', 'asset')
  const cash = await ensureAccount(token, companyId, '1102', 'Kas', 'asset')
  const bank = await ensureAccount(token, companyId, '1103', 'Bank', 'asset')
  const wht = await ensureAccount(token, companyId, '2103', 'PPh Terutang', 'liability')
  const expense = await ensureAccount(token, companyId, '5101', 'Beban Operasional', 'expense')
  const fixed = await ensureAccount(token, companyId, '1501', 'Aset Tetap', 'asset')
  ok('gl-accounts', 'mapped 9 accounts')

  await req('PUT', '/company/settings', {
    token,
    companyId,
    body: {
      settings: {
        vendor_invoice_enabled: true,
        vendor_payment_batch_enabled: true,
        vendor_prepayment_enabled: true,
        procurement_match_enabled: true,
        procurement_withholding_tax_enabled: true,
        procurement_gl_posting_enabled: true,
        procurement_budget_check_enabled: true,
        procurement_approval_delegation_enabled: true,
        procurement_approval_mode: 'matrix',
        pr_need_approval: false,
        po_need_approval: false,
        gl_procurement_inventory_account_id: inv.id,
        gl_procurement_grni_account_id: grni.id,
        gl_procurement_ap_account_id: ap.id,
        gl_procurement_vat_input_account_id: vat.id,
        gl_procurement_cash_account_id: cash.id,
        gl_procurement_bank_account_id: bank.id,
        gl_procurement_wht_payable_account_id: wht.id,
        gl_procurement_expense_account_id: expense.id,
        gl_procurement_fixed_asset_account_id: fixed.id,
      },
    },
  })
  const settings = await req('GET', '/company/settings', { token, companyId })
  const s = settings.data?.settings || settings.data || {}
  ok(
    'settings',
    `wht=${s.procurement_withholding_tax_enabled} gl=${s.procurement_gl_posting_enabled} budget=${s.procurement_budget_check_enabled} mode=${s.procurement_approval_mode} delegasi=${s.procurement_approval_delegation_enabled}`,
  )

  // --- 2) Budget create + activate ---
  const deps = await req('GET', '/departments?status=active&per_page=50', { token, companyId })
  const dept = (deps.data ?? [])[0]
  const year = new Date().getFullYear()
  const budget = await req('POST', '/budgets', {
    token,
    companyId,
    body: {
      name: `QA Budget ${year} ${Date.now().toString().slice(-4)}`,
      fiscal_year: year,
      period_start: `${year}-01-01`,
      period_end: `${year}-12-31`,
      note: 'QA finance control',
      lines: [{ department_id: dept?.id ?? null, amount: 50_000_000, note: 'QA' }],
    },
  })
  const budgetId = budget.data.id
  await req('POST', `/budgets/${budgetId}/activate`, { token, companyId })
  const budgets = await req('GET', '/budgets?status=active&per_page=20', { token, companyId })
  ok('budget', `id=${budgetId} active_count=${(budgets.data ?? []).length}`)

  // --- 3) Approval matrix CRUD ---
  const members = await req('GET', '/users?for_select=1&status=active&per_page=50', { token, companyId })
  const member =
    (members.data ?? []).find((m) => m.id === adminId) ||
    (members.data ?? [])[0]
  const approverRef = member?.id || adminId
  const matrix = await req('POST', '/approval-matrix', {
    token,
    companyId,
    body: {
      doc_type: 'pr',
      department_id: null,
      min_amount: 0,
      max_amount: null,
      level: 1,
      approver_type: 'user',
      approver_ref_id: approverRef,
      priority: 0,
      is_active: true,
    },
  })
  const matrixList = await req('GET', '/approval-matrix?per_page=50', { token, companyId })
  ok('matrix', `id=${matrix.data.id} total=${(matrixList.data ?? []).length}`)

  // --- 4) Delegation CRUD ---
  const ownerUser = (members.data ?? []).find((m) => m.email === 'owner@demo.test')
  const adminUser = (members.data ?? []).find((m) => m.email === 'admin@demo.test')
  const userId = ownerUser?.id || adminId
  const delegateUserId = adminUser?.id
  if (!delegateUserId || delegateUserId === userId) {
    fail('delegation', 'Tidak menemukan admin berbeda untuk delegasi')
  } else {
    const today = new Date()
    const start = today.toISOString().slice(0, 10)
    const end = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    const del = await req('POST', '/approval-delegations', {
      token,
      companyId,
      body: {
        user_id: userId,
        delegate_user_id: delegateUserId,
        starts_at: start,
        ends_at: end,
        note: 'QA delegation',
        is_active: true,
      },
    })
    const dels = await req('GET', '/approval-delegations?per_page=50', { token, companyId })
    ok('delegation', `id=${del.data.id} total=${(dels.data ?? []).length}`)
  }

  async function createOrderedPo({ productId, unit, qty, unitCost, note, supplierId, warehouseId, departmentId, outletId }) {
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
    prShow = await req('GET', `/purchase-requisitions/${prId}`, { token, companyId })
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

  // --- 5) Fixed asset via PR → PO → GR confirm ---
  const suppliers = await req('GET', '/suppliers?for_select=1&status=active&per_page=50', { token, companyId })
  const supplier = (suppliers.data ?? [])[0]
  const warehouses = await req('GET', '/warehouses?status=active&per_page=20', { token, companyId })
  const warehouse = (warehouses.data ?? [])[0]
  const outlets = await req('GET', '/outlets?status=active&per_page=20', { token, companyId })
  const outletId = warehouse?.outlet_id || (outlets.data ?? [])[0]?.id
  if (!supplier || !warehouse) throw new Error('Supplier/warehouse kosong')

  const units = await req('GET', '/units?status=active&per_page=50', { token, companyId })
  const unitId = (units.data ?? [])[0]?.id
  if (!unitId) throw new Error('Unit master kosong')

  const product = await req('POST', '/products', {
    token,
    companyId,
    body: {
      name: `QA Laptop Asset ${Date.now().toString().slice(-5)}`,
      sku: `AST-${Date.now().toString().slice(-6)}`,
      type: 'goods',
      track_stock: false,
      is_procurement_item: true,
      is_fixed_asset_item: true,
      unit_id: unitId,
      sell_price: 0,
      cost_price: 5_000_000,
      is_active: true,
    },
  })
  const productId = product.data.id
  const productUnit = product.data.unit || (units.data ?? [])[0]?.name || 'pcs'

  const { po: poReady } = await createOrderedPo({
    productId,
    unit: productUnit,
    qty: 1,
    unitCost: 5_000_000,
    note: 'QA fixed asset',
    supplierId: supplier.id,
    warehouseId: warehouse.id,
    departmentId: dept?.id,
    outletId,
  })
  const poId = poReady.id
  const poItem = (poReady.items ?? [])[0]
  ok('po-asset', `po=${poReady.number} status=${poReady.status}`)

  const gr = await req('POST', '/goods-receipts', {
    token,
    companyId,
    body: {
      client_uuid: uuid(),
      purchase_order_id: poId,
      supplier_id: supplier.id,
      warehouse_id: warehouse.id,
      items: [
        {
          product_id: productId,
          purchase_order_item_id: poItem.id,
          qty: 1,
          unit: productUnit,
          unit_level: 'small',
          unit_cost: 5_000_000,
        },
      ],
    },
  })
  const grId = gr.data.id
  await req('POST', `/goods-receipts/${grId}/confirm`, { token, companyId })
  const assets = await req('GET', `/assets?search=${encodeURIComponent(product.data.name)}&per_page=20`, {
    token,
    companyId,
  })
  const assetHit = (assets.data ?? []).find((a) => a.product_id === productId) || (assets.data ?? [])[0]
  if (assetHit) ok('assets', `id=${assetHit.id} number=${assetHit.number}`)
  else fail('assets', 'Tidak ada kartu aset setelah GR confirm')

  // --- 6) GL journals after GR ---
  const journals = await req('GET', '/gl-journals?per_page=20', { token, companyId })
  ok('gl-journals', `count=${(journals.data ?? []).length}`)

  // --- 7) WHT: enable supplier + invoice + pay ---
  await req('PUT', `/suppliers/${supplier.id}`, {
    token,
    companyId,
    body: {
      withholding_tax_enabled: true,
      withholding_tax_type: 'pph23',
      withholding_tax_rate: 2,
      withholding_tax_base: 'subtotal',
    },
  })

  // Use stock product for invoice path if available; else asset product via GR invoice
  const stockProducts = await req('GET', '/products?status=active&per_page=50&for_purchase=1', {
    token,
    companyId,
  })
  const stock =
    (stockProducts.data ?? []).find((p) => p.track_stock && !p.is_fixed_asset_item) ||
    (stockProducts.data ?? []).find((p) => !p.is_fixed_asset_item)

  let whtInvoiceId = null
  if (stock) {
    const { po: po2Show } = await createOrderedPo({
      productId: stock.id,
      unit: stock.unit || productUnit,
      qty: 2,
      unitCost: 100_000,
      note: 'QA WHT',
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      departmentId: dept?.id,
      outletId,
    })
    const po2Item = (po2Show.items ?? [])[0]
    const gr2 = await req('POST', '/goods-receipts', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        purchase_order_id: po2Show.id,
        supplier_id: supplier.id,
        warehouse_id: warehouse.id,
        items: [
          {
            product_id: stock.id,
            purchase_order_item_id: po2Item.id,
            qty: 2,
            unit: stock.unit || productUnit,
            unit_level: 'small',
            unit_cost: 100_000,
          },
        ],
      },
    })
    await req('POST', `/goods-receipts/${gr2.data.id}/confirm`, { token, companyId })
    const gr2Show = await req('GET', `/goods-receipts/${gr2.data.id}`, { token, companyId })
    const grItem = (gr2Show.data.items ?? [])[0]

    const invDoc = await req('POST', '/vendor-invoices', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        supplier_id: supplier.id,
        purchase_order_id: po2Show.id,
        goods_receipt_id: gr2.data.id,
        invoice_date: new Date().toISOString().slice(0, 10),
        vendor_ref: `QA-WHT-${Date.now().toString().slice(-5)}`,
        tax_percent: 0,
        items: [
          {
            product_id: stock.id,
            goods_receipt_item_id: grItem.id,
            purchase_order_item_id: po2Item.id,
            qty: 2,
            unit: stock.unit || productUnit,
            unit_level: 'small',
            unit_cost: 100_000,
            discount: 0,
          },
        ],
      },
    })
    whtInvoiceId = invDoc.data.id
    try {
      await req('POST', `/vendor-invoices/${whtInvoiceId}/submit`, { token, companyId })
    } catch {
      /* may go straight */
    }
    try {
      await req('POST', `/vendor-invoices/${whtInvoiceId}/confirm`, { token, companyId })
    } catch (err) {
      try {
        await req('POST', `/vendor-invoices/${whtInvoiceId}/approve`, { token, companyId })
        await req('POST', `/vendor-invoices/${whtInvoiceId}/confirm`, { token, companyId })
      } catch (err2) {
        fail('invoice-confirm', String(err2.message || err.message))
      }
    }

    const invShow = await req('GET', `/vendor-invoices/${whtInvoiceId}`, { token, companyId })
    ok(
      'invoice-wht',
      `status=${invShow.data.status} wht=${invShow.data.withholding_tax} payable=${invShow.data.amount_payable}`,
    )

    if (['confirmed'].includes(invShow.data.status)) {
      const batch = await req('POST', '/vendor-payment-batches', {
        token,
        companyId,
        body: {
          client_uuid: uuid(),
          payment_method: 'transfer',
          note: 'QA WHT pay',
          items: [
            {
              vendor_invoice_id: whtInvoiceId,
              amount: invShow.data.amount_payable ?? invShow.data.amount_due ?? invShow.data.total,
            },
          ],
        },
      })
      const batchId = batch.data.id
      await req('POST', `/vendor-payment-batches/${batchId}/submit`, { token, companyId })
      let batchShow = await req('GET', `/vendor-payment-batches/${batchId}`, { token, companyId })
      if (batchShow.data.status === 'submitted') {
        await req('POST', `/vendor-payment-batches/${batchId}/pay`, { token, companyId })
      } else if (batchShow.data.status === 'approved') {
        // if company still requires approval path
        await req('POST', `/vendor-payment-batches/${batchId}/pay`, { token, companyId })
      } else {
        fail('payment-pay', `unexpected status ${batchShow.data.status}`)
      }
      batchShow = await req('GET', `/vendor-payment-batches/${batchId}`, { token, companyId })
      ok('payment', `status=${batchShow.data.status}`)
    }
  } else {
    fail('invoice-wht', 'Tidak ada produk stock untuk alur invoice')
  }

  const whtList = await req('GET', '/vendor-withholding?per_page=50', { token, companyId })
  ok('withholding-list', `count=${(whtList.data ?? []).length}`)

  const journals2 = await req('GET', '/gl-journals?per_page=50', { token, companyId })
  ok('gl-journals-after', `count=${(journals2.data ?? []).length}`)

  // List endpoints for UI readiness
  for (const [id, path] of [
    ['list-budgets', '/budgets?per_page=5'],
    ['list-assets', '/assets?per_page=5'],
    ['list-matrix', '/approval-matrix?per_page=5'],
    ['list-delegations', '/approval-delegations?per_page=5'],
    ['list-withholding', '/vendor-withholding?per_page=5'],
    ['list-journals', '/gl-journals?per_page=5'],
  ]) {
    const rows = await req('GET', path, { token, companyId })
    ok(id, `n=${(rows.data ?? []).length}`)
  }

  console.log('\n=== SUMMARY ===')
  const failed = results.filter((r) => !r.ok)
  console.log(`passed=${results.filter((r) => r.ok).length} failed=${failed.length}`)
  if (failed.length) {
    for (const f of failed) console.log(` - ${f.id}: ${f.detail}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('FATAL', err)
  process.exitCode = 1
})
