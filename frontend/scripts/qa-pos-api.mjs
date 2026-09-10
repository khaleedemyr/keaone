/**
 * POS + sales GL API QA.
 * Usage: node scripts/qa-pos-api.mjs
 * Env: QA_API, QA_EMAIL, QA_PASSWORD
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
    body: { email: EMAIL, password: PASSWORD, device_name: 'qa-pos', remember: true },
  })
  const token = login.data?.token || login.token
  if (!token) throw new Error('No token')

  const me = await must('GET', '/me', { token })
  const companyId = me.data?.company?.id || login.data?.company?.id || 1
  const settings = me.data?.settings || {}
  ok('login', `company=${companyId} sales_gl=${settings.sales_gl_posting_enabled}`)

  if (!settings.sales_gl_posting_enabled) {
    await must('PUT', '/company/settings', {
      token,
      companyId,
      body: { settings: { sales_gl_posting_enabled: true } },
    })
    ok('enable-sales-gl', 'forced on')
  } else {
    ok('sales-gl-enabled', 'already on')
  }

  // Products for POS
  const prodRes = await must('GET', '/products?for_pos=1&per_page=50', { token, companyId })
  const products = prodRes.data ?? []
  if (products.length < 1) throw new Error('No POS products')
  const product = products.find((p) => Number(p.sell_price) > 0) || products[0]
  ok('products', `${products.length} items; pick ${product.name}#${product.id} @${product.sell_price}`)

  // Server search
  {
    const q = (product.name || 'a').slice(0, 3)
    const search = await must('GET', `/products?for_pos=1&search=${encodeURIComponent(q)}&per_page=20`, {
      token,
      companyId,
    })
    const hits = search.data ?? []
    if (hits.some((p) => p.id === product.id) || hits.length > 0) {
      ok('product-search', `q="${q}" hits=${hits.length}`)
    } else {
      fail('product-search', `q="${q}" empty`)
    }
  }

  // Cash sale with change
  const cashUuid = uuid()
  const cashPay = Math.max(Number(product.sell_price) + 5000, Number(product.sell_price))
  const cashSale = await must('POST', '/sales', {
    token,
    companyId,
    body: {
      client_uuid: cashUuid,
      channel: 'pos',
      skip_auto_promotion: true,
      items: [{ product_id: product.id, qty: 1 }],
      payments: [{ method: 'cash', amount: cashPay, client_uuid: `${cashUuid}-p0` }],
    },
  })
  const sale = cashSale.data
  ok(
    'sale-cash',
    `${sale.number} total=${sale.total} paid=${sale.paid_amount} change=${sale.change_amount} status=${sale.status}`,
  )

  // Receipt
  const receipt = await must('GET', `/sales/${sale.id}/receipt`, { token, companyId })
  if (receipt.data?.sale?.number === sale.number) ok('receipt', sale.number)
  else fail('receipt', 'mismatch')

  // Idempotent replay
  const replay = await must('POST', '/sales', {
    token,
    companyId,
    body: {
      client_uuid: cashUuid,
      channel: 'pos',
      skip_auto_promotion: true,
      items: [{ product_id: product.id, qty: 1 }],
      payments: [{ method: 'cash', amount: cashPay, client_uuid: `${cashUuid}-p0` }],
    },
  })
  if (replay.data?.id === sale.id) ok('idempotent-same-cart', `id=${sale.id}`)
  else fail('idempotent-same-cart', `got ${replay.data?.id}`)

  // Same UUID different cart → should 422
  {
    const other = products.find((p) => p.id !== product.id && Number(p.sell_price) > 0)
    if (other) {
      const { res, json } = await req('POST', '/sales', {
        token,
        companyId,
        body: {
          client_uuid: cashUuid,
          channel: 'pos',
          skip_auto_promotion: true,
          items: [{ product_id: other.id, qty: 1 }],
          payments: [{ method: 'cash', amount: Number(other.sell_price), client_uuid: `${cashUuid}-bad` }],
        },
      })
      if (res.status === 422) ok('idempotent-diff-cart', '422 as expected')
      else fail('idempotent-diff-cart', `status=${res.status} ${JSON.stringify(json?.errors || json?.message)}`)
    } else {
      ok('idempotent-diff-cart', 'skipped (need 2 products)')
    }
  }

  // GL journal for sale
  {
    const journals = await must('GET', `/gl-journals?source_type=sale&search=${encodeURIComponent(sale.number)}&per_page=20`, {
      token,
      companyId,
    })
    const rows = journals.data ?? []
    const entry = rows.find((j) => j.source_type === 'sale' && String(j.source_id) === String(sale.id))
      || rows.find((j) => j.source_number === sale.number)
    if (entry) {
      const balanced = Number(entry.total_debit) === Number(entry.total_credit)
      if (balanced && Number(entry.total_debit) > 0) {
        ok('gl-sale', `${entry.number} Dr=${entry.total_debit} Cr=${entry.total_credit} status=${entry.status}`)
      } else {
        fail('gl-sale', `unbalanced or empty ${JSON.stringify(entry)}`)
      }
    } else {
      // fallback list recent
      const all = await must('GET', '/gl-journals?per_page=30', { token, companyId })
      const found = (all.data ?? []).find((j) => j.source_type === 'sale' && Number(j.source_id) === Number(sale.id))
      if (found) ok('gl-sale', `${found.number} Dr=${found.total_debit}`)
      else fail('gl-sale', 'journal not found')
    }
  }

  // QRIS exact pay
  const qrisUuid = uuid()
  const qrisSale = await must('POST', '/sales', {
    token,
    companyId,
    body: {
      client_uuid: qrisUuid,
      channel: 'pos',
      skip_auto_promotion: true,
      items: [{ product_id: product.id, qty: 1 }],
      payments: [{ method: 'qris', amount: Number(product.sell_price), client_uuid: `${qrisUuid}-p0` }],
    },
  })
  ok('sale-qris', `${qrisSale.data.number} total=${qrisSale.data.total}`)

  // Credit / unpaid (if allowed)
  let unpaidId = null
  if (settings.allow_credit !== false) {
    const creditUuid = uuid()
    const { res, json } = await req('POST', '/sales', {
      token,
      companyId,
      body: {
        client_uuid: creditUuid,
        channel: 'pos',
        skip_auto_promotion: true,
        items: [{ product_id: product.id, qty: 1 }],
        payments: [],
      },
    })
    if (res.ok) {
      unpaidId = json.data.id
      ok('sale-credit', `${json.data.number} status=${json.data.status}`)
      const payUuid = uuid()
      const paid = await must('POST', `/sales/${unpaidId}/payments`, {
        token,
        companyId,
        body: {
          method: 'transfer',
          amount: json.data.total,
          client_uuid: payUuid,
        },
      })
      ok('add-payment', `status=${paid.data.status} paid=${paid.data.paid_amount}`)
    } else {
      fail('sale-credit', `${res.status} ${JSON.stringify(json?.errors || json?.message)}`)
    }
  } else {
    ok('sale-credit', 'skipped allow_credit=false')
  }

  // Settlement
  const settlement = await must('GET', '/sales/settlement', { token, companyId })
  const s = settlement.data
  ok(
    'settlement',
    `count=${s.sales_count} revenue=${s.revenue} cash_net=${s.cash_net} change=${s.change}`,
  )

  // Cancel cash sale + GL void
  const cancelled = await must('POST', `/sales/${sale.id}/cancel`, { token, companyId })
  if (cancelled.data?.status === 'cancelled') ok('cancel-sale', cancelled.data.number)
  else fail('cancel-sale', JSON.stringify(cancelled.data))

  {
    const all = await must('GET', '/gl-journals?per_page=50', { token, companyId })
    const voided = (all.data ?? []).find(
      (j) => j.source_type === 'sale_void' && Number(j.source_id) === Number(sale.id),
    )
    if (voided) ok('gl-sale-void', `${voided.number} status=${voided.status}`)
    else fail('gl-sale-void', 'void journal missing')
  }

  // Double cancel idempotent
  const cancel2 = await must('POST', `/sales/${sale.id}/cancel`, { token, companyId })
  if (cancel2.data?.status === 'cancelled') ok('cancel-idempotent', 'still cancelled')
  else fail('cancel-idempotent', JSON.stringify(cancel2.data))

  // Overpay addPayment on paid sale should fail
  {
    const paidSaleId = qrisSale.data.id
    const { res, json } = await req('POST', `/sales/${paidSaleId}/payments`, {
      token,
      companyId,
      body: { method: 'cash', amount: 1000, client_uuid: uuid() },
    })
    if (res.status === 422) ok('add-payment-already-paid', '422 as expected')
    else fail('add-payment-already-paid', `status=${res.status} ${JSON.stringify(json?.message || json?.errors)}`)
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n--- summary ---')
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
