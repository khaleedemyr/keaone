import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

// Dynamic import won't work easily for .ts - parse by extracting keys via regex from built output
// Use tsx or parse files manually

const dir = join(root, 'src', 'i18n', 'messages')
const langs = ['es', 'fr', 'ar', 'zh', 'ja', 'ru', 'id']

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

const en = parseTsObject(join(dir, 'en.ts'))

const allowSame = new Set([
  'KEA One', 'POS', 'ERP', 'WhatsApp', 'Email', 'Blog', 'Growth', 'Starter', 'Pro',
  'PR', 'PO', 'GR', 'SKU', 'JPG', 'PNG', 'WebP', 'WIB', 'Jakarta', 'Rina W.', 'Budi S.', 'Dewi K.',
  'password', 'platform@keaone.test', 'owner@demo.test', 'Retail', 'Restaurant', 'Cafe',
  '50+', '120+', '14 days', 'Rp 149.000', 'Rp 349.000', 'Rp 699.000',
])

for (const code of langs) {
  const dict = parseTsObject(join(dir, `${code}.ts`))
  const same = []
  for (const [key, ev] of en) {
    const v = dict.get(key)
    if (v === undefined) continue
    if (v === ev && ev && ev.length > 1) {
      if (allowSame.has(ev)) continue
      if (/^[\d+./\s]+$/.test(ev)) continue
      same.push({ key, value: ev })
    }
  }
  const mkt = same.filter((x) => x.key.startsWith('mkt'))
  console.log(`\n=== ${code.toUpperCase()} === ${same.length} identical to EN (${mkt.length} mkt*)`)
  for (const x of mkt) console.log(`  ${x.key}: ${x.value.slice(0, 90)}`)
  const other = same.filter((x) => !x.key.startsWith('mkt'))
  if (other.length) {
    console.log(`  -- non-mkt (${other.length}) --`)
    for (const x of other.slice(0, 20)) console.log(`  ${x.key}: ${x.value.slice(0, 90)}`)
    if (other.length > 20) console.log(`  ... +${other.length - 20} more`)
  }
}
