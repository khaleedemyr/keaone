import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_UI_BASE || 'http://localhost:5174'
const EMAIL = process.env.QA_EMAIL || 'owner@demo.test'
const PASSWORD = process.env.QA_PASSWORD || 'password'
const OUT = path.resolve(__dirname, '../storage-qa-ui')

const SECTIONS = [
  { id: 'dashboard', nav: 'Dasbor pengadaan', title: 'Dasbor pengadaan' },
  { id: 'contracts', nav: 'Kontrak procurement', title: 'Kontrak procurement' },
  { id: 'plans', nav: 'Rencana procurement', title: 'Rencana procurement' },
  { id: 'pr', nav: 'Permintaan pembelian', title: 'Permintaan pembelian' },
  { id: 'po', nav: 'Pesanan pembelian', title: 'Pesanan pembelian' },
  { id: 'gr', nav: 'Penerimaan barang', title: 'Penerimaan barang' },
  { id: 'return', nav: 'Retur pembelian', title: 'Retur pembelian' },
  { id: 'adjustments', nav: 'Nota debit / kredit', title: 'Nota debit / kredit' },
  { id: 'invoices', nav: 'Tagihan supplier', title: 'Tagihan supplier' },
  { id: 'match', nav: 'Three-way match', title: 'Three-way match' },
  { id: 'payments', nav: 'Batch pembayaran', title: 'Batch pembayaran' },
  { id: 'prepayments', nav: 'Uang muka', title: 'Uang muka' },
  { id: 'rfqs', nav: 'RFQ / Penawaran', title: 'RFQ / Penawaran' },
  { id: 'withholding', nav: 'Potong PPh', title: 'Potong PPh' },
  { id: 'journals', nav: 'Jurnal GL', title: 'Jurnal GL' },
  { id: 'budgets', nav: 'Anggaran', title: 'Anggaran' },
  { id: 'assets', nav: 'Register aset tetap', title: 'Register aset tetap' },
  { id: 'matrix', nav: 'Matrix approval', title: 'Matrix approval' },
  { id: 'delegations', nav: 'Delegasi approval', title: 'Delegasi approval' },
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

async function openProcurement(page) {
  const candidates = [
    page.getByRole('button', { name: /^Pengadaan$/ }),
    page.getByRole('link', { name: /^Pengadaan$/ }),
    page.locator('button', { hasText: /^Pengadaan$/ }),
    page.locator('[class*="erp"]', { hasText: /^Pengadaan$/ }),
  ]
  for (const loc of candidates) {
    const el = loc.first()
    if (await el.isVisible().catch(() => false)) {
      await el.click()
      await page.waitForTimeout(700)
      return
    }
  }
  const search = page.getByPlaceholder(/Cari menu/i)
  if (await search.isVisible().catch(() => false)) {
    await search.fill('Dasbor pengadaan')
    await page.waitForTimeout(400)
    await page.getByText('Dasbor pengadaan').first().click()
    await page.waitForTimeout(700)
    return
  }
  throw new Error('Tidak menemukan entry Pengadaan di UI')
}

async function clickNav(page, label) {
  const candidates = [
    page.locator('aside button', { hasText: label }),
    page.locator('nav button', { hasText: label }),
    page.getByRole('button', { name: label, exact: true }),
  ]

  for (const loc of candidates) {
    const el = loc.first()
    if (!(await el.count().catch(() => 0))) continue
    try {
      await el.scrollIntoViewIfNeeded()
      await el.click({ timeout: 5000 })
      await page.waitForTimeout(500)
      return
    } catch {
      /* try next */
    }
  }

  throw new Error(`Nav tidak ketemu: ${label}`)
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function assertTitle(page, title) {
  const h1 = page.locator('h1').filter({ hasText: title }).first()
  await h1.waitFor({ state: 'visible', timeout: 15000 })
}

async function waitIdle(page) {
  await page.locator('.kea-load-scrim').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function closeOverlays(page) {
  // Close only portal modals (z-index overlay), never the main ERP window chrome
  const modalRoot = page.locator('.fixed.inset-0.z-\\[80\\], .fixed.inset-0[class*="z-[80]"], .fixed.inset-0.z-80').first()
  if (!(await modalRoot.isVisible().catch(() => false))) return
  const close = modalRoot.locator('button.os-dot-close, button.btn-ghost:has-text("Tutup")').first()
  if (await close.isVisible().catch(() => false)) {
    await close.click().catch(() => {})
    await page.waitForTimeout(250)
  }
}

async function tryOpenCreate(page) {
  await waitIdle(page)
  await closeOverlays(page)
  const create = page
    .getByRole('button', {
      name: /Dokumen baru|Retur baru|Nota koreksi baru|Buat tagihan|Buat batch|Buat uang muka|RFQ baru|Buat RFQ|Anggaran baru|Aturan baru|Delegasi baru|\+ RFQ|\+/i,
    })
    .filter({ hasNotText: /^$/ })
    .first()
  // Prefer explicit primary action in page header, avoid bare "+" in window chrome if ambiguous
  const headerCreate = page.locator('.btn-primary, button.btn-primary').filter({ hasText: /.+/ }).first()
  const target = (await headerCreate.isVisible().catch(() => false)) ? headerCreate : create
  if (!(await target.isVisible().catch(() => false))) return 'no-create-btn'
  await target.click()
  await waitIdle(page)
  const visible = await page
    .locator('form, [role="dialog"], .master-modal, .os-modal')
    .first()
    .isVisible()
    .catch(() => false)
  await closeOverlays(page)
  await page.waitForTimeout(300)
  return visible ? 'create-modal-ok' : 'create-clicked-no-modal'
}

async function tryOpenDetail(page) {
  await waitIdle(page)
  await closeOverlays(page)
  const detailBtn = page.getByRole('button', { name: /Detail|Lihat detail/i }).first()
  if (await detailBtn.isVisible().catch(() => false)) {
    await detailBtn.click()
    await waitIdle(page)
    await closeOverlays(page)
    return 'detail-btn-ok'
  }
  const numBtn = page.locator('table tbody button').first()
  if (await numBtn.isVisible().catch(() => false)) {
    await numBtn.click()
    await waitIdle(page)
    await closeOverlays(page)
    return 'row-number-click-ok'
  }
  return 'no-detail'
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
    const status = res.status()
    if (status < 500) return
    const url = res.url()
    if (!url.includes('/api/')) return
    // SSE/stream noise shouldn't fail the section smoke
    if (/\/notifications\/stream|\/chat\//i.test(url)) return
    page.__qaApiFails.push(`${status} ${url.replace(BASE, '')}`)
  })

  const results = []
  try {
    await login(page)
    await shot(page, '00-home')
    results.push({ id: 'login', label: 'Login', ok: true, detail: page.url() })

    await openProcurement(page)
    await shot(page, '01-procurement')
    results.push({ id: 'open-app', label: 'Buka Pengadaan', ok: true, detail: 'opened' })

    for (const section of SECTIONS) {
      const beforeErr = page.__qaErrors.length
      const beforeApi = page.__qaApiFails.length
      try {
        await clickNav(page, section.nav)
        await waitIdle(page)
        await assertTitle(page, section.title)
        let extra = ''
        if (['pr', 'po', 'gr', 'return', 'invoices', 'payments', 'prepayments', 'rfqs', 'adjustments', 'budgets', 'matrix', 'delegations'].includes(section.id)) {
          extra = await tryOpenCreate(page)
          if (['pr', 'po', 'gr', 'invoices', 'return', 'rfqs', 'assets', 'withholding', 'journals'].includes(section.id)) {
            extra += ' | ' + (await tryOpenDetail(page))
          }
        }
        await closeOverlays(page)
        const errs = page.__qaErrors.slice(beforeErr)
        const apiFails = page.__qaApiFails.slice(beforeApi)
        const file = await shot(page, `section-${section.id}`)
        const ok = errs.length === 0 && apiFails.length === 0
        const detail = ok
          ? `loaded${extra ? ` (${extra})` : ''}`
          : [...errs, ...apiFails].join(' | ')
        results.push({
          id: section.id,
          label: section.title,
          ok,
          detail,
          screenshot: file,
        })
        console.log(`${ok ? 'OK' : 'FAIL'} ${section.id}: ${results.at(-1).detail}`)
      } catch (e) {
        const file = await shot(page, `section-${section.id}-fail`)
        results.push({ id: section.id, label: section.title, ok: false, detail: String(e), screenshot: file })
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
