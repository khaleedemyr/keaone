# Modul Persediaan — Roadmap & Patokan KEA One

Dokumen referensi untuk mengembangkan modul stok (`stock`) menjadi **aplikasi Persediaan** yang layak untuk retail, cafe/resto, dan manufaktur.

Gunakan dokumen ini saat merencanakan fitur baru, migration DB, menu RBAC, costing, dan urutan sprint.

---

## Ringkasan

| Aspek | Kondisi saat ini (Sep 2026) |
|-------|----------------------------|
| Nama modul | `stock` (ModuleCatalog, default **on**) — UI label **Persediaan** |
| Desktop app | `inventory` (`InventoryApp`) — terpisah dari Data Master |
| Menu | `stock`, `stockcard`, `stocktransfers`, `stockopnames`, `stockadjustments`, `stockwaste`, `stockproduction`, `stockvaluation`, `warehouses`, `stocksettings` |
| Costing perusahaan | `inventory_costing_method`: **FIFO**, **Average**, **MAC** (bukan LIFO) |
| Operasi gudang (Fase 1) | Transfer (`draft`→`shipped`→`received`), Opname & Adjustment (`draft`→`confirmed`) |
| Kontrol & laporan (Fase 2) | `max_stock`, filter low/over, reorder → PR draft, valuasi & mutasi, `inventory_allow_negative_stock` (default off) |
| Cafe / resto (Fase 3) | Waste UI, prep/produksi dari BOM (`PRD-…`), `warehouses.location_type` |
| Retail polish (Fase 4) | Scan-first opname & transfer, kartu stok + picker SKU/barcode (varian = produk terpisah) |
| Manufaktur (Fase 5) | Modul `work_order` (default off): BOM multilevel leaf, qty aktual/varians, scrap, lot_code ringan |
| Hook gerakan | GR confirm/void, penjualan (COGS), retur beli, opening qty, transfer, opname, adjustment, production issue/receipt |
| Belum ada | Void transfer shipped, lot ledger penuh, serial FG, routing/MES, void produksi confirmed |

**Prinsip:** katalog & BOM resep tetap di **Data Master** / produk. Gerakan, saldo, nilai, dan operasi gudang hidup di app **Persediaan**. Pembelian tetap di **Pengadaan**.

---

## Batas modul (jangan campur)

| Domain | App / tempat | Contoh |
|--------|--------------|--------|
| Katalog item, unit, kategori | Data Master | Produk, variant, `cost_price` awal |
| Resep / BOM per produk jual | Data Master (produk) | Komponen terpotong saat penjualan |
| Penerimaan dari supplier | Pengadaan | GR → inbound + costing |
| Saldo, kartu stok, gudang, HPP | **Persediaan** | Transfer, opname, valuasi |
| Kasir / penjualan | Kasir + Penjualan | Outbound COGS |
| Produksi / work order | Persediaan (fase manufaktur) atau modul flag terpisah | Issue bahan → FG |

Jangan kembalikan menu stok/gudang ke dalam Master. Jangan taruh production order di Master.

---

## Yang sudah ada (baseline)

### Backend

| Area | Path |
|------|------|
| Costing | `app/Services/CostingService.php` |
| Inventory adjust | `app/Services/InventoryService.php` |
| Transfer / Opname / Adjustment | `StockTransferService`, `StockOpnameService`, `StockAdjustmentService` |
| Prep / produksi | `StockProductionService` + `BomExplosionService` |
| Laporan valuasi / reorder | `app/Services/StockReportService.php` |
| Setting helper | `app/Support/InventorySettings.php` |
| Ops constants | `app/Support/InventoryOps.php` |
| Config | `config/inventory.php` |
| Layer / konsumsi | `StockCostLayer`, `StockCostConsumption` |
| Saldo / gerakan | `StockBalance`, `StockMovement` |
| Dokumen operasi | `StockTransfer`, `StockOpname`, `StockAdjustment`, `StockProduction` (+ items) |
| Settings API | `CompanyController::updateSettings` (key inventory) |

### Frontend

| Area | Path |
|------|------|
| Desktop app | `frontend/src/desktop/InventoryApp.tsx` |
| App id | `TenantAppId = 'inventory'` |
| Stok | `pages/Stock.tsx` |
| Kartu stok | `pages/StockCard.tsx` (SearchSelect + scan SKU/barcode) |
| Transfer | `pages/inventory/StockTransfers.tsx` (scan-first) |
| Opname | `pages/inventory/StockOpnames.tsx` (scan-first) |
| Scan shared | `components/InventoryScanBar.tsx`, `lib/productScan.ts` |
| Adjustment | `pages/inventory/StockAdjustments.tsx` |
| Waste & spoilage | `pages/inventory/StockWaste.tsx` |
| Prep / produksi | `pages/inventory/StockProductions.tsx` |
| Valuasi & mutasi | `pages/inventory/StockValuation.tsx` |
| Gudang | `pages/Warehouses.tsx` |
| Pengaturan HPP | `pages/InventorySettings.tsx` |
| Visibility | `useTenantApps.ts` — butuh `modules.stock` + ACL menu di atas |

