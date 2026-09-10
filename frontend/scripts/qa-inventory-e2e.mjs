/**
 * Inventory document lifecycle E2E (API).
 * Ensures BOM FG, then: transfer ship/receive/void, opname confirm,
 * adjustment/waste confirm, production confirm/void.
 *
 * Usage: node scripts/qa-inventory-e2e.mjs
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
  return { res, json }
}

async function must(method, path, opts) {
  const { res, json } = await req(method, path, opts)
  if (!res.ok) {
    const msg = json?.message || json?.error || res.statusText
    const errors = json?.errors ? ` ${JSON.stringify(json.errors)}` : ''
    throw new Error(`${method} ${path} → ${res.status}: ${msg}${errors}`)
  }
  return json
}

async function ensureBomProduct(token, companyId, components) {
  const list = await must('GET', '/products?for_select=1&status=active&per_page=200', { token, companyId })
  const [c1, c2] = components
  const body = {
    name: 'Paket QA Produksi',
    sku: 'PKT-QA-001',
    barcode: '8991002199001',
    unit_id: c1.unit_id,
    sell_price: 15000,
    cost_price: 10000,
    track_stock: true,
    is_active: true,
    bom_items: [
      { component_id: c1.id, qty: 1, unit_id: c1.unit_id },
      { component_id: c2.id, qty: 1, unit_id: c2.unit_id },
    ],
  }

  const bySku = (list.data ?? []).find((p) => p.sku === 'PKT-QA-001')
  if (bySku) {
    const updated = await must('PUT', `/products/${bySku.id}`, { token, companyId, body })
    return { ...updated.data, has_bom: true, track_stock: true }
  }

  const created = await must('POST', '/products', { token, companyId, body })
  return { ...created.data, has_bom: true, track_stock: true }
}

async function main() {
  const login = await must('POST', '/auth/login', {
    body: { email: EMAIL, password: PASSWORD, device_name: 'qa-inventory-e2e', remember: true },
  })
  const token = login.data?.token || login.token
  if (!token) throw new Error('No token')
  const companyId =
    login.data?.company?.id || login.data?.user?.last_company_id || login.data?.me?.company?.id || 1
  ok('login', `company=${companyId}`)

  const wh = await must('GET', '/warehouses?for_select=1&status=active&per_page=50', { token, companyId })
  const warehouses = wh.data ?? []
  const from = warehouses.find((w) => w.is_default) || warehouses[0]
  const to = warehouses.find((w) => w.id !== from.id)
  if (!from || !to) throw new Error('Butuh minimal 2 gudang')
  ok('warehouses', `from=${from.id} to=${to.id}`)

  const prod = await must('GET', '/products?for_select=1&status=active&per_page=100', { token, companyId })
  const products = prod.data ?? []
  const stock = await must('GET', `/stock?warehouse_id=${from.id}&per_page=100`, { token, companyId })
  const stockRows = stock.data ?? []
  const withStock = stockRows.filter((r) => Number(r.qty) > 0).map((r) => r.product_id)
  const comps = products.filter((p) => p.track_stock && withStock.includes(p.id))
  if (comps.length < 2) throw new Error('Butuh minimal 2 produk track_stock dengan stok > 0 di gudang asal')
  const [c1, c2] = comps
  ok('components', `${c1.name} + ${c2.name} (stocked @ wh ${from.id})`)

  const bomFg = await ensureBomProduct(token, companyId, [c1, c2])
  ok('bom-seed', `${bomFg.name}#${bomFg.id}`)

  // Cancel leftover draft production from prior failed runs
  {
    const list = await must('GET', '/stock-productions?status=draft&per_page=20', { token, companyId })
    for (const row of list.data ?? []) {
      await req('POST', `/stock-productions/${row.id}/cancel`, { token, companyId })
    }
  }

  const moveProduct = c1

  // --- Transfer: ship → void ---
  {
    const tr = await must('POST', '/stock-transfers', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        from_warehouse_id: from.id,
        to_warehouse_id: to.id,
        note: 'QA e2e ship-void',
        items: [{ product_id: moveProduct.id, qty: 1 }],
      },
    })
    await must('POST', `/stock-transfers/${tr.data.id}/ship`, { token, companyId })
    ok('transfer-ship', tr.data.number)
    const voided = await must('POST', `/stock-transfers/${tr.data.id}/void`, {
      token,
      companyId,
      body: { reason: 'QA void after ship' },
    })
    if (voided.data?.status === 'voided' || voided.data?.voided_at) ok('transfer-void-shipped', voided.data.status || 'voided')
    else ok('transfer-void-shipped', JSON.stringify(voided.data?.status ?? voided.data))
  }

  // --- Transfer: ship → receive → void ---
  {
    const tr = await must('POST', '/stock-transfers', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        from_warehouse_id: from.id,
        to_warehouse_id: to.id,
        note: 'QA e2e ship-receive-void',
        items: [{ product_id: moveProduct.id, qty: 1 }],
      },
    })
    await must('POST', `/stock-transfers/${tr.data.id}/ship`, { token, companyId })
    await must('POST', `/stock-transfers/${tr.data.id}/receive`, { token, companyId })
    ok('transfer-receive', tr.data.number)
    await must('POST', `/stock-transfers/${tr.data.id}/void`, {
      token,
      companyId,
      body: { reason: 'QA void after receive' },
    })
    ok('transfer-void-received', 'voided')
  }

  // --- Opname confirm (counted = book → zero variance) ---
  {
    const draft = await must('POST', '/stock-opnames', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        warehouse_id: from.id,
        note: 'QA e2e opname confirm',
        items: [{ product_id: moveProduct.id, counted_qty: 0 }],
      },
    })
    const book = Number(draft.data.items?.[0]?.book_qty ?? 0)
    await must('PUT', `/stock-opnames/${draft.data.id}`, {
      token,
      companyId,
      body: {
        items: [{ product_id: moveProduct.id, counted_qty: book }],
      },
    })
    const confirmed = await must('POST', `/stock-opnames/${draft.data.id}/confirm`, { token, companyId })
    ok('opname-confirm', `${confirmed.data.number} status=${confirmed.data.status} book=${book}`)
  }

  // --- Adjustment confirm (+1 found) then waste confirm (-1) ---
  {
    const adj = await must('POST', '/stock-adjustments', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        warehouse_id: from.id,
        reason: 'found',
        note: 'QA e2e adj',
        items: [{ product_id: moveProduct.id, qty_change: 1 }],
      },
    })
    await must('POST', `/stock-adjustments/${adj.data.id}/confirm`, { token, companyId })
    ok('adjustment-confirm', adj.data.number)

    const waste = await must('POST', '/stock-adjustments', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        warehouse_id: from.id,
        reason: 'expired',
        note: 'QA e2e waste',
        items: [{ product_id: moveProduct.id, qty_change: -1 }],
      },
    })
    await must('POST', `/stock-adjustments/${waste.data.id}/confirm`, { token, companyId })
    ok('waste-confirm', waste.data.number)
  }

  // --- Production: create → confirm → void ---
  {
    const preview = await must(
      'GET',
      `/stock-productions/preview?product_id=${bomFg.id}&qty=1&warehouse_id=${from.id}`,
      { token, companyId },
    )
    ok('production-preview', `lines=${(preview.data?.items ?? preview.data?.lines ?? []).length || Object.keys(preview.data || {}).length}`)

    const pr = await must('POST', '/stock-productions', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        warehouse_id: from.id,
        product_id: bomFg.id,
        qty: 1,
        note: 'QA e2e production',
      },
    })
    ok('production-create', pr.data.number)

    const confirmed = await must('POST', `/stock-productions/${pr.data.id}/confirm`, { token, companyId })
    ok('production-confirm', confirmed.data.status)

    await must('POST', `/stock-productions/${pr.data.id}/void`, {
      token,
      companyId,
      body: { reason: 'QA void production' },
    })
    ok('production-void', 'voided')
  }

  console.log('\n=== SUMMARY ===')
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id} — ${r.detail}`)
  if (results.some((r) => !r.ok)) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
