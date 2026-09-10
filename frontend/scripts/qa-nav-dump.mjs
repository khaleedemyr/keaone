import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = 'storage-qa-ui'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => localStorage.setItem('kea_ui_skin', 'erp'))
await page.goto('http://localhost:5174/login', { waitUntil: 'domcontentloaded' })
await page.locator('input[autocomplete="username"]').fill('owner@demo.test')
await page.locator('input[autocomplete="current-password"]').fill('password')
await page.getByRole('button', { name: /Masuk|Sign in/i }).click()
await page.waitForURL(/\/app/, { timeout: 45000 })
await page.waitForTimeout(1500)
const peng = page.getByRole('button', { name: /^Pengadaan$/ }).first()
if (await peng.isVisible()) await peng.click()
await page.waitForTimeout(1200)
const texts = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('nav button, aside button, .erp-subnav button, .os-app-nav-item, [class*="subnav"] button')]
  return nodes.map((n) => (n.textContent || '').trim().replace(/\s+/g, ' ')).filter((t) => t && t.length < 80)
})
console.log('--- NAV ---')
console.log([...new Set(texts)].join('\n'))
await page.screenshot({ path: `${OUT}/nav-debug.png`, fullPage: true })
await browser.close()