### Costing (perusahaan saja)

| Metode | Perilaku |
|--------|----------|
| `fifo` | Layer pembelian; konsumsi tertua dulu |
| `average` | Rata-rata tertimbang periodik (bulan kalender) |
| `moving_average` | MAC — rata-rata dihitung ulang tiap inbound |

Default: `moving_average`. Nilai lama `lifo` (jika pernah tersimpan) harus dianggap invalid → fallback MAC.

Uang tetap **integer Rupiah**. Tidak ada override metode per produk di fase ini.

### Database terkait costing

| Tabel / kolom | Fungsi |
|---------------|--------|
| `stock_balances.avg_cost`, `cost_value`, `period_*` | Nilai & period average |
| `stock_movements.unit_cost`, `cost_amount`, `costing_method` | Jejak HPP per gerakan |
| `stock_cost_layers` | Layer FIFO |
| `stock_cost_consumptions` | Konsumsi layer (tanpa FK ke `stock_movements` yang dipartisi) |

---

## Fitur inti (wajib semua vertikal)

Tanpa blok ini, app Persediaan belum “hidup” sebagai modul operasi.

| Fitur | Tujuan | Catatan |
|-------|--------|---------|
| Saldo & nilai stok | Qty + HPP + nilai per gudang | Baseline ada; perlu polish UI |
| Kartu stok | Audit trail masuk/keluar | Baseline ada |
| Gudang / lokasi | Toko, pusat, dapur, bahan | Baseline ada |
| **Transfer antar gudang** | Request → kirim → terima; qty in-transit | Prioritas #1 |
| **Stock opname** | Hitung fisik → selisih → posting | Impact costing wajib |
| **Adjustment** | Rusak, hilang, sample, write-off | Alasan + optional approval |
| Min / max & reorder | Alert stok rendah | Saran beli → Pengadaan |
| Laporan valuasi | Nilai stok per metode / gudang / kategori | Baca dari balance + costing |
| Kebijakan stok negatif | Boleh/tidak per company / business type | Setting perusahaan |

---

## Per vertikal

### Retail

| Fitur | Prioritas | Keterangan |
|-------|-----------|------------|
| Multi-outlet + transfer toko ↔ gudang | Tinggi | Memakai transfer inti |
| Scan barcode opname / transfer | Tinggi | UX lapangan |
| Variant di level stok | Sedang | Ukuran/warna — ikut master produk |
| Pack size (lusin ↔ pcs) | Sedang | Konsisten unit master |
| Serial / IMEI | Rendah–opsional | Elektronik |
| Batch + ED | Rendah–opsional | F&B ritel / apotek ringan |

### Cafe / resto

| Fitur | Prioritas | Keterangan |
|-------|-----------|------------|
| BOM / resep konsumsi otomatis saat jual | Tinggi | Sudah ada di produk — jaga konsistensi costing |
| Prep / semi-finished | Tinggi | Batch produksi dapur (saus, dough) bahan → item siap |
| Gudang terpisah (dry / chiller / freezer / bar) | Tinggi | Master gudang + transfer |
| Waste / spoilage | Tinggi | Alasan: expired, overcook, complimentary |
| Yield & variance resep | Sedang | Teori vs aktual |
| Batch / lot + ED bahan | Sedang | Bahan mudah busuk |
| Integrasi kitchen | Sedang | Fokus stok bahan, bukan hanya menu jadi |

### Manufaktur

| Fitur | Prioritas | Keterangan |
|-------|-----------|------------|
| BOM multilevel | Tinggi | Bahan → WIP → FG |
| Work / production order | Tinggi | Issue bahan, terima hasil, scrap |
| Backflush vs manual issue | Sedang | Setting per perusahaan / item |
| Lot / batch end-to-end | Sedang | Traceability |
| Serial FG | Opsional | |
| Routing sederhana | Opsional | Bukan full MES di fase awal |
| Varians bahan / scrap / HPP | Sedang | Setelah production order stabil |

Manufaktur sebaiknya di-gate dengan flag/modul terpisah agar tidak membebani tenant retail murni.

---

## Roadmap fase

### Fase 1 — Operasi gudang (semua vertikal) ✅

1. Transfer antar gudang (status + in-transit) — `draft` → `shipped` → `received`
2. Stock opname (count sheet → posting selisih)
3. Adjustment dengan alasan
4. Hook semua gerakan ke `CostingService` / `InventoryService`

**DoD:** qty dan nilai stok tetap konsisten setelah transfer, opname, dan adjustment.

### Fase 2 — Kontrol & laporan ✅

1. Min/max, reorder point, alert — `products.max_stock`, filter low/over di Stok, banner reorder
2. Laporan valuasi & mutasi — menu `stockvaluation` + `StockReportService`
3. Kebijakan stok negatif — setting `inventory_allow_negative_stock` (default **false**)
4. Deep-link saran PR dari item di bawah min — `POST stock/reorder-suggestions/create-pr` → app Pengadaan

