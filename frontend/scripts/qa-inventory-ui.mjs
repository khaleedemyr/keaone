/**
 * Smoke + input QA for Persediaan (inventory) menus.
 * Usage: node scripts/qa-inventory-ui.mjs
 * Env: QA_UI_BASE, QA_EMAIL, QA_PASSWORD
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_UI_BASE || 'http://localhost:5173'
const EMAIL = process.env.QA_EMAIL || 'owner@demo.test'
const PASSWORD = process.env.QA_PASSWORD || 'password'
const OUT = path.resolve(__dirname, '../storage-qa-inventory')

const SECTIONS = [
  { id: 'stock', nav: 'Stok', title: 'Stok gudang', create: false },
  { id: 'stockcard', nav: 'Kartu stok', title: /Kartu stok/i, create: false },
  { id: 'stocktransfers', nav: 'Transfer stok', title: 'Transfer stok', create: true, fill: 'transfer' },
  { id: 'stockopnames', nav: 'Stock opname', title: 'Stock opname', create: true, fill: 'opname' },
  { id: 'stockadjustments', nav: 'Adjustment stok', title: /Adjustment/i, create: true, fill: 'adjustment' },
  { id: 'stockwaste', nav: 'Waste & spoilage', title: /Waste/i, create: true, fill: 'waste' },
  { id: 'stockproduction', nav: 'Prep / produksi', title: /Prep|produksi/i, create: true, fill: 'production' },
  { id: 'stockvaluation', nav: 'Valuasi & mutasi', title: /Valuasi/i, create: false },
  { id: 'warehouses', nav: 'Gudang', title: /Gudang/i, create: true, fill: 'warehouse' },
  { id: 'stocksettings', nav: 'Pengaturan persediaan', title: /Pengaturan/i, create: false },
]

function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true })
}

async function login(page) {
  await page.addInitScript(() => {
    localStorage.setItem('kea_ui_skin', 'erp')
  })
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 20000 })
  await page.locator('input[autocomplete="username"]').fill(EMAIL)
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /Masuk|Sign in/i }).click()
  await page.waitForURL(/\/app/, { timeout: 45000 })
  await page.waitForTimeout(1000)
}

async function openInventory(page) {
  const candidates = [
    page.getByRole('button', { name: /^Persediaan$/ }),
    page.getByRole('link', { name: /^Persediaan$/ }),
    page.locator('button', { hasText: /^Persediaan$/ }),
  ]
  for (const loc of candidates) {
    const el = loc.first()
    if (await el.isVisible().catch(() => false)) {
      await el.click()
      await page.waitForTimeout(800)
      return
    }
  }
  const search = page.getByPlaceholder(/Cari menu/i)
  if (await search.isVisible().catch(() => false)) {
    await search.fill('Transfer stok')
    await page.waitForTimeout(400)
    await page.getByText('Transfer stok').first().click()
    await page.waitForTimeout(700)
    return
  }
  throw new Error('Tidak menemukan entry Persediaan di UI')
}

async function clickNav(page, label) {
  const candidates = [
    page.locator('aside button', { hasText: label }),
    page.locator('nav button', { hasText: label }),
    page.getByRole('button', { name: label, exact: true }),
    page.getByText(label, { exact: true }),
  ]
  for (const loc of candidates) {
    const el = loc.first()
    if (!(await el.count().catch(() => 0))) continue
    try {
      await el.scrollIntoViewIfNeeded()
      await el.click({ timeout: 5000 })
      await page.waitForTimeout(600)
      return
    } catch {
      /* next */
    }
  }
  throw new Error(`Nav tidak ketemu: ${label}`)
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function waitIdle(page) {
  await page.locator('.kea-load-scrim').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
  await page.getByText('Memproses').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(350)
}

async function closeOverlays(page) {
  const modalRoot = page.locator('.fixed.inset-0.z-\\[80\\], .fixed.inset-0[class*="z-[80]"], .fixed.inset-0.z-80').first()
  if (!(await modalRoot.isVisible().catch(() => false))) {
    await page.keyboard.press('Escape').catch(() => {})
    return
  }
  const close = modalRoot
    .locator('button.os-dot-close, button.btn-ghost:has-text("Tutup"), button:has-text("Batal")')
    .first()
  if (await close.isVisible().catch(() => false)) {
    await close.click().catch(() => {})
    await page.waitForTimeout(250)
  } else {
    await page.keyboard.press('Escape').catch(() => {})
  }
}

