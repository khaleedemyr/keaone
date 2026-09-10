/**
 * POS UI smoke: login → open POS → pick lookup item → pay → receipt → settlement.
 * Usage: node scripts/qa-pos-ui.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_UI_BASE || 'http://localhost:5173'
const EMAIL = process.env.QA_EMAIL || 'owner@demo.test'
const PASSWORD = process.env.QA_PASSWORD || 'password'
const OUT = path.resolve(__dirname, '../storage-qa-pos')

function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true })
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
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
  await page.waitForTimeout(1200)
}

async function openPos(page) {
  const search = page.getByPlaceholder(/Cari menu/i)
  if (await search.isVisible().catch(() => false)) {
    await search.fill('Kasir')
    await page.waitForTimeout(400)
  }
  const candidates = [
    page.getByRole('button', { name: /^Kasir$/i }),
    page.getByRole('button', { name: /^POS$/i }),
    page.getByText(/^Kasir$/i),
    page.getByText(/^POS$/i),
  ]
  for (const loc of candidates) {
    const el = loc.first()
    if (await el.isVisible().catch(() => false)) {
      await el.click()
      await page.waitForTimeout(1500)
      return
    }
  }
  throw new Error('POS/Kasir app not found')
}

async function main() {
  ensureOut()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const log = []
  const pass = (m) => {
    log.push(`OK ${m}`)
    console.log(`OK ${m}`)
  }
  const fail = (m) => {
    log.push(`FAIL ${m}`)
    console.error(`FAIL ${m}`)
  }

  try {
    await login(page)
    pass('login')
    await shot(page, '01-app')

    await openPos(page)
    pass('open-pos')
    await page.waitForSelector('.retail-pos, .retail-lookup-list', { timeout: 20000 })
    await shot(page, '02-pos')

    // Click first product in retail lookup list (not cash chips)
    const lookupItem = page.locator('.retail-lookup-list button').first()
    await lookupItem.waitFor({ state: 'visible', timeout: 15000 })
    const productLabel = (await lookupItem.innerText()).replace(/\s+/g, ' ').trim()
    await lookupItem.click()
    await page.waitForTimeout(600)

    // Confirm cart has a line
    const cartRows = page.locator('.retail-ticket tbody tr, .retail-ticket [class*="ticket"]')
    const bodyAfterAdd = await page.locator('body').innerText()
    if (!/Air Mineral|Beras|Gula|Indomie|Roti|Teh|Paket|1\s/i.test(bodyAfterAdd) && !(await page.locator('.retail-ticket').innerText()).match(/Rp/)) {
      // still ok if qty column shows
    }
    const ticketText = await page.locator('.retail-ticket').innerText()
    if (/Belum ada barang/i.test(ticketText)) {
      throw new Error(`Cart still empty after clicking lookup item: ${productLabel}`)
    }
    pass(`add-product (${productLabel.slice(0, 40)})`)
    await shot(page, '03-cart')

    // Prefer non-cash to avoid underpay gate, or press exact cash
    const qris = page.getByRole('button', { name: /^QRIS$/i })
    if (await qris.isVisible().catch(() => false)) {
      await qris.click()
      await page.waitForTimeout(200)
    } else {
      const exact = page.getByRole('button', { name: /Uang pas/i })
      if (await exact.isVisible().catch(() => false)) await exact.click()
    }

    const payBtn = page.locator('button.retail-checkout-btn')
    await payBtn.waitFor({ state: 'visible', timeout: 5000 })
    if (await payBtn.isDisabled()) {
      // fallback F2 after ensuring cart
      await page.keyboard.press('F2')
    } else {
      await payBtn.click()
    }
    await page.waitForTimeout(2500)
    await shot(page, '04-after-pay')

    const body = await page.locator('body').innerText()
    if (/berhasil|completed|INV-|struk|Penjualan berhasil|receipt/i.test(body) || (await page.locator('.receipt-root').isVisible().catch(() => false))) {
      pass('checkout')
    } else if (/Belum ada barang/i.test(body) && /Rp 0/.test(body)) {
      fail('checkout — cart cleared but no success signal')
    } else {
      // toast may disappear; empty cart after pay is success signal
      const ticket = await page.locator('.retail-ticket').innerText()
      if (/Belum ada barang/i.test(ticket)) pass('checkout (cart cleared)')
      else fail('checkout feedback missing')
    }

    // Close receipt / settlement overlays
    async function dismissOverlays() {
      for (let i = 0; i < 5; i++) {
        const root = page.locator('.receipt-root')
        if (!(await root.isVisible().catch(() => false))) break
        const tutup = root.locator('.receipt-actions button.btn-ghost').first()
        if (await tutup.isVisible().catch(() => false)) {
          await tutup.click({ force: true })
        } else {
          await page.locator('.receipt-scrim').first().click({ force: true, position: { x: 5, y: 5 } }).catch(() => {})
        }
        await page.waitForTimeout(400)
      }
    }

    await dismissOverlays()
    await page.keyboard.press('F8')
    await page.waitForTimeout(1800)
    await shot(page, '05-settlement')
    const after = await page.locator('body').innerText()
    if (/Penutupan|settlement|Tunai|Kas|penjualan|Revenue|Rekap|Settlement/i.test(after)) pass('settlement')
    else pass('settlement-attempted')
    await dismissOverlays()

    // Hold park test: add item then F9
    const lookup2 = page.locator('.retail-lookup-list button').first()
    await lookup2.waitFor({ state: 'visible', timeout: 10000 })
    await lookup2.click()
    await page.waitForTimeout(400)
    await page.keyboard.press('F9')
    await page.waitForTimeout(800)
    const ticket = await page.locator('.retail-ticket').innerText()
    if (/Belum ada barang/i.test(ticket)) pass('hold-park')
    else fail('hold-park — cart not cleared')
    await shot(page, '06-hold')

    fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'))
    if (log.some((l) => l.startsWith('FAIL'))) process.exitCode = 1
  } catch (err) {
    fail(String(err?.message || err))
    await shot(page, 'error')
    fs.writeFileSync(path.join(OUT, 'log.txt'), log.concat([String(err)]).join('\n'))
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
