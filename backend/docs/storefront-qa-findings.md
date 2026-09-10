# QA Findings — Modul Storefront (KeaOne)

**Tanggal review:** 9 September 2026  
**Metode:** Static code review (backend + frontend), bukti dari source  
**Scope:** Setup toko, designer/preview, katalog, cart/checkout, login pembeli, RajaOngkir, order admin, API publik  
**Bukan:** Runtime E2E penuh di domain live / load test produksi

Dokumen ini jadi **panduan perbaikan**. Update kolom Status saat item ditutup.

---

## Status perbaikan

| ID | Severity | Status | Ringkas |
|----|----------|--------|---------|
| A1 | Critical | Fixed | Checkout toko selalu paksa RajaOngkir meski shipping off |
| A2 | Critical | Fixed | Belum ada SPA/public page untuk domain toko |
| A3 | Critical | Fixed | Login pembeli preview rawan 401 (interceptor skip token staff) |
| A4 | Critical | Fixed | Register email bisa nempel contact ERP + lihat order guest |
| B1 | High | Fixed | Stok allocated oversell + race confirm |
| B2 | High | Fixed | Mode realtime tidak cek stok gudang |
| B3 | High | Fixed | Shipping enabled tapi belum lengkap → ongkir 0 |
| B4 | High | Fixed | Kurir di luar daftar toko masih bisa dipilih |
| B5 | High | Fixed | Double-click checkout → UUID baru → order dobel |
| B6 | High | Fixed | Race pilih destinasi ongkir (response lama timpa baru) |
| B7 | High | Fixed | Cart/session scope `title+template` (bocor / hilang) — live pakai host |
| B8 | High | Fixed | Stok 0 masih bisa ditambah ke cart |
| C1 | Medium | Fixed | Success/akun/admin order kurang rincian ongkir & alamat |
| C2 | Medium | Fixed | Price channel storefront diabaikan |
| C3 | Medium | Fixed | Preview shipping tidak ikut draft unsaved |
| C4 | Medium | Fixed | Tidak ada throttle khusus login/register pembeli |
| C5 | Medium | Fixed | Publish shop tanpa readiness (rekening / ongkir / harga) |
| C6 | Medium | Fixed | Verifikasi domain tanpa ownership challenge |
| C7 | Medium | Fixed | Race nomor order & client_uuid / register email |
| D1 | Low | Fixed | Copy cart “ongkir dikonfirmasi seller” vs ongkir otomatis |
| D2 | Low | Fixed | Banner preview saling beda |
| D3 | Low | Fixed | Katalog publik belum pagination |
| D4 | Low | Fixed | GET publik bisa persist migrate blocks |

---

## Ringkasan eksekutif

Storefront sudah cukup untuk **demo di Preview** (tema, katalog, cart, checkout transfer, login pembeli, setup ongkir). Untuk **production / domain publik** masih belum siap.

| Severity | Jumlah | Fokus |
|----------|--------|--------|
| Critical | 4 | Checkout shipping gate, SPA publik, auth preview, privasi order |
| High | 8 | Stok, ongkir, race order, cart scope |
| Medium | 7 | Admin UX, harga channel, publish gate, domain |
| Low | 4 | Copy, pagination, polish |

**Prioritas disarankan**

1. Sprint fix: **A1 → A3 → B5 → B3 → B4** (checkout & auth preview segera terasa)  
2. Sprint keamanan/stok: **A4 → B1 → B2**  
3. Sprint go-live: **A2 → C5 → C1** (public site + readiness + order detail)

---

## A. Critical

### A1. Checkout toko selalu paksa RajaOngkir
| | |
|---|---|
| **Area** | `frontend/.../commerce/StorefrontShop.tsx` |
| **Temuan** | `shippingEnabled = isShop`. Destinasi wajib meski `shipping.enabled = false`. |
| **Dampak** | Checkout tanpa ongkir macet / UX salah. |
| **Arah fix** | `shippingEnabled = model.shipping?.enabled && shippingReady`. Destinasi + layanan hanya wajib jika enabled. |