async function assertTitle(page, title) {
  const h1 = typeof title === 'string'
    ? page.locator('h1').filter({ hasText: title }).first()
    : page.locator('h1').filter({ hasText: title }).first()
  await h1.waitFor({ state: 'visible', timeout: 15000 })
}

async function openCreateModal(page) {
  await waitIdle(page)
  await closeOverlays(page)
  const btn = page
    .locator('button.btn-primary')
    .filter({ hasText: /Dokumen baru|Tambah|Baru|Gudang baru|Buat/i })
    .first()
  if (!(await btn.isVisible().catch(() => false))) return null
  await btn.click()
  await waitIdle(page)
  const modal = page.locator('form').filter({ has: page.locator('button[type="submit"]') }).last()
  if (!(await modal.isVisible().catch(() => false))) return null
  await page.waitForTimeout(700)
  return modal
}

async function submitForm(page, form) {
  const save = form.locator('button[type="submit"]').filter({ hasText: /Simpan|Save/i }).first()
  if (!(await save.isVisible().catch(() => false))) return 'no-save-btn'
  // Capture a stable handle before click — after close, lazy "form" locators may rematch page filters.
  const modalHandle = await form.elementHandle()
  await save.click()
  await waitIdle(page)
  await page.waitForTimeout(600)
  if (modalHandle) {
    const visible = await modalHandle.isVisible().catch(() => false)
    if (!visible) return 'saved'
  } else if (!(await form.isVisible().catch(() => false))) {
    return 'saved'
  }
  const toastSaved = await page.getByText(/Tersimpan|Saved successfully|berhasil disimpan/i).first().isVisible().catch(() => false)
  if (toastSaved) return 'saved'
  const err =
    (await page.locator('form button[type="submit"]').locator('xpath=ancestor::form[1]').locator('.text-rose-600, .text-danger, [role="alert"]').first().textContent().catch(() => '')) ||
    ''
  if (err?.trim()) return `save-error:${err.trim()}`
  // If submit button gone, treat as saved
  if (!(await save.isVisible().catch(() => false))) return 'saved'
  return 'save-modal-still-open'
}

async function exerciseCreate(page, section) {
  const form = await openCreateModal(page)
  if (!form) return { ok: false, detail: 'no-create-modal' }
  let detail = 'modal-open'
  try {
    if (section.fill === 'transfer') detail = await fillTransfer(page, form)
    else if (section.fill === 'opname') detail = await fillOpname(page, form)
    else if (section.fill === 'adjustment') detail = await fillAdjustment(page, form, false)
    else if (section.fill === 'waste') detail = await fillAdjustment(page, form, true)
    else if (section.fill === 'production') detail = await fillProduction(page, form)
    else if (section.fill === 'warehouse') detail = await fillWarehouse(page, form)

    if (['transfer', 'opname', 'production'].includes(section.fill) && !/missing|fill-error|no-bom/i.test(detail)) {
      const saved = await submitForm(page, form)
      detail = `${detail}, ${saved}`
    }
  } catch (e) {
    detail = `fill-error: ${e}`
  }
  await shot(page, `fill-${section.id}`)
  await closeOverlays(page)

  if (section.fill === 'transfer' && /,\s*saved\b/.test(detail)) {
    const ship = page.locator('table button, tbody button').filter({ hasText: /^Kirim$/i }).first()
    if (await ship.isVisible().catch(() => false)) {
      await ship.click()
      await waitIdle(page)
      const voidBtn = page.locator('table button, tbody button').filter({ hasText: /^Void$/i }).first()
      if (await voidBtn.isVisible().catch(() => false)) {
        page.once('dialog', (d) => d.accept().catch(() => {}))
        await voidBtn.click()
        await waitIdle(page)
        detail = `${detail}, ship+void-ui`
      } else {
        detail = `${detail}, shipped-ui`
      }
    }
  }

  const bad =
    /(?:^|,\s)(?:from|to|wh|product|counted)-missing\b|fill-error:|same-wh-no-error|no-create-modal|no-name\b|save-error:|save-modal-still-open/i.test(
      detail,
    )
  return { ok: !bad, detail }
}

