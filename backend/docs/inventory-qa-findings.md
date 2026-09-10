# QA Findings — Modul Inventory / Persediaan (KeaOne)

**Tanggal review:** 8 September 2026  
**Terakhir di-fix:** 8 September 2026  
**Metode:** Static code review (backend + frontend), bukti dari source  
**Scope:** Modul `stock` / app Persediaan — saldo, transfer, opname, adjustment/waste, produksi, costing, valuasi, reorder  
**Bukan:** Runtime E2E / load test di environment produksi

---

## Status perbaikan (2026-09-08)

| ID | Status | Catatan singkat |
|----|--------|-----------------|
| A1 | **Fixed** | `book_qty` selalu dari saldo gudang; diabaikan dari client |
| A2 | **Fixed** | Confirm: `variance = counted − current_qty` (stok akhir = hitung fisik) |
| B1 | **Fixed** | update/cancel lock + re-cek + conditional `WHERE status` |
| B2 | **Fixed** | `POST …/void` untuk shipped/received + reverse costing |
| B3 | **Fixed** | BOM `unit_id` → factor dari `product_units` komponen |
| B4 | **Fixed** | `ceil` tanpa `max(1)`; qty 0 diizinkan / di-skip |
| B5 | **Fixed** | Inbound dari stok negatif hanya valuasi qty positif |
| B6 | **Fixed** | Unique product per dokumen (BE + FE) |
| B7 | **Fixed** | Scan exact-only + fallback `GET /products/barcode/{code}` |
| B8 | **Fixed** | Void produksi wajib semua serial `available` |
| C1 | **Fixed** | Waste reason ⇒ qty negatif (BE + FE) |
| C2 | **Fixed** | Ganti unit opname konversi dari counted base |
| C3 | **Fixed** | `completeStep` lock + re-cek draft |
| C4 | **Fixed** | Transfer `cost_amount` + remainder chunk; produksi remainder |
| C5 | **Fixed** | `firstOrCreate` catch unique (balance + lot) |
| C6 | **Fixed** | Preview produksi sequence guard |
| C7 | **Fixed** | Per-row `actingId` disable aksi |
| C8 | **Fixed** | Scan barcode API bila di luar katalog lokal 500 |
| C9 | **Fixed** | Sync steps tidak bisa set `done` via payload |
| C10 | **Deferred** | Lot outbound jual/transfer — limitasi roadmap (ledger receipt-only) |
| D1 | **Fixed** | Cancel UI: `canEdit \|\| canDelete` |
| D2 | **Fixed** | FE validasi from ≠ to |
| D3 | **Fixed** | `step={1}` + parse integer |
| D4 | **Deferred** | Serial UI masih prompt (cukup untuk qty kecil; polish nanti) |
| D5 | **Fixed** | Reorder warehouse scoped `company_id` |
| D6 | **Fixed** | `DocumentSequenceService` pad 4 (TRF/OPN/ADJ/PRD) |

---

## Ringkasan eksekutif

Temuan critical/high/medium dari review **sudah ditutup** pada sesi fix 8 Sep 2026, kecuali gap sengaja ditunda: **C10** (lot outbound penuh) dan **D4** (UI serial terstruktur).

| Severity | Awal | Fixed | Deferred |
|----------|------|-------|----------|
| Critical | 2 | 2 | 0 |
| High | 8 | 8 | 0 |
| Medium | 10 | 9 | 1 (C10) |
| Low | 6 | 5 | 1 (D4) |

---

## Migration

Jalankan: `php artisan migrate`  
File: `2026_09_08_140000_inventory_qa_transfer_void_and_cost_amount.php`  
— kolom `stock_transfer_items.cost_amount`, `stock_transfers.voided_*`

---

## Checklist verifikasi setelah fix

- [x] Opname: client tidak bisa set `book_qty`; confirm menghasilkan stok = counted
- [x] Concurrent update/cancel vs confirm tidak mengubah dokumen non-draft
- [x] Void transfer shipped/received mengembalikan stok + costing
- [x] BOM unit conversion + tanpa over-issue `max(1)`
- [x] Duplikat produk ditolak; scan exact + barcode API
- [x] Waste reason menolak qty positif
- [x] Negative stock recovery tidak mengacaukan avg/layer
- [ ] Kartu stok & valuasi — smoke test manual di tenant
- [ ] `php artisan migrate` di environment target

---

## Referensi

- Roadmap: `backend/docs/inventory-roadmap.md`
- Pola QA saudara: `backend/docs/procurement-qa-findings.md`
- Config: `backend/config/inventory.php`

---

*Dokumen hidup — update tabel status perbaikan saat item di-fix.*
