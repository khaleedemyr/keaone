import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/marketing')
const base = process.env.MKT_BASE || 'http://localhost:5173'
const email = process.env.MKT_EMAIL || 'owner@demo.test'
const password = process.env.MKT_PASSWORD || 'password'

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

async function dismissOverlay() {
  await page.waitForFunction(() => !document.body.innerText.includes('Memproses'), { timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(600)
}

try {
  await page.goto(`${base}/login?demo=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.fill('input[autocomplete="username"]', email)
  await page.fill('input[autocomplete="current-password"]', password)
  await Promise.all([
    page.waitForURL(/\/app/, { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ])
  await page.waitForSelector('.os-desktop', { timeout: 60000 })
  await dismissOverlay()
  await page.screenshot({ path: path.join(outDir, 'desktop.png'), type: 'png' })

  // Open Kasir / POS via desktop icon label
  const kasir = page.locator('.os-desktop').getByText(/Kasir|POS|Cashier/i).first()
  await kasir.click({ force: true })
  await dismissOverlay()
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, 'pos.png'), type: 'png' })

  console.log('Wrote screenshots to', outDir)
} finally {
  await browser.close()
}