async function pickSearchSelect(page, form, labelRe, optionIndex = 0) {
  const label = form.locator('label').filter({ hasText: labelRe }).first()
  const trigger = (await label.count())
    ? label.locator('button.field').first()
    : form.locator('button.field').nth(optionIndex)
  if (!(await trigger.isVisible().catch(() => false))) return null
  await trigger.click()
  await page.waitForTimeout(250)
  const menu = page.locator('[data-search-select-menu]').last()
  if (!(await menu.isVisible().catch(() => false))) return null
  const option = menu.locator('button').nth(optionIndex)
  if (!(await option.isVisible().catch(() => false))) {
    await page.keyboard.press('Escape').catch(() => {})
    return null
  }
  const text = ((await option.textContent()) || '').trim()
  await option.click()
  await page.waitForTimeout(200)
  return text.replace(/^\★\s*/, '')
}

async function scanOrPickProduct(page, form, skuHint = 'MIN-001') {
  const scan = form.locator('input[placeholder*="barcode" i], input[placeholder*="SKU" i]').first()
  if (await scan.isVisible().catch(() => false)) {
    await scan.fill(skuHint)
    await scan.press('Enter')
    await page.waitForTimeout(600)
    return `scanned=${skuHint}`
  }
  // Fallback: last SearchSelect in the item row grid
  const triggers = form.locator('.rounded-2xl.border button.field, .grid button.field')
  const count = await triggers.count()
  const trigger = count > 0 ? triggers.last() : form.locator('button.field').last()
  if (!(await trigger.isVisible().catch(() => false))) return null
  await trigger.click()
  await page.waitForTimeout(250)
  const menu = page.locator('[data-search-select-menu]').last()
  const option = menu.locator('button').first()
  if (!(await option.isVisible().catch(() => false))) {
    await page.keyboard.press('Escape').catch(() => {})
    return null
  }
  const text = ((await option.textContent()) || '').trim().replace(/^\★\s*/, '')
  await option.click()
  await page.waitForTimeout(500)
  return text ? `product=${text}` : null
}

async function selectNativeOption(select, skipSameAs) {
  if (!(await select.isEnabled().catch(() => false))) return null
  const options = await select.locator('option').all()
  for (const opt of options) {
    const value = await opt.getAttribute('value')
    if (!value || value === '0' || value === '') continue
    if (skipSameAs && value === skipSameAs) continue
    await select.selectOption(value)
    return value
  }
  return null
}

async function fillTransfer(page, form) {
  const notes = []
  const fromLabel = await pickSearchSelect(page, form, /Dari gudang|From/i, 0)
  notes.push(fromLabel ? `from=${fromLabel}` : 'from-missing')

  // Same warehouse attempt: pick same label on "to" if possible
  const toTrigger = form.locator('label').filter({ hasText: /Ke gudang|To/i }).locator('button.field').first()
  if (fromLabel && (await toTrigger.isVisible().catch(() => false))) {
    await toTrigger.click()
    await page.waitForTimeout(200)
    const menu = page.locator('[data-search-select-menu]').last()
    const same = menu.locator('button', { hasText: fromLabel }).first()
    if (await same.isVisible().catch(() => false)) {
      await same.click()
      notes.push('same-wh-selected')
      const save = form.locator('button.btn-primary, button[type="submit"]').first()
      await save.click()
      await page.waitForTimeout(500)
      const errVisible = await page.getByText(/berbeda|same warehouse|gudang sumber|tujuan/i).first().isVisible().catch(() => false)
      notes.push(errVisible ? 'same-wh-rejected' : 'same-wh-no-error')
    } else {
      await page.keyboard.press('Escape').catch(() => {})
      notes.push('same-wh-option-hidden')
    }
  }

  const toLabel = await pickSearchSelect(page, form, /Ke gudang|To/i, 0)
  notes.push(toLabel ? `to=${toLabel}` : 'to-missing')

  // Prefer barcode scan (sets product_id reliably); SearchSelect as fallback
  const product = await scanOrPickProduct(page, form, 'MIN-001')
  notes.push(product || 'product-missing')

  const qty = form.locator('input[type="number"]').first()
  if (await qty.isVisible().catch(() => false)) {
    await qty.fill('2')
    notes.push('qty=2')
  }
  return notes.join(', ')
}

