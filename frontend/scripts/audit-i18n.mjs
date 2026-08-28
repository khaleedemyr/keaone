import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'messages')
const langs = ['id', 'es', 'fr', 'ar', 'zh', 'ja', 'ru']
const dumpFull = process.argv.includes('--full')

function parseTsObject(file) {
  const src = readFileSync(file, 'utf8')
  const start = src.indexOf('= {')
  const body = src.slice(start + 2)
  const entries = new Map()
  const re = /^\s+([a-zA-Z0-9_]+):\s*(?:'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"|`((?:\\`|[^`])*)`)/gm
  let m
  while ((m = re.exec(body))) {
    const val = (m[2] ?? m[3] ?? m[4] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"')
    entries.set(m[1], val)
  }
  return entries
}

const en = parseTsObject(join(root, 'en.ts'))
const enKeys = [...en.keys()]

const allowSame = new Set([
  'KEA One', 'POS', 'ERP', 'WhatsApp', 'Email', 'Blog', 'Growth', 'Starter', 'Pro',
  'PR', 'PO', 'GR', 'SKU', 'JPG', 'PNG', 'WebP', 'WIB', 'Jakarta',
  'Rina W.', 'Budi S.', 'Dewi K.', 'QRIS', 'B1G1', 'IP', 'F3',
  'password', 'platform@keaone.test', 'owner@demo.test',
  'Retail', 'Restaurant', 'Cafe', '50+', '120+', '14 days',
  'Rp 149.000', 'Rp 349.000', 'Rp 699.000',
  'Aurora', 'Horizon', 'Chrome', 'Console', 'Logo', 'Normal',
  'B1G1', 'Promo · F3', 'PO → GR', 'PR → PO → GR',
])

function bucket(key) {
  if (key.startsWith('mkt')) return 'marketing'
  if (key.startsWith('blog')) return 'blog'
  if (key.startsWith('purchase') || key.startsWith('menuPurchase') || key.startsWith('navPurchase')) return 'purchase'
  if (key.startsWith('pos') || key.startsWith('receipt') || key.startsWith('navPos')) return 'pos'
  if (key.startsWith('sales') || key.startsWith('promo')) return 'sales-promo'
  if (key.startsWith('stock') || key.startsWith('product') || key.startsWith('nav') || key.startsWith('menu')) return 'master-nav'
  if (key.startsWith('platform') || key.startsWith('perm') || key.startsWith('billing') || key.startsWith('overview')) return 'platform'
  if (key.startsWith('chat') || key.startsWith('liveSupport')) return 'support'
  if (key.startsWith('widget') || key.startsWith('wp') || key.startsWith('desktop')) return 'desktop'
  if (key.startsWith('notif') || key.startsWith('approval')) return 'workflow'
  if (key.startsWith('cal')) return 'calendar'
  if (key.startsWith('log')) return 'logs'
  return 'other'
}

function isLatinOnly(s) {
  if (!s || s.length < 3) return false
  return /^[A-Za-z0-9 .,!?;:'"()\-–—·/&@→+™©%]+$/.test(s)
}

const report = {
  generatedAt: new Date().toISOString(),
  totalKeys: enKeys.length,
  languages: {},
}

for (const code of langs) {
  const dict = parseTsObject(join(root, `${code}.ts`))
  const missing = enKeys.filter((k) => !dict.has(k))
  const identical = []
  const identicalByBucket = {}

  for (const key of enKeys) {
    const ev = en.get(key)
    const v = dict.get(key)
    if (v === undefined) continue
    if (v !== ev || !ev) continue
    if (allowSame.has(ev)) continue
    if (/^[\d+./\s→·-]+$/.test(ev)) continue
    if (ev.length <= 2) continue
    identical.push({ key, value: ev, bucket: bucket(key) })
    identicalByBucket[bucket(key)] = (identicalByBucket[bucket(key)] ?? 0) + 1
  }

  const mktLeaks = identical.filter((x) => x.bucket === 'marketing')
  const appLeaks = identical.filter((x) => x.bucket !== 'marketing')

  const latinOnly = []
  if (['ar', 'zh', 'ja', 'ru'].includes(code)) {
    for (const key of enKeys) {
      const v = dict.get(key)
      if (!v || allowSame.has(v)) continue
      if (isLatinOnly(v) && v !== en.get(key)) latinOnly.push({ key, value: v })
    }
  }

  report.languages[code] = {
    keyCount: dict.size,
    missing: missing.length,
    missingKeys: missing.slice(0, 30),
    identicalToEn: identical.length,
    identicalMarketing: mktLeaks.length,
    identicalApp: appLeaks.length,
    byBucket: identicalByBucket,
    marketingLeaks: mktLeaks.map((x) => x.key),
    appLeaksSample: appLeaks.slice(0, 40).map((x) => `${x.key}: ${x.value.slice(0, 60)}`),
    appLeaksFull: appLeaks.map((x) => `${x.key}: ${x.value}`),
    coveragePct: Math.round(((dict.size - missing.length) / enKeys.length) * 1000) / 10,
    translationPct: Math.round(((enKeys.length - identical.length - missing.length) / enKeys.length) * 1000) / 10,
    latinOnlySuspicious: latinOnly.length,
    latinOnlySample: latinOnly.slice(0, 25).map((x) => `${x.key}: ${x.value.slice(0, 70)}`),
  }
}

const lines = []
lines.push('# KEA One i18n Audit Report')
lines.push('')
lines.push(`Generated: ${report.generatedAt}`)
lines.push(`Total message keys (EN): **${report.totalKeys}**`)
lines.push('')
lines.push('## Summary per language')
lines.push('')
lines.push('| Lang | Keys | Missing | Same as EN | Mkt leaks | App leaks | Translated ~% | Latin-only* |')
lines.push('|------|------|---------|------------|-----------|-----------|---------------|-------------|')

for (const code of langs) {
  const L = report.languages[code]
  lines.push(
    `| **${code.toUpperCase()}** | ${L.keyCount} | ${L.missing} | ${L.identicalToEn} | ${L.identicalMarketing} | ${L.identicalApp} | ${L.translationPct}% | ${L.latinOnlySuspicious ?? '-'} |`,
  )
}

lines.push('')
lines.push('*Latin-only = AR/ZH/JA/RU values that are pure Latin text (possible untranslated loanwords).')
lines.push('')
lines.push('## Latin-only suspicious (AR / ZH / JA / RU)')
lines.push('')
for (const code of ['ar', 'zh', 'ja', 'ru']) {
  const L = report.languages[code]
  if (!L.latinOnlySuspicious) {
    lines.push(`- **${code}**: ✅ none detected`)
    continue
  }
  lines.push(`- **${code}**: ${L.latinOnlySuspicious} keys`)
  for (const row of L.latinOnlySample) lines.push(`  - \`${row}\``)
  if (L.latinOnlySuspicious > L.latinOnlySample.length) {
    lines.push(`  - _…and ${L.latinOnlySuspicious - L.latinOnlySample.length} more_`)
  }
}
lines.push('')
lines.push('## By module (keys still identical to English)')
lines.push('')

for (const code of langs) {
  const L = report.languages[code]
  if (L.identicalToEn === 0) continue
  lines.push(`### ${code.toUpperCase()}`)
  const buckets = Object.entries(L.byBucket).sort((a, b) => b[1] - a[1])
  for (const [b, n] of buckets) lines.push(`- **${b}**: ${n} keys`)
  if (L.missing) lines.push(`- **missing keys**: ${L.missing}`)
  lines.push('')
}

lines.push('## Marketing leaks (should be 0)')
lines.push('')
for (const code of langs) {
  const L = report.languages[code]
  if (!L.marketingLeaks.length) {
    lines.push(`- **${code}**: ✅ none`)
  } else {
    lines.push(`- **${code}**: ${L.marketingLeaks.join(', ')}`)
  }
}

lines.push('')
lines.push('## Top app leaks per language (sample)')
lines.push('')
for (const code of langs) {
  const L = report.languages[code]
  if (!L.appLeaksSample.length) continue
  lines.push(`### ${code.toUpperCase()}`)
  for (const row of L.appLeaksSample) lines.push(`- \`${row}\``)
  if (L.identicalApp > L.appLeaksSample.length) {
    lines.push(`- _…and ${L.identicalApp - L.appLeaksSample.length} more_`)
  }
  lines.push('')
}

const outPath = join(root, '..', '..', '..', 'docs', 'i18n-audit.md')
try {
  writeFileSync(outPath, lines.join('\n'))
} catch {
  writeFileSync(join(root, 'i18n-audit.md'), lines.join('\n'))
}

console.log(lines.join('\n'))

if (dumpFull) {
  for (const code of ['id', 'es', 'fr']) {
    const L = report.languages[code]
    console.log(`\n\n===== ${code.toUpperCase()} FULL (${L.identicalToEn}) =====`)
    for (const row of [...L.marketingLeaks.map((k) => `${k}: ${en.get(k)}`), ...L.appLeaksFull]) {
      console.log(row)
    }
  }
}
