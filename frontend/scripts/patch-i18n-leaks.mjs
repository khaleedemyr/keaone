import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'messages')

const patches = {
  id: {
    mktCapOutlets: 'Banyak outlet',
    mktPriceStarterF2: '1 cabang',
    mktHeroPickerMulti: 'Banyak cabang',
    password: 'Kata sandi',
    demoHint: 'Demo: owner@demo.test / kata sandi',
    demoPlatform: 'Platform: platform@keaone.test / kata sandi',
    hintInsight: 'Analitik',
    hintMaster: 'Data master',
    transfer: 'Pemindahan',
    posEyebrow: 'Titik penjualan',
    posColQty: 'Jml',
    posColSubtotal: 'Jumlah parsial',
    posSettlement: 'Penutupan',
    posSettlementTitle: 'PENUTUPAN',
    total: 'Jumlah',
    productsEyebrow: 'Data master',
    barcode: 'Kode batang',
    bomQty: 'Jml',
    salesEyebrow: 'Buku besar',
    exportExcel: 'Ekspor Excel',
    exportPdf: 'Ekspor PDF',
    status: 'Keadaan',
    username: 'Nama pengguna',
    appInsight: 'Analitik',
    appChat: 'Obrolan',
    appMaster: 'Data Master',
    customFieldEntitySupplier: 'Pemasok',
    customFieldKey: 'Kunci',
    bank: 'Nama bank',
    paymentTermCod: 'Bayar di tempat',
    widgetClockSkin_neon: 'Neon terang',
    widgetClockSkin_minimal: 'Sederhana',
    widgetClockSkin_flip: 'Balik',
    wpNebula: 'Nebula',
    blogSlug: 'Tautan',
    blogStatus: 'Status publikasi',
    blogDraft: 'Draf',
    blogCover: 'Sampul',
    blogEditorHeading2: 'Judul 2',
    blogEditorHeading3: 'Judul 3',
    tableArea: 'Area',
    tableAreaHint: 'Indoor, outdoor, VIP…',
    toolCounter: 'Kasir',
    outlet: 'Cabang',
    roleOwner: 'Pemilik',
    roleAdmin: 'Admin',
    roleViewer: 'Peninjau',
    permMaster: 'Data master',
    platformEyebrow: 'Platform',
    void: 'Batal',
    defaultPlan: 'Bawaan',
    roleSupport: 'Dukungan',
    discountScopeItem: 'Per item',
    discountMinSubtotal: 'Min. subtotal',
    purchaseTotal: 'Jumlah',
    purchaseStatusDraft: 'Draf',
    purchaseApprovalLevel: 'Tingkat {n}',
    stockQty: 'Jml',
    productUnitSmall: 'Kecil',
    productUnitMedium: 'Sedang',
    productUnitLarge: 'Besar',
  },
  es: {
    posColSubtotal: 'Importe parcial',
    total: 'Importe total',
    navRoles: 'Roles y permisos',
    receiptSubtotal: 'Importe parcial',
    menuRoles: 'Roles y permisos',
    purchaseTotal: 'Importe total',
  },
  fr: {
    cardTx: 'Opérations',
    stock: 'Stocks',
    total: 'Montant total',
    productDescription: 'Description du produit',
    customFieldType: 'Type de champ',
    customFieldType_date: 'Date du champ',
    customFieldOptions: 'Liste d\'options',
    province: 'Région',
    navModules: 'Modules métiers',
    modStock: 'Stocks',
    modPromotions: 'Campagnes promo',
    notifTitle: 'Alertes',
    aclMenu: 'Liste des menus',
    receiptPromo: 'Offre promo',
    menuContacts: 'Carnet de contacts',
    menuStock: 'Stocks',
    menuModules: 'Modules applicatifs',
    pagerInfo: 'Page {page} sur {last} · {total} enregistrements',
    navStock: 'Stocks',
    purchaseTotal: 'Montant total',
    purchaseNote: 'Remarque',
    stockType: 'Type de mouvement',
  },
  ar: {
    widgetClockSkin_analog: 'زجاجي',
    chatStartTyping: 'أرسل أول رسالة…',
    chatPlaceholder: 'اكتب رسالة…',
  },
  zh: {
    widgetClockSkin_analog: '玻璃',
    chatStartTyping: '发送第一条消息…',
    chatPlaceholder: '输入消息…',
  },
  ja: {
    widgetClockSkin_analog: 'ガラス',
    chatStartTyping: '最初のメッセージを送信…',
    chatPlaceholder: 'メッセージを入力…',
  },
  ru: {
    widgetClockSkin_analog: 'Стекло',
    chatStartTyping: 'Отправьте первое сообщение…',
    chatPlaceholder: 'Введите сообщение…',
  },
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

for (const [lang, keys] of Object.entries(patches)) {
  const file = join(root, `${lang}.ts`)
  let src = readFileSync(file, 'utf8')
  let n = 0
  for (const [key, value] of Object.entries(keys)) {
    const re = new RegExp(`^(\\s+)${key}:\\s*(?:'(?:\\\\'|[^'])*'|"(?:\\\\"|[^"])*")`, 'm')
    const next = src.replace(re, `$1${key}: '${esc(value)}'`)
    if (next !== src) {
      n++
      src = next
    } else {
      console.warn(`[${lang}] key not found: ${key}`)
    }
  }
  writeFileSync(file, src)
  console.log(`patched ${lang}: ${n} keys`)
}