async function fillOpname(page, form) {
  const notes = []
  const wh = await pickSearchSelect(page, form, /Gudang|Warehouse/i, 0)
  notes.push(wh ? `wh=${wh}` : 'wh-missing')

  const product = await scanOrPickProduct(page, form, 'MIN-001')
  notes.push(product || 'product-missing')
  await page.waitForTimeout(500)

  const counted = form.locator('input[data-col="counted"], input[type="number"]:not([readonly])').first()
  if (await counted.isVisible().catch(() => false)) {
    await counted.fill('3')
    notes.push('counted=3')
  } else {
    notes.push('counted-missing')
  }
  const unit = form.locator('select.field').first()
  if (await unit.isEnabled().catch(() => false)) notes.push('unit-enabled')
  else notes.push('unit-still-disabled')
  return notes.join(', ')
}

async function fillAdjustment(page, form, waste) {
  const notes = []
  const wh = await pickSearchSelect(page, form, /Gudang|Warehouse/i, 0)
  notes.push(wh ? `wh=${wh}` : 'wh-missing')

  const reason = form.locator('select.field, select').first()
  if (await reason.isVisible().catch(() => false)) {
    const options = await reason.locator('option').all()
    for (const opt of options) {
      const value = await opt.getAttribute('value')
      if (!value) continue
      if (waste && /expired|overcook|damage|write_off|complimentary/i.test(value)) {
        await reason.selectOption(value)
        notes.push(`reason=${value}`)
        break
      }
      if (!waste && value) {
        await reason.selectOption(value)
        notes.push(`reason=${value}`)
        break
      }
    }
  }

  const product = await scanOrPickProduct(page, form, 'MIN-001')
  notes.push(product || 'product-missing')

  const qty = form.locator('input[type="number"]').first()
  if (await qty.isVisible().catch(() => false)) {
    await qty.fill(waste ? '5' : '-2')
    notes.push(waste ? 'qty-ui=+5(abs-display-ok)' : 'qty=-2')
  }
  return notes.join(', ')
}

async function fillProduction(page, form) {
  const notes = []
  const wh = await pickSearchSelect(page, form, /Gudang|Warehouse/i, 0)
  notes.push(wh ? `wh=${wh}` : 'wh-missing')

  const productTrigger = form.locator('button.field').nth(1)
  if (await productTrigger.isVisible().catch(() => false)) {
    await productTrigger.click()
    await page.waitForTimeout(300)
    const menu = page.locator('[data-search-select-menu]').last()
    const search = menu.locator('input').first()
    if (await search.isVisible().catch(() => false)) {
      await search.fill('Paket QA')
      await page.waitForTimeout(250)
    }
    const empty = await menu.getByText(/Tidak ada|No results|kosong/i).first().isVisible().catch(() => false)
    const option = menu.locator('button').filter({ hasText: /Paket QA|PKT-QA/i }).first()
    const any = menu.locator('button').first()
    if (empty || (!(await option.isVisible().catch(() => false)) && !(await any.isVisible().catch(() => false)))) {
      notes.push('no-bom-products')
      await page.keyboard.press('Escape').catch(() => {})
    } else {
      const pick = (await option.isVisible().catch(() => false)) ? option : any
      const text = ((await pick.textContent()) || '').trim().replace(/^\★\s*/, '')
      await pick.click()
      notes.push(`product=${text}`)
    }
  } else {
    notes.push('product-missing')
  }

  const qty = form.locator('input[type="number"]').first()
  if (await qty.isVisible().catch(() => false)) {
    await qty.fill('1')
    notes.push('qty=1')
  }
  return notes.join(', ')
}

async function fillWarehouse(page, form) {
  const name = form.locator('input').first()
  if (await name.isVisible().catch(() => false)) {
    await name.fill(`QA Gudang ${Date.now().toString().slice(-4)}`)
    return 'name-filled'
  }
  return 'no-name'
}