### A2. Belum ada SPA publik storefront
| | |
|---|---|
| **Area** | `frontend/src/App.tsx` — hanya `/storefront/preview` + `RequireAuth` |
| **Temuan** | API `/public/storefront*` ada; halaman React publik belum. |
| **Dampak** | Domain publish tidak punya UI pembeli dari frontend ini. |
| **Arah fix** | Route publik (by host / path) → fetch public storefront + products → `StorefrontShopProvider` + `StorefrontSite`. Header `X-Storefront-Host`. |

### A3. Login pembeli di preview rawan 401
| | |
|---|---|
| **Area** | `frontend/src/api/client.ts` interceptor; route `/storefront/shop/auth/*` |
| **Temuan** | `url.includes('/auth/login')` menahan Bearer staff. Preview auth butuh staff Sanctum. |
| **Dampak** | Register/login pembeli di Preview gagal. |
| **Arah fix** | Hanya skip token untuk `/auth/login` & `/auth/register` exact (bukan substring), atau allowlist `/storefront/shop/auth/*`. |

### A4. Register email → takeover contact / riwayat order
| | |
|---|---|
| **Area** | `StorefrontService::registerCustomer`, `upsertCustomerContact`; `StorefrontCustomerAuthController::orders` |
| **Temuan** | Register publik tanpa verifikasi email. Contact ERP di-update; orders by `contact_id` / `customer_email`. |
| **Dampak** | Privasi & integritas data customer ERP. |
| **Arah fix** | Verifikasi email sebelum link contact; order history hanya setelah verified; jangan update contact existing dari register mentah. |

---

## B. High

### B1. Stok allocated oversell + race confirm
| | |
|---|---|
| **Area** | `StorefrontService::placeOrder`, `StorefrontController::confirmOrder` |
| **Temuan** | Cek `remainingAllocated` tanpa reserve; confirm tanpa lock/conditional ketat. |
| **Arah fix** | Reserve saat place order atau decrement atomik; confirm dalam transaksi + `where status`. |

### B2. Mode realtime tidak cek stok gudang
| | |
|---|---|
| **Area** | `placeOrder` — stok hanya jika `stock_mode === allocated` |
| **Arah fix** | Validasi saldo warehouse/outlet untuk realtime, atau blokir checkout sampai posting Sale/stok siap. |

### B3. Shipping enabled tapi unconfigured → ongkir 0
| | |
|---|---|
| **Area** | `placeOrder` + `RajaOngkirService::isConfigured` |
| **Temuan** | Jika enabled tanpa origin/key platform, shipping di-skip. |
| **Arah fix** | Block checkout/publish jika `enabled && !configured`. |

### B4. Kurir di luar daftar toko
| | |
|---|---|
| **Area** | `placeOrder` menerima `shipping_courier` client |
| **Arah fix** | Validasi courier ∈ daftar `shipping.couriers` toko. |

### B5. Double-click → order dobel
| | |
|---|---|
| **Area** | Frontend `placeOrder` — `newClientUuid()` tiap submit |
| **Arah fix** | UUID stabil per attempt + `inFlight` ref sampai selesai. |

### B6. Race destinasi ongkir
| | |
|---|---|
| **Area** | `loadShippingCost` / `searchDestination` |
| **Arah fix** | AbortController / request id; ignore response usang. |

### B7. Scope cart & customer session lemah
| | |
|---|---|
| **Area** | `lib/cart.ts`, `lib/customerSession.ts` — key `title + template_key` |
| **Arah fix** | Scope by `storefront.id` / host publik. |

### B8. Stok 0 masih bisa add to cart
| | |
|---|---|
| **Area** | Product detail / cart qty |
| **Arah fix** | Disable add jika `available_qty === 0`; clamp qty. |

---

## C. Medium

### C1. Ringkasan order kurang lengkap
| | |
|---|---|
| **Area** | Success page, Account orders, `StorefrontOrders.tsx` admin |
| **Arah fix** | Tampilkan subtotal, ongkir, layanan, destinasi, alamat, item, catatan. |

### C2. Price channel diabaikan
| | |
|---|---|
| **Area** | `publicProductPayload` / `placeOrder` pakai `sell_price` |
| **Arah fix** | `override_price ?? product->priceFor(outlet, channel)`. |

