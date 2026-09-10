import { chromium } from 'playwright'
import fs from 'node:fs'

fs.mkdirSync('storage-qa-ui', { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => localStorage.setItem('kea_ui_skin', 'erp'))
await page.goto('http://localhost:5174/login', { waitUntil: 'domcontentloaded' })
await page.locator('input[autocomplete="username"]').fill('owner@demo.test')
await page.locator('input[autocomplete="current-password"]').fill('password')
await page.getByRole('button', { name: /Masuk|Sign in/i }).click()
await page.waitForURL(/\/app/, { timeout: 45000 })
await page.waitForTimeout(1000)
await page.getByRole('button', { name: /^Pengadaan$/ }).first().click()
await page.waitForTimeout(800)
await page.locator('aside button', { hasText: 'Permintaan pembelian' }).first().click()
await page.waitForTimeout(1000)

// mimic tryOpenCreate
const create = page.getByRole('button', {
  name: /Dokumen baru|Retur baru|Nota koreksi baru|Buat tagihan|Buat batch|Buat uang muka|RFQ baru|Buat RFQ|Tambah/i,
}).first()
console.log('create visible', await create.isVisible().catch(() => false))
console.log('create text', await create.textContent().catch(() => null))
if (await create.isVisible().catch(() => false)) {
  await create.click()
  await page.waitForTimeout(800)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
}

const texts = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('aside button, nav button')]
  return nodes.map((n) => (n.textContent || '').trim().replace(/\s+/g, ' ')).filter(Boolean)
})
console.log('--- AFTER PR CREATE ATTEMPT ---')
console.log([...new Set(texts)].join('\n'))
console.log('url', page.url())
await page.screenshot({ path: 'storage-qa-ui/after-pr-create.png', fullPage: true })
await browser.close()