async function checkStockTableAlignment(page) {
  await waitIdle(page)
  const wh = page.locator('label').filter({ hasText: /Gudang|Warehouse/i }).locator('select').first()
  await page.waitForFunction(
    () => {
      const sel = document.querySelector('main select.field, label select.field, label select')
      return Boolean(sel && sel.options && sel.options.length > 0 && String(sel.value || ''))
    },
    null,
    { timeout: 15000 },
  ).catch(() => {})
  if (await wh.isVisible().catch(() => false)) {
    const val = await wh.inputValue().catch(() => '')
    if (!val) {
      await selectNativeOption(wh)
    }
  }
  // Wait for stock API after warehouse is known
  await Promise.race([
    page.waitForResponse((res) => /\/api\/v1\/stock(\?|$)/.test(res.url()) && res.ok(), { timeout: 20000 }),
    page.waitForTimeout(2000),
  ]).catch(() => {})
  await waitIdle(page)
  await page.waitForTimeout(400)

  const headers = await page.locator('table thead th').count()
  const empty = await page.getByText(/Tidak ada data stok|No stock data/i).first().isVisible().catch(() => false)
  if (empty) return `empty-state headers=${headers}`
  const cells = await page.locator('table tbody tr').first().locator('td').count().catch(() => 0)
  if (headers === 0) return 'no-table'
  if (cells === 0) return `headers=${headers} empty-body`
  if (headers !== cells) return `mismatch headers=${headers} cells=${cells}`
  const rightHeaders = await page.locator('table thead th.text-right').count()
  return `ok headers=${headers} cells=${cells} right=${rightHeaders}`
}

async function main() {
  ensureOut()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID' })
  const page = await context.newPage()
  page.__qaErrors = []
  page.__qaApiFails = []
  page.on('pageerror', (err) => page.__qaErrors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (/Failed to load resource|net::ERR_|favicon/i.test(text)) return
    page.__qaErrors.push(`console: ${text}`)
  })
  page.on('response', (res) => {
    if (res.status() < 500) return
    const url = res.url()
    if (!url.includes('/api/')) return
    if (/\/notifications\/stream|\/chat\//i.test(url)) return
    page.__qaApiFails.push(`${res.status()} ${url}`)
  })

  const results = []
  try {
    await login(page)
    await shot(page, '00-home')
    results.push({ id: 'login', label: 'Login', ok: true, detail: page.url() })
    console.log('OK login')

    await openInventory(page)
    await shot(page, '01-inventory')
    results.push({ id: 'open-app', label: 'Buka Persediaan', ok: true, detail: 'opened' })
    console.log('OK open inventory')

    for (const section of SECTIONS) {
      const beforeErr = page.__qaErrors.length
      const beforeApi = page.__qaApiFails.length
      try {
        await clickNav(page, section.nav)
        await waitIdle(page)
        await assertTitle(page, section.title)
        let extra = ''
        let fillOk = true
        if (section.id === 'stock') {
          extra = await checkStockTableAlignment(page)
        }
        if (section.create) {
          const filled = await exerciseCreate(page, section)
          fillOk = filled.ok
          extra = (extra ? `${extra} | ` : '') + filled.detail
        }
        await closeOverlays(page)
        const errs = page.__qaErrors.slice(beforeErr)
        const apiFails = page.__qaApiFails.slice(beforeApi)
        const file = await shot(page, `section-${section.id}`)
        const ok = errs.length === 0 && apiFails.length === 0 && fillOk
        const detail = ok
          ? `loaded${extra ? ` (${extra})` : ''}`
          : [...errs, ...apiFails, extra].filter(Boolean).join(' | ')
        results.push({ id: section.id, label: section.nav, ok, detail, screenshot: file })
        console.log(`${ok ? 'OK' : 'FAIL'} ${section.id}: ${detail}`)
      } catch (e) {
        const file = await shot(page, `section-${section.id}-fail`)
        results.push({ id: section.id, label: section.nav, ok: false, detail: String(e), screenshot: file })
        console.log(`FAIL ${section.id}: ${e}`)
      }
    }
  } catch (e) {
    await shot(page, 'fatal').catch(() => {})
    results.push({ id: 'fatal', label: 'Fatal', ok: false, detail: String(e) })
    console.error(e)
  } finally {
    await browser.close()
  }

  const report = path.join(OUT, 'report.json')
  fs.writeFileSync(report, JSON.stringify(results, null, 2))
  console.log('\n=== SUMMARY ===')
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label} — ${r.detail}`)
  console.log(`\nReport: ${report}`)
  if (results.some((r) => !r.ok)) process.exit(1)
}

main()
