# Modul Storefront — Roadmap Landing & Online Shop KEA One

Dokumen referensi untuk modul **storefront** (landing page jasa + online shop), domain custom, dan sinkron data ke POS/ERP.

Gunakan dokumen ini saat merencanakan fitur, migration, menu RBAC, dan urutan sprint.

---

## Ringkasan keputusan produk

| Aspek | Keputusan |
|-------|-----------|
| Nama modul | `storefront` (ModuleCatalog, default **off**) |
| Desktop app | `storefront` (`StorefrontApp`) |
| Jenis situs | `landing` (jasa) · `shop` (katalog + checkout) |
| Domain | **Custom domain saja** (tanpa subdomain KEA One) |
| Domain flow | Hubungkan domain milik customer (MVP) → beli + DNS otomatis (fase berikutnya) |
| Pembayaran | **Transfer manual** (MVP); gateway nanti |
| Stok | Setting: **`realtime`** (ikuti gudang) atau **`allocated`** (qty khusus online) |
| Order web | `storefront_orders` → konfirmasi bayar → `Sale` channel `web` |

---

## Batas modul

| Domain | Tempat | Catatan |
|--------|--------|---------|
| Katalog produk master | Data Master | Storefront hanya memilih / mengalokasikan |
| Stok & HPP | Persediaan | Realtime baca saldo; alokasi potong saat order lunas |
| Kasir / sale | Penjualan | Order web yang lunas jadi `Sale` |
| Marketing SaaS `/` | Frontend marketing | Bukan situs tenant |
| Situs publik tenant | Host = custom domain | Resolve `storefront_domains.host` → company |

---

## Fase

### Fase 1 — Fondasi (sprint ini)

- [x] Roadmap + ModuleCatalog `storefront`
- [x] Tabel: storefronts, domains, pages, products, orders (+ items)
- [x] Menu RBAC + app desktop admin (setup, domain, produk, order)
- [x] API tenant: show/update storefront, connect/verify domain, CRUD produk shop, list/confirm order
- [x] API publik stub: resolve by `Host`
- [x] Template katalog minimal (landing + shop) di config
- [x] UI setup: jenis, template, branding, rekening, mode stok
- [x] UI setup: konten template (logo, banner, carousel, gallery) sesuai slot template
- [x] UI domain: input host, **cek ketersediaan**, instruksi DNS, tombol verifikasi
- [x] UI produk shop + order (konfirmasi transfer; Sale posting = Fase 2)

### Fase 1.5 — Template designer (block builder)

- [x] Block catalog + sanitize + preset dari 5 template lama
- [x] Sumber layout beranda: `storefront_pages.content.blocks` (bukan slot `theme_content`)
- [x] API `GET/PUT /storefront/pages/home` + apply preset + `brand_colors`
- [x] Lazy migrate `theme_content` → blocks
- [x] UI Desainer beranda (add / reorder / edit / hide / preview live)
- [x] Renderer generik block + fallback template lama
- [x] Setup: template = preset starter; warna brand; slot UI deprecated

### Fase 2 — Publik & checkout

- [ ] Render publik berdasarkan domain (landing / shop) — pakai `home_blocks`
- [x] Katalog publik + cart + checkout transfer manual (API + preview shop flow)
- [ ] Upload bukti transfer (opsional)
- [ ] Konfirmasi bayar di app → buat `Sale` + potong stok sesuai mode
- [ ] Multi-halaman konten (about / services) — lanjutan designer

### Fase 3 — Domain beli & SSL

- [ ] Integrasi registrar (cek ketersediaan + beli)
- [ ] Nameserver / DNS record otomatis ke edge KEA One
- [ ] SSL otomatis (Let’s Encrypt / proxy)
- [ ] Status domain: pending_dns → active / failed

### Fase 4 — Polish

- [ ] Price channel `web`
- [ ] Multi-rekening, ongkir sederhana, status order customer
- [ ] SEO per halaman, analytics ringan
- [ ] Payment gateway (opsional, modul tambahan)
- [ ] Custom CSS / drag-drop library (opsional)

---

## Model data (inti)

| Tabel | Peran |
|-------|--------|
| `storefronts` | 1 situs per company: kind, template preset, branding, bank, stock_mode |
| `storefront_domains` | Custom domain → storefront; status DNS/SSL |
| `storefront_pages` | Konten halaman (`content.blocks` JSON) — beranda diisi designer |
| `storefront_products` | Produk tampil + `allocated_qty` / `sold_qty` |
| `storefront_orders` | Order web sebelum/ setelah jadi Sale |
| `storefront_order_items` | Baris order |

### Mode stok

| Mode | Qty tersedia di shop |
|------|----------------------|
| `realtime` | Saldo `warehouse_id` (atau default outlet) |
| `allocated` | `max(0, allocated_qty - sold_qty)` per `storefront_products` |

---

## Menu RBAC

| menu_key | Aksi |
|----------|------|
| `storefrontsetup` | view, edit |
| `storefrontdomain` | view, create, edit, delete |
| `storefrontproducts` | view, create, edit, delete |
| `storefrontorders` | view, edit (konfirmasi / batal) |
| `storefrontpages` | view, create, edit, delete (desainer beranda) |

---

## Path kunci

| Area | Path |
|------|------|
| Config | `config/storefront.php` |
| Support | `app/Support/StorefrontCatalog.php` |
| Service | `app/Services/StorefrontService.php`, `StorefrontDomainService.php` |
| Models | `app/Models/Storefront*.php` |
| API tenant | `/v1/storefront/*` |
| API publik | `/v1/public/storefront` |
| Desktop | `frontend/src/desktop/StorefrontApp.tsx` |
| Pages | `frontend/src/pages/storefront/*` |

---

## Catatan teknis

- Satu storefront per company (MVP). Multi-site nanti jika perlu.
- Domain dinormalisasi lowercase; unik global di `storefront_domains.host`.
- Verifikasi DNS: bandingkan A/CNAME ke target di `config/storefront.php` (`dns_target_host` / `dns_target_ips`).
- Pembelian domain: interface `DomainRegistrar` — implementasi nyata di Fase 3.
- Jangan campur dengan landing marketing platform di `/`.
