import { chromium } from 'playwright'

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
await page.locator('aside button', { hasText: 'Dasbor pengadaan' }).first().click()
await page.waitForTimeout(800)

const dump = async (label) => {
  const texts = await page.evaluate(() =>
    [...document.querySelectorAll('aside button')].map((n) => ({
      text: (n.textContent || '').trim().replace(/\s+/g, ' '),
      visible: !!(n.offsetWidth || n.offsetHeight),
    })),
  )
  console.log('===', label)
  for (const t of texts) console.log(`${t.visible ? 'V' : 'H'} ${t.text}`)
}

await dump('after dashboard')

// expand Operasional if collapsed
const ops = page.locator('aside button', { hasText: /Operasional/ }).first()
if (await ops.isVisible()) {
  console.log('click Operasional header')
  await ops.click()
  await page.waitForTimeout(400)
}
await dump('after ops click')

const pr = page.locator('aside button', { hasText: 'Permintaan pembelian' }).first()
console.log('pr count', await pr.count(), 'visible', await pr.isVisible().catch(() => false))
try {
  await pr.click({ timeout: 3000 })
  console.log('pr click ok')
} catch (e) {
  console.log('pr click fail', e.message)
}

await browser.close()