**DoD:** user bisa jawab “berapa nilai stok hari ini?” dan “apa yang harus dibeli?”.

### Fase 3 — Cafe / resto ✅

1. Waste & spoilage UI — menu `stockwaste` (adjustment dengan alasan cafe: expired / overcook / complimentary + damage / write_off)
2. Prep / production batch dari BOM — menu `stockproduction`, dokumen `PRD-…` (`draft`→`confirmed`)
3. Variance resep — **ditunda** (sprint berikutnya)
4. Lokasi gudang bertipe — `warehouses.location_type`: general / dry / chiller / freezer / bar / other

**DoD:** dapur bisa catat waste dan produksi semi-finished tanpa menyentuh manufaktur penuh.

### Fase 4 — Retail polish ✅

1. Scan-first opname & transfer — `InventoryScanBar` (wedge Enter + kamera) di form; scan ulang menambah qty / counted
2. Perilaku “variant” di kartu stok / transfer — picker menampilkan **name + SKU**, keywords barcode; kartu stok SearchSelect + scan (retail variant = **produk terpisah**, belum parent/child)
3. Serial / batch — **ditunda** (belum ada permintaan tenant)

**DoD:** petugas gudang bisa opname/transfer dengan scan barcode tanpa cari manual di daftar.

### Fase 5 — Manufaktur ✅

1. Modul/flag **`work_order`** (default **off**; Pro plan on) — gate fitur manufaktur tanpa app desktop baru
2. Production order — perluasan `stock_productions` / menu `stockproduction`: issue komponen + receipt hasil (+ scrap mengurangi qty bersih)
3. BOM multilevel — `BomExplosionService::explodeLeaves` (cafe tetap flat jika `work_order` off)
4. Lot tracking ringan + varians — `lot_code` di dokumen/note gerakan; `qty_actual` vs `qty_planned` per komponen
5. **Lot ledger** — tabel `stock_lots` + `stock_lot_movements`; receipt lot saat confirm produksi (bila `lot_code` diisi)
6. **Serial FG** — `track_serial` + `stock_serials`; wajib isi serial = qty bersih saat confirm
7. **Routing / MES ringan** — `stock_production_steps` (Prepare → Produce → QC → Complete); semua harus `done` sebelum confirm
8. **Void confirmed** — reverse receipt FG + restore komponen via `InventoryService` (`reverseCosting`), void lot/serial; status `voided`

**DoD:** tenant dengan `work_order` bisa produksi multilevel + scrap/lot ledger/serial/routing/void; retail/cafe tanpa modul tetap pakai prep flat.

---

## Menu RBAC yang diantisipasi

Menu existing:

- `stock`, `stockcard`, `warehouses`, `stocksettings`
- `stocktransfers`, `stockopnames`, `stockadjustments` (Fase 1)
- `stockvaluation` (Fase 2, view-only)
- `stockwaste`, `stockproduction` (Fase 3; manufaktur = fitur lanjutan di `stockproduction` bila `work_order` on)

Calon menu baru (fase berikutnya):

| Menu key (usulan) | Fitur |
|-------------------|-------|
| _(opsional)_ | Work center / kapasitas MES penuh |

Semua menu di atas tetap di bawah module `stock` (atau module manufaktur terpisah untuk production berat).

---

## Aturan teknis (jangan dilanggar)

1. **Integer money** — HPP & nilai dalam Rupiah bulat; sisa pembulatan di unit terakhir / saat qty → 0.
2. **Company-level costing** — belum ada override per produk.
3. **Tanpa FK ke tabel partisi** — `stock_movements` dan dokumen transaksi partisi: pakai `unsignedBigInteger` + index, bukan `constrained()`.
4. **InventoryService** — `withoutGlobalScopes` + `company_id` eksplisit.
5. **Void / reverse** — FIFO menolak void inbound jika layer sudah terpakai (tetap pertahankan).
6. **i18n** — key baru di semua locale (`id`, `en`, `es`, `fr`, `ar`, `zh`, `ja`, `ru`).
7. **App id** — desktop `inventory`; module toggle tetap `stock`.

---

## Definition of done per fitur baru

Sebelum merge fitur Persediaan, pastikan:

- [ ] Gerakan menulis `stock_movements` + update `stock_balances`
- [ ] Costing ikut (unit cost, cost amount, layer/avg sesuai metode)
- [ ] Kartu stok menampilkan jejak yang benar
- [ ] ACL menu + module `stock` (atau flag manufaktur)
- [ ] Tidak merusak flow GR / penjualan / retur yang sudah ada
- [ ] i18n lengkap

---

## Referensi terkait

- Costing config: `backend/config/inventory.php`
- Procurement (sumber inbound utama): `backend/docs/procurement-roadmap.md`
- Partisi MySQL: `backend/docs/mysql-partitions.md`

---

*Dokumen hidup — update ringkasan “kondisi saat ini” setiap kali baseline fitur bergeser.*
