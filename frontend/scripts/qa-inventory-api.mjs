/**
 * API smoke for inventory document create + validation.
 * Usage: node scripts/qa-inventory-api.mjs
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

async function main() {
  const login = await must('POST', '/auth/login', {
    body: { email: EMAIL, password: PASSWORD, device_name: 'qa-inventory', remember: true },
  })
  const token = login.data?.token || login.token || login.data?.access_token
  if (!token) throw new Error('No token')
  const companyId =
    login.data?.company?.id || login.data?.user?.last_company_id || login.data?.me?.company?.id || 1
  ok('login', `company=${companyId}`)

  const wh = await must('GET', '/warehouses?for_select=1&status=active&per_page=50', { token, companyId })
  const warehouses = wh.data ?? []
  if (warehouses.length < 1) throw new Error('Butuh minimal 1 gudang')
  const from = warehouses[0]
  const to = warehouses.find((w) => w.id !== from.id) || warehouses[0]
  ok('warehouses', `from=${from.id} to=${to.id} count=${warehouses.length}`)

  const prod = await must('GET', '/products?for_select=1&status=active&per_page=50', { token, companyId })
  const product = (prod.data ?? []).find((p) => p.track_stock)
  if (!product) throw new Error('Tidak ada produk track_stock')
  ok('product', `${product.name}#${product.id}`)

  // Stock list alignment fields
  const stock = await must('GET', `/stock?warehouse_id=${from.id}&per_page=20`, { token, companyId })
  const row = (stock.data ?? [])[0]
  if (row && typeof row.unit_cost === 'number' && typeof row.cost_value === 'number') {
    ok('stock-list', `unit_cost=${row.unit_cost} cost_value=${row.cost_value}`)
  } else {
    fail('stock-list', 'missing unit_cost/cost_value')
  }

  // Same warehouse transfer rejected
  {
    const { res, json } = await req('POST', '/stock-transfers', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        from_warehouse_id: from.id,
        to_warehouse_id: from.id,
        items: [{ product_id: product.id, qty: 1 }],
      },
    })
    if (res.status >= 400) ok('transfer-same-wh', `rejected ${res.status}`)
    else fail('transfer-same-wh', `accepted id=${json?.data?.id}`)
  }

  // Create transfer draft (needs 2 warehouses)
  if (to.id !== from.id) {
    const tr = await must('POST', '/stock-transfers', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        from_warehouse_id: from.id,
        to_warehouse_id: to.id,
        note: 'QA inventory transfer',
        items: [{ product_id: product.id, qty: 1 }],
      },
    })
    ok('transfer-create', tr.data.number)

    // Duplicate product rejected
    const { res: dupRes } = await req('PUT', `/stock-transfers/${tr.data.id}`, {
      token,
      companyId,
      body: {
        items: [
          { product_id: product.id, qty: 1 },
          { product_id: product.id, qty: 2 },
        ],
      },
    })
    if (dupRes.status >= 400) ok('transfer-dup-product', `rejected ${dupRes.status}`)
    else fail('transfer-dup-product', 'accepted duplicate products')

    // Cancel draft
    await must('POST', `/stock-transfers/${tr.data.id}/cancel`, { token, companyId })
    ok('transfer-cancel', 'cancelled')
  } else {
    fail('transfer-create', 'Hanya 1 gudang — skip transfer antar gudang')
  }

  // Opname: book_qty from client ignored
  const op = await must('POST', '/stock-opnames', {
    token,
    companyId,
    body: {
      client_uuid: uuid(),
      warehouse_id: from.id,
      note: 'QA opname',
      items: [{ product_id: product.id, book_qty: 999999, counted_qty: 0 }],
    },
  })
  const book = op.data.items?.[0]?.book_qty
  if (book === 999999) fail('opname-book-ignored', `book still ${book}`)
  else ok('opname-book-ignored', `server book=${book} (not 999999)`)
  await must('POST', `/stock-opnames/${op.data.id}/cancel`, { token, companyId })
  ok('opname-cancel', op.data.number)

  // Waste positive rejected
  {
    const { res } = await req('POST', '/stock-adjustments', {
      token,
      companyId,
      body: {
        client_uuid: uuid(),
        warehouse_id: from.id,
        reason: 'expired',
        items: [{ product_id: product.id, qty_change: 3 }],
      },
    })
    if (res.status >= 400) ok('waste-positive', `rejected ${res.status}`)
    else fail('waste-positive', 'accepted positive waste')
  }

  // Adjustment create + cancel
  const adj = await must('POST', '/stock-adjustments', {
    token,
    companyId,
    body: {
      client_uuid: uuid(),
      warehouse_id: from.id,
      reason: 'found',
      items: [{ product_id: product.id, qty_change: 1 }],
    },
  })
  ok('adjustment-create', adj.data.number)
  await must('POST', `/stock-adjustments/${adj.data.id}/cancel`, { token, companyId })
  ok('adjustment-cancel', 'cancelled')

  // Valuation
  const val = await must('GET', `/stock/valuation?warehouse_id=${from.id}`, { token, companyId })
  ok('valuation', `rows=${(val.data?.rows ?? val.data ?? []).length}`)

  console.log('\n=== SUMMARY ===')
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id} — ${r.detail}`)
  if (results.some((r) => !r.ok)) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
