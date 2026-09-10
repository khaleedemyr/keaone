import { chromium } from 'playwright'

const BASE = process.env.QA_UI_BASE || 'http://localhost:5173'
const errors = []
const fails = []

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console:${m.text()}`)
})
page.on('response', (res) => {
  if (res.status() >= 500) fails.push(`${res.status()} ${res.url()}`)
})

await page.addInitScript(() => localStorage.setItem('kea_ui_skin', 'erp'))
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.locator('input[autocomplete="username"]').fill('owner@demo.test')
await page.locator('input[autocomplete="current-password"]').fill('password')
await page.getByRole('button', { name: /Masuk|Sign in/i }).click()
await page.waitForURL(/\/app/, { timeout: 45000 })
await page.waitForTimeout(1200)

const inv = page.getByRole('button', { name: /^Persediaan$/ }).first()
if (await inv.isVisible().catch(() => false)) {
  await inv.click()
} else {
  await page.getByPlaceholder(/Cari menu/i).fill('Prep')
  await page.getByText(/Prep|produksi/i).first().click()
}
await page.waitForTimeout(800)
await page.locator('aside button, nav button').filter({ hasText: /Prep|produksi/i }).first().click()
await page.waitForTimeout(1500)

const edit = page.locator('button').filter({ hasText: /^Ubah$/i }).first()
await edit.waitFor({ state: 'visible', timeout: 20000 })
await edit.click()
await page.waitForTimeout(2500)

const crash = await page.getByText(/Something went wrong|Close this window/i).first().isVisible().catch(() => false)
const modal = await page.locator('form button[type="submit"]').first().isVisible().catch(() => false)
const bomEmpty = await page.getByText(/Pilih produk ber-BOM/i).first().isVisible().catch(() => false)
const hasComponent = await page.getByText(/Air Mineral|QA Demand/i).first().isVisible().catch(() => false)
console.log(JSON.stringify({ crash, modal, bomEmpty, hasComponent, fails, errors }, null, 2))
await page.screenshot({ path: 'storage-qa-inventory/edit-production-fixed.png', fullPage: true })
await browser.close()
if (crash || bomEmpty || !hasComponent) process.exit(1)
