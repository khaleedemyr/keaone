# QA Findings — Setup Situs / Menu Storefront (KeaOne)

**Tanggal review:** 9 September 2026  
**Metode:** Static code review (frontend setup/menus + backend admin API)  
**Scope:** Menu ERP Toko Online, Setup situs, Desainer, Domain, Produk, Order, Roles ACL  
**Bukan:** E2E runtime / load test  
**Catatan:** Temuan commerce (checkout/auth/ongkir) di `storefront-qa-findings.md` dianggap sudah Fixed; dokumen ini fokus **admin setup & menu**.

Dokumen ini jadi **panduan perbaikan**. Update kolom Status saat item ditutup.

---

## Status perbaikan

| ID | Severity | Status | Ringkas |
|----|----------|--------|---------|
| S1 | Critical | Fixed | Roles ACL tidak punya grup menu storefront |
| S2 | Critical | Fixed | Setup save selalu `apply_preset: true` → hapus layout Desainer |
| S3 | High | Fixed | Kontak (email/phone/alamat) tidak ada di Setup |
| S4 | High | Fixed | Outlet / gudang / price channel tidak ada di UI |
| S5 | High | Fixed | SEO title/description tidak ada di Setup |
| S6 | High | Fixed | Dual model slot Setup vs block Desainer + preview beda |
| S7 | High | Fixed | Produk: tidak ada hide/sort/override harga |
| S8 | High | Fixed | Confirm order ≠ Sale / potong stok realtime |
| S9 | Medium | Fixed | Nav Produk/Order tetap muncul untuk landing |
| S10 | Medium | Fixed | Publish tanpa checklist readiness di UI |
| S11 | Medium | Fixed | Bank account tidak bisa hapus baris |
| S12 | Medium | Fixed | Brand colors di 2 tempat (Setup + Desainer) |
| S13 | Medium | Fixed | Copy shipping Setup hardcode ID (bukan i18n) |
| S14 | Medium | Fixed | Status domain raw; SSL / purchase path kurang |
| S15 | Medium | Fixed | Preview dari Desainer draft tidak lengkap |
| S16 | Low | Fixed | Tidak ada onboarding checklist di hub app |
| S17 | Low | Fixed | Order list tanpa filter/status i18n |
| S18 | Low | Fixed | Picker produk tidak searchable |

---

## Ringkasan eksekutif

Menu ERP **Toko Online** sudah terhubung (5 section + module gate). Yang paling merusak setup:

1. **Roles** tidak bisa assign hak storefront → non-owner ACL putus.  
2. **Simpan Setup** selalu regenerate home blocks → kerja Desainer hilang.  
3. Field backend penting (**kontak, gudang/outlet/channel, SEO**) belum punya form Setup.  
4. **Produk toko** terlalu tipis vs API.  
5. Model konten **slot vs block** membingungkan (preview Setup ≠ situs live).

---

## Peta menu saat ini

| Nav | Menu key | Halaman | Catatan |
|-----|----------|---------|---------|
| Setup situs | `storefrontsetup` | `StorefrontSetup` | Identitas, template, slot, bank, shipping |
| Desainer beranda | `storefrontpages` | `StorefrontDesigner` | Block builder |
| Domain | `storefrontdomain` | `StorefrontDomain` | Check / connect / TXT / verify |
| Produk toko | `storefrontproducts` | `StorefrontProducts` | Add + alloc qty + delete |
| Order web | `storefrontorders` | `StorefrontOrders` | Confirm / cancel |

---

## Critical

### S1. Roles ACL tanpa grup storefront
| | |
|---|---|
| **Area** | `RolesManager.tsx` `ROLE_GROUPS` / `MENU_LABEL` |
| **Temuan** | `MenuCatalog` punya 5 menu storefront, tapi Roles UI tidak menampilkannya → tidak bisa di-grant ke role non-owner. |
| **Arah fix** | Tambah grup `storefront` + label `menuStorefront*`. |

### S2. Setup save wipe Desainer
| | |
|---|---|
| **Area** | `StorefrontSetup.tsx` → `apply_preset: true` |
| **Temuan** | Setiap simpan Setup regenerate preset blocks. Layout custom di Desainer hilang (termasuk ubah logo/ongkir saja). |
| **Arah fix** | Default `apply_preset: false`; true hanya saat ganti template/slot atau tombol eksplisit + konfirmasi. |

---

## High

### S3. Kontak tidak di Setup
Backend: `contact_email/phone/address`. Block kontak bilang “isi di setup” tapi form tidak ada.

### S4. Outlet / warehouse / price channel
API + stok realtime + `priceFor` memakai field ini; Setup tidak expose selector.

### S5. SEO
`seo_title` / `seo_description` di API; tidak ada input admin.

### S6. Dual konten slot vs block
Setup edit slot + preview paksa `home_blocks: []` (legacy template). Live/public pakai blocks. User lihat preview ≠ situs publik.

### S7. Produk admin tipis
API: `is_visible`, `sort_order`, `override_price`. UI: add selalu visible, edit alloc saja, delete. Tidak bisa unhide untuk lolos publish gate.

### S8. Confirm order dead-end ops
Confirm hanya `paid` (+ `sold_qty` allocated). Tidak buat Sale / potong gudang realtime.

---

## Medium / Low

| ID | Temuan | Arah fix |
|----|--------|----------|
| S9 | Landing masih lihat Produk/Order | Hide nav shop-only by `site_kind` — **Fixed** |
| S10 | Publish gagal baru tahu syarat | Checklist readiness sebelum Published — **Fixed** |
| S11 | Bank tidak ada tombol hapus | Per-row remove — **Fixed** |
| S12 | Warna merek di 2 layar | Satu sumber (Setup saja) — **Fixed** |
| S13 | Shipping copy hardcode ID | i18n keys — **Fixed** |
| S14 | Status domain mentah | Chip lokal + SSL — **Fixed** |
| S15 | Designer preview draft tipis | Sertakan shipping/theme/contact — **Fixed** |
| S16 | Hub app kosong | Checklist setup → domain → produk → publish — **Fixed** |
| S17 | Order tanpa filter | Status filter + i18n — **Fixed** |
| S18 | Select produk statis | Search ke `product-options` — **Fixed** |

---

## Yang sudah solid

- App desktop/ERP + module `storefront` + nav 5 section  
- Setup: kind, template, status, logo, brand, slot theme, bank, shipping RajaOngkir  
- Desainer block (library, reorder, media)  
- Domain check/connect/TXT/verify  
- Publish gate backend (rekening + produk + shipping intentional)  
- Public SPA by host (dari QA commerce sebelumnya)

---

## Prioritas sprint

1. **S1 → S2** (ACL + jangan wipe Desainer)  
2. **S3 → S4 → S5** (field Setup yang hilang)  
3. **S7 + S6** (Produk + unify preview/konten)  
4. **S8** (Confirm → Sale) atau copy jujur dulu  
5. Medium polish (S9–S15)
