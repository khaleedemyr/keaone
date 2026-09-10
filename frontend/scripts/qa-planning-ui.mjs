/**
 * Focused UI smoke: planning & contracts menus.
 * Usage: node scripts/qa-planning-ui.mjs
 */
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
  { id: 'gr', nav: 'Penerimaan barang', title: 'Penerimaan barang' },
]

fs.mkdirSync(OUT, { recursive: true })

async function openProcurement(page) {
  for (const loc of [
    page.getByRole('button', { name: /^Pengadaan$/ }),
    page.getByRole('link', { name: /^Pengadaan$/ }),
  ]) {
    if (await loc.first().isVisible().catch(() => false)) {
      await loc.first().click()
      await page.waitForTimeout(700)
      return
    }
  }
  const search = page.getByPlaceholder(/Cari menu/i)
  if (await search.isVisible().catch(() => false)) {
    await search.fill('Dasbor pengadaan')
    await page.getByText('Dasbor pengadaan').first().click()
    await page.waitForTimeout(700)
    return
  }
  throw new Error('Pengadaan tidak ketemu')
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'id-ID' })
  const results = []
  page.__err = []
  page.on('pageerror', (e) => page.__err.push(String(e)))
  page.on('response', (res) => {
    if (res.status() < 500) return
    const url = res.url()
    if (!url.includes('/api/')) return
    if (/notifications\/stream|\/chat\//i.test(url)) return
    page.__err.push(`${res.status()} ${url}`)
  })

  try {
    await page.addInitScript(() => localStorage.setItem('kea_ui_skin', 'erp'))
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.locator('input[autocomplete="username"]').fill(EMAIL)
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /Masuk|Sign in/i }).click()
    await page.waitForURL(/\/app/, { timeout: 45000 })
    await page.waitForTimeout(800)
    await openProcurement(page)
    results.push({ id: 'open', ok: true, detail: 'opened' })
    console.log('OK open')

    for (const s of SECTIONS) {
      const before = page.__err.length
      try {
        const btn = page.locator('aside button, nav button', { hasText: s.nav }).first()
        await btn.scrollIntoViewIfNeeded()
        await btn.click({ timeout: 8000 })
        await page.waitForTimeout(900)
        await page.waitForSelector(`text=${s.title}`, { timeout: 10000 })
        let extra = ''
        if (s.id === 'dashboard') {
          const reorder = await page.getByText(/auto-reorder|stok rendah|reorder/i).count()
          const demand = await page.getByText(/demand|forecast|perkiraan/i).count()
          extra = `reorderHints=${reorder} demandHints=${demand}`
        }
        if (s.id === 'contracts' || s.id === 'plans' || s.id === 'gr') {
          const createBtn = page.getByRole('button', { name: /Tambah|Buat|Baru/i }).first()
          if (await createBtn.isVisible().catch(() => false)) {
            await createBtn.click()
            await page.waitForTimeout(600)
            if (s.id === 'gr') {
              const lc = await page.getByText(/landed|ongkos angkut|freight|bea cukai|asuransi/i).count()
              extra = `landedHints=${lc}`
            } else {
              extra = 'create-opened'
            }
            await page.keyboard.press('Escape')
            await page.waitForTimeout(300)
          }
        }
        await page.screenshot({ path: path.join(OUT, `plan-${s.id}.png`), fullPage: true })
        const errs = page.__err.slice(before)
        const ok = errs.length === 0
        results.push({ id: s.id, ok, detail: ok ? `loaded ${extra}` : errs.join(' | ') })
        console.log(`${ok ? 'OK' : 'FAIL'} ${s.id}: ${results.at(-1).detail}`)
      } catch (e) {
        await page.screenshot({ path: path.join(OUT, `plan-${s.id}-fail.png`), fullPage: true }).catch(() => {})
        results.push({ id: s.id, ok: false, detail: String(e) })
        console.log(`FAIL ${s.id}: ${e}`)
      }
    }
  } finally {
    await browser.close()
  }

  fs.writeFileSync(path.join(OUT, 'plan-ui-report.json'), JSON.stringify(results, null, 2))
  const failed = results.filter((r) => !r.ok)
  console.log(`\npass=${results.length - failed.length} fail=${failed.length}`)
  if (failed.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