### C3. Preview shipping ≠ draft Setup
| | |
|---|---|
| **Area** | `previewDraft.ts`, `StorefrontPreviewPage.tsx` |
| **Arah fix** | Sertakan `shipping` di draft, atau dokumentasikan “preview = saved only”. |

### C4. Throttle auth pembeli
| | |
|---|---|
| **Area** | `routes/api.php` public storefront auth |
| **Arah fix** | `throttle:login` / register keyed by host+email+IP. |

### C5. Publish tanpa readiness
| | |
|---|---|
| **Area** | `StorefrontService::update` status published |
| **Arah fix** | Gate: rekening (shop), shipping state intentional, ada produk visible ber-harga. |

### C6. Domain verify tanpa ownership proof
| | |
|---|---|
| **Area** | `StorefrontDomainService` |
| **Arah fix** | TXT/HTTP challenge token per domain. |

### C7. Race nomor order / register / domain connect
| | |
|---|---|
| **Area** | `nextOrderNumber`, unique `client_uuid`, unique email/host |
| **Arah fix** | Sequence service / catch duplicate key → response validation. |

---

## D. Low / polish

| ID | Temuan | Arah fix |
|----|--------|----------|
| D1 | Copy cart bilang ongkir dikonfirmasi seller | Kondisikan ke `shipping.configured` |
| D2 | Banner preview beda (Site / ShopChrome / BlockRenderer) | Satu pesan standar |
| D3 | `PublicStorefrontController::products` tanpa pagination | `limit` / page |
| D4 | Public GET bisa `persistMigrate` home blocks | `persistMigrate: false` di path publik |

---

## Checklist manual (saat E2E)

Gunakan setelah fix Critical/High.

### Setup
- [ ] Toggle pengiriman off → checkout tanpa destinasi RajaOngkir
- [ ] Toggle on + lokasi + ekspedisi → Simpan → Preview ikut config
- [ ] Tanpa API platform → warning jelas, tidak free-shipping diam-diam

### Preview commerce
- [ ] Add to cart produk asli; demo id negatif ditolak
- [ ] Stok 0 tidak bisa add
- [ ] Login/register pembeli sukses di Preview
- [ ] Checkout guest + login; prefill data
- [ ] Double-click “Buat order” → 1 order saja
- [ ] Success tampil subtotal + ongkir + total

### Ongkir
- [ ] Cari destinasi → pilih layanan → total berubah
- [ ] Ganti destinasi cepat → layanan sesuai destinasi terakhir
- [ ] Kurir yang tidak dicentang di Setup tidak muncul / ditolak server

### Admin order
- [ ] List order tampil alamat, item, ongkir
- [ ] Confirm sekali saja; stok allocated tidak oversell

### Publik (setelah A2)
- [ ] Buka custom domain → situs load tanpa login staff
- [ ] Cart/login terpisah per host
- [ ] Order masuk admin company yang benar

---

## Referensi file kunci

| Area | Path |
|------|------|
| Checkout / cart / auth UI | `frontend/src/pages/storefront/commerce/StorefrontShop.tsx` |
| API client | `frontend/src/api/client.ts` |
| Setup pengiriman | `frontend/src/pages/storefront/StorefrontSetup.tsx` |
| Preview | `frontend/src/pages/storefront/StorefrontPreviewPage.tsx` |
| Order service | `backend/app/Services/StorefrontService.php` |
| RajaOngkir | `backend/app/Services/RajaOngkirService.php` |
| Publik API | `backend/app/Http/Controllers/Api/V1/PublicStorefrontController.php` |
| Auth pembeli | `backend/app/Http/Controllers/Api/V1/StorefrontCustomerAuthController.php` |
| Roadmap produk | `backend/docs/storefront-roadmap.md` |

---

## Cara update dokumen ini

1. Saat fix selesai: ubah Status → **Fixed**, isi catatan singkat di tabel Status.  
2. Jika temuan baru dari E2E: tambah ID baru (A/B/C/D berikutnya).  
3. Sinkron checklist manual — centang item yang sudah lolos di staging.
