# QA Findings — Modul POS / Sales (KeaOne)

**Tanggal review:** 8 September 2026  
**Terakhir di-fix:** 9 September 2026  
**Metode:** Static code review (backend + frontend), bukti dari source  
**Scope:** Kasir POS (`Pos.tsx` / `RetailRegister`), `SaleService`, settlement, hold lokal, sales history  
**Bukan:** Runtime E2E / load test di environment produksi; GL sales journal (deferred)

---

## Status perbaikan (2026-09-08)

| ID | Status | Catatan singkat |
|----|--------|-----------------|
| A1 | **Fixed** | Cancel re-cek status under lock; reverse via stock movements; conditional update |
| A2 | **Fixed** | BOM sale pakai `BomExplosionService::explodeLeaves` (unit + ceil + multilevel) |
| A3 | **Fixed** | Nomor invoice via `DocumentSequenceService` (pad 4) |
| A4 | **Fixed** | Checkout lock + UUID stabil; clear cart sebelum fetch receipt |
| A5 | **Fixed** | `skip_auto_promotion` dihormati server saat kasir clear auto-promo |
| B1 | **Fixed** | Alokasi diskon header ke `line_base` sebelum tax |
| B2 | **Fixed** | `addPayment` cap sisa + tolak lunas + unique catch |
| B3 | **Fixed** | `cash_net` hanya kurangi change dari ticket yang ada cash |
| B4 | **Fixed** | FG+BOM: recipe hanya deduct komponen |
| B5 | **Fixed** | Idempotency UUID cocokkan keranjang atau 422 |
| B6 | **Fixed** | Shortcut retail tidak dobel; F8 di `RetailRegister` |
| B7 | **Fixed** | Sales list default outlet saat ini |
| B8 | **Fixed** | ACL cancel di UI; async report status butuh report view |
| C1 | **Fixed** | Hold: harga channel snapshot; konfirmasi hapus; partial keep; quota catch |
| C2 | **Fixed** | Validasi underpay / min diskon-promo sebelum Pay |
| C3 | **Fixed** | Subtotal restaurant = paid/checkout totals |
| C4 | **Fixed** | `setQty` tidak sisakan baris qty 0 |
| D1 | **Fixed** | GL penjualan: `postSale` / `reverseSale` / `postSalePayment` + setting POS |
| D4 | **Fixed** | Search server-side (debounce) + katalog awal 200; Enter tidak auto-pick nama ambigu |
| D2 | Partial | Hold server-side outlet-shared **Fixed**; cash drawer open-close masih Open |
| D3 | Partial | Split tender UI **Fixed**; member/price override/partial refund masih open |

---

## Ringkasan eksekutif

POS sudah bisa checkout, hold lokal, settlement harian, cancel di history, **dan posting GL penjualan** (opsional via Pengaturan POS). Temuan Critical/High/Medium dari review awal sudah ditutup. Gap produk yang tersisa: hold server, split tender, member/override, partial refund.

| Severity | Awal | Fixed | Masih open |
|----------|------|-------|------------|
| Critical | 5 | 5 | 0 |
| High | 8 | 8 | 0 |
| Medium | 4 | 4 | 0 |
| Feature gap | 4 | 2 (+1 partial split) | 2 (D2 full; D3 remainder) |

---

## A. Critical

### A1. Concurrent cancel → stok dobel
| | |
|---|---|
| **Area** | Backend — `SaleService::cancel` |
| **Temuan** | Status dicek di luar lock; setelah `lockForUpdate` tidak re-cek. |
| **Fix** | Re-cek `cancelled` under lock; reverse dari `stock_movements` (ref sale); update kondisional. |

### A2. BOM sale abaikan konversi satuan / ceil / multilevel
| | |
|---|---|
| **Area** | `explodeBomStock` |
| **Temuan** | `round(qty * sold)` flat saja; beda dari produksi. |
| **Fix** | `BomExplosionService::explodeLeaves`. |

### A3. Sequence invoice wrap setelah 999/hari
| | |
|---|---|
| **Area** | `nextNumber` `substr(-3)` |
| **Fix** | `DocumentSequenceService::next(..., pad: 4)`. |

### A4. Double checkout (UUID baru tiap klik)
| | |
|---|---|
| **Area** | Frontend `Pos.tsx` checkout |
| **Temuan** | Tidak ada in-flight lock; UUID selalu baru; receipt fail tetap jaga cart. |
| **Fix** | `checkoutLockRef` + UUID reuse sampai sukses; clear cart segera setelah POST. |

### A5. Clear auto-promo di UI diabaikan server
| | |
|---|---|
| **Area** | FE `suppressAutoPromo` / BE `bestAutoApply` |
| **Fix** | Payload `skip_auto_promotion` + server skip auto bila flag set. |

---

## B. High

### B1. Diskon sale-level tidak dialokasi ke baris
**Fix:** `allocateSaleDiscount` proporsional ke `line_base` sebelum tax.

### B2. `addPayment` overpay tak terbatas / race UUID
**Fix:** Tolak bila sudah lunas; non-cash ≤ sisa; catch unique.

### B3. Settlement `cash_net` salah
**Fix:** Kurangi `change_amount` hanya untuk sale yang punya payment cash.

### B4. Track stock + BOM double issue
**Fix:** Jika ada komponen BOM trackable, hanya explode BOM (skip FG).

### B5. Idempotent UUID beda keranjang tetap “sukses”
**Fix:** `assertIdempotentPayload` bandingkan items.

### B6. Shortcut retail dobel
**Fix:** Parent skip listener saat `retail`; F8 di RetailRegister.

### B7. List sales lintas outlet
**Fix:** Default filter `outlet_id` current (override `all_outlets=1`).

### B8. Cancel UI tanpa ACL; async report ACL longgar
**Fix:** `can('sales','delete')`; `reportsAsyncStatus` butuh report view.

---

## C. Medium

Hold hardening, validasi pay, subtotal, qty 0 — lihat tabel status.

---

## D. Open / deferred

| ID | Gap | Status |
|----|-----|--------|
| D1 | Posting GL penjualan (Cash/AR, Revenue, Tax, COGS, Inventory) + reverse cancel + pelunasan AR | **Fixed** — `GlPostingService::postSale` / `reverseSale` / `postSalePayment`; toggle di Pengaturan POS |
| D2 | Hold server / shared register; cash drawer count & variance | **Partial** — server holds Fixed; cash drawer Open |
| D3 | Split tender, member, price override, partial return/refund | **Partial** — split tender UI Fixed; sisanya Open |
| D4 | Product search/paging untuk katalog besar | **Fixed** — debounce search API + merge catalog |

---

## File utama yang diubah

- `backend/app/Services/SaleService.php`
- `backend/app/Services/GlPostingService.php`
- `backend/app/Services/GlAccountService.php`
- `backend/app/Support/SalesSettings.php`
- `backend/config/sales.php`
- `backend/app/Http/Controllers/Api/V1/SaleController.php`
- `backend/app/Http/Controllers/Api/V1/CompanyController.php`
- `backend/app/Http/Controllers/Api/V1/GlAccountController.php`
- `frontend/src/pages/Pos.tsx`
- `frontend/src/pages/pos/RetailRegister.tsx`
- `frontend/src/pages/Sales.tsx`
- `frontend/src/pages/settings/PosSettings.tsx`
- `frontend/src/lib/posHolds.ts`
- `frontend/src/i18n/messages/*`
