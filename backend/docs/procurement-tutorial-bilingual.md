# Tutorial Modul Pengadaan (Procurement) — KEA One

# Procurement Module Tutorial — KEA One

> **Versi / Version:** Agustus / August 2026  
> **Target:** End users / Pengguna akhir

---

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

Panduan lengkap untuk **pengguna akhir** (staff purchasing, gudang, finance, approver, dan admin perusahaan) dalam menggunakan modul **Pengadaan** di KEA One.
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

Complete guide for **end users** (purchasing staff, warehouse, finance, approvers, and company administrators) on using the **Procurement** module in KEA One.
</div>

---

<div class="toc">

## Daftar Isi / Table of Contents

<ol>
<li><strong>1. Apa itu Modul Pengadaan?</strong> / <em>What is the Procurement Module?</em></li>
<li><strong>2. Persiapan Sebelum Mulai</strong> / <em>Preparation Before You Start</em></li>
<li><strong>3. Struktur Menu & Hak Akses</strong> / <em>Menu Structure & Access Rights</em></li>
<li><strong>4. Pengaturan Modul (Settings)</strong> / <em>Module Settings (Settings)</em></li>
<li><strong>5. Tiga Mode Alur Pembelian</strong> / <em>Three Purchase Flow Modes</em></li>
<li><strong>6. Alur Kerja End-to-End</strong> / <em>End-to-End Workflow</em></li>
<li><strong>7. Dashboard Pengadaan</strong> / <em>Procurement Dashboard</em></li>
<li><strong>8. Master Data Pendukung</strong> / <em>Supporting Master Data</em></li>
<li><strong>9. Sourcing — RFQ, Price List, Kontrak</strong> / <em>Sourcing — RFQ, Price List, Contract</em></li>
<li><strong>10. Perencanaan — Rencana Tahunan & Demand Planning</strong> / <em>Planning — Annual Plan & Demand Planning</em></li>
<li><strong>11. Purchase Requisition (PR)</strong> / <em>Purchase Requisition (PR)</em></li>
<li><strong>12. Purchase Order (PO)</strong> / <em>Purchase Order (PO)</em></li>
<li><strong>13. Goods Receipt (GR) & Penerimaan Langsung</strong> / <em>Goods Receipt (GR) & Direct Receipt</em></li>
<li><strong>14. Retur Pembelian (Purchase Return)</strong> / <em>Purchase Return</em></li>
<li><strong>15. Nota Debit / Kredit Supplier</strong> / <em>Supplier Debit / Credit Notes</em></li>
<li><strong>16. Jadwal Pengiriman (Delivery Schedule)</strong> / <em>Delivery Schedule</em></li>
<li><strong>17. Tagihan Supplier (Vendor Invoice / AP)</strong> / <em>Vendor Invoice (Vendor Invoice / AP)</em></li>
<li><strong>18. 3-Way Match & Match Exception</strong> / <em>3-Way Match & Match Exception</em></li>
<li><strong>19. Batch Pembayaran Supplier</strong> / <em>Supplier Payment Batch</em></li>
<li><strong>20. Uang Muka Supplier (Prepayment)</strong> / <em>Supplier Prepayment</em></li>
<li><strong>21. PPh / Withholding Tax</strong> / <em>Withholding Tax (PPh)</em></li>
<li><strong>22. Jurnal GL Otomatis</strong> / <em>Automatic GL Journals</em></li>
<li><strong>23. Anggaran (Budget)</strong> / <em>Budget</em></li>
<li><strong>24. Aset Tetap dari Pembelian</strong> / <em>Fixed Assets from Purchases</em></li>
<li><strong>25. Approval — Manual, Matrix, Delegasi</strong> / <em>Approval — Manual, Matrix, Delegation</em></li>
<li><strong>26. Manajemen Vendor</strong> / <em>Vendor Management</em></li>
<li><strong>27. Portal Vendor (Supplier)</strong> / <em>Vendor Portal (Supplier)</em></li>
<li><strong>28. Laporan & Analitik</strong> / <em>Reports & Analytics</em></li>
<li><strong>29. Fitur Pendukung Lainnya</strong> / <em>Other Supporting Features</em></li>
<li><strong>30. Peran User & Contoh Skenario Harian</strong> / <em>User Roles & Daily Scenario Examples</em></li>
<li><strong>31. FAQ & Troubleshooting</strong> / <em>FAQ & Troubleshooting</em></li>
<li><strong>32. Glosarium</strong> / <em>Glossary</em></li>
<li><strong>Lampiran: Checklist Go-Live Procurement</strong> / <em>Appendix: Procurement Go-Live Checklist</em></li>
</ol>

</div>

---

## 1. Apa itu Modul Pengadaan? / What is the Procurement Module?

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

Modul **Pengadaan** di KEA One mengelola seluruh siklus pembelian barang dan jasa dari perusahaan Anda ke supplier (vendor), mulai dari:

- **Perencanaan** — rencana belanja, forecast, auto-reorder
- **Sourcing** — minta penawaran (RFQ), banding harga, kontrak supplier
- **Permintaan & pesanan** — PR → PO
- **Penerimaan** — barang masuk gudang (GR) atau biaya/aset
- **Keuangan** — tagihan supplier, matching, pembayaran, PPh, jurnal
- **Kontrol** — approval, budget, audit, laporan

Modul ini dirancang fleksibel: perusahaan kecil bisa pakai mode sederhana (penerimaan langsung), sementara perusahaan menengah-besar bisa aktifkan PR → PO → GR, AP, budget, dan approval matrix.

### Dokumen utama yang akan Anda temui

| Singkatan | Nama lengkap | Fungsi singkat |
|---------|--------------|----------------|
| **PR** | Purchase Requisition | Permintaan pembelian internal |
| **PO** | Purchase Order | Pesanan resmi ke supplier |
| **GR** | Goods Receipt | Bukti penerimaan barang |
| **PRN** | Purchase Return | Retur barang ke supplier |
| **RFQ** | Request for Quotation | Permintaan penawaran harga |
| **AP** | Accounts Payable | Tagihan/hutang ke supplier |

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

The **Procurement** module in KEA One manages the entire cycle of purchasing goods and services from your company to suppliers (vendors), starting from:

- **Planning** — purchase plans, forecasts, auto-reorder
- **Sourcing** — request for quotation (RFQ), price comparison, supplier contracts
- **Requisition & orders** — PR → PO
- **Receiving** — goods into warehouse (GR) or expense/asset
- **Finance** — vendor invoices, matching, payments, withholding tax, journals
- **Control** — approval, budget, audit, reports

This module is designed to be flexible: small companies can use a simple mode (direct receipt), while medium-to-large companies can enable PR → PO → GR, AP, budget, and approval matrix.

### Main documents you will encounter

| Abbreviation | Full name | Brief function |
|---------|--------------|----------------|
| **PR** | Purchase Requisition | Internal purchase request |
| **PO** | Purchase Order | Official order to supplier |
| **GR** | Goods Receipt | Proof of goods received |
| **PRN** | Purchase Return | Return of goods to supplier |
| **RFQ** | Request for Quotation | Request for price quotation |
| **AP** | Accounts Payable | Vendor invoice/payables |
</div>

---

## 2. Persiapan Sebelum Mulai / Preparation Before You Start

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### 2.1 Aktifkan modul Pengadaan

Modul Pengadaan **tidak aktif secara default** untuk setiap tenant/perusahaan.

**Admin sistem / super admin** harus:

1. Buka **Pengaturan Perusahaan** → modul aplikasi
2. Aktifkan modul **Pengadaan** (`purchase`)
3. Pastikan user yang bersangkutan punya **role** dengan menu Pengadaan

Setelah aktif, user akan melihat tile/aplikasi **Pengadaan** di desktop KEA One.

### 2.2 Master data wajib

Sebelum transaksi pertama, lengkapi data berikut di modul **Master**:

| Master | Lokasi | Keterangan |
|--------|--------|------------|
| **Produk** | Master → Produk | Barang yang dibeli; tentukan jenis (stok / procurement / aset tetap) |
| **Supplier** | Master → Kontak (tipe Supplier) | Vendor/pemasok |
| **Gudang** | Master → Gudang | Lokasi penerimaan stok |
| **Satuan** | Master → Satuan | Unit beli (pcs, kg, box, dll.) |
| **Departemen** | Master → Departemen | Untuk cost center (jika diaktifkan) |
| **Outlet** | Master → Outlet | Cabang/lokasi (opsional) |
| **COA / Akun GL** | Master → Chart of Accounts | Wajib jika GL posting diaktifkan |
| **User & Role** | Pengaturan → User / Role | Hak akses per menu |

### 2.3 Jenis produk — penting dipahami sejak awal

Saat membuat produk di Master, tentukan **jenis baris pembelian**:

| Jenis | Contoh | Perilaku saat GR dikonfirmasi |
|-------|--------|-------------------------------|
| **Inventory (stok)** | Bahan baku, barang dagang | Stok gudang **bertambah** |
| **Procurement / non-inventory** | ATK, jasa cleaning | **Tidak** masuk stok gudang; dicatat sebagai biaya |
| **Fixed asset / aset tetap** | Laptop, mesin, furniture | Dibuat **kartu aset**, bukan stok gudang |

Centang di form produk:

- **Item procurement / non-inventory** → untuk barang habis pakai / jasa
- **Item aset tetap** → untuk barang yang perlu dicatat sebagai aset perusahaan

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### 2.1 Enable the Procurement module

The Procurement module is **not enabled by default** for every tenant/company.

**System admin / super admin** must:

1. Open **Company Settings** → application modules
2. Enable the **Procurement** module (`purchase`)
3. Ensure the relevant users have a **role** with the Procurement menu

Once enabled, users will see the **Procurement** tile/application on the KEA One desktop.

### 2.2 Required master data

Before the first transaction, complete the following data in the **Master** module:

| Master | Location | Notes |
|--------|--------|------------|
| **Products** | Master → Products | Items to purchase; set type (stock / procurement / fixed asset) |
| **Suppliers** | Master → Contacts (Supplier type) | Vendors/suppliers |
| **Warehouses** | Master → Warehouses | Stock receiving locations |
| **Units** | Master → Units | Purchase units (pcs, kg, box, etc.) |
| **Departments** | Master → Departments | For cost centers (if enabled) |
| **Outlets** | Master → Outlets | Branches/locations (optional) |
| **COA / GL Accounts** | Master → Chart of Accounts | Required if GL posting is enabled |
| **Users & Roles** | Settings → Users / Roles | Menu access permissions per user |

### 2.3 Product types — important to understand from the start

When creating a product in Master, set the **purchase line type**:

| Type | Example | Behavior when GR is confirmed |
|-------|--------|-------------------------------|
| **Inventory (stock)** | Raw materials, merchandise | Warehouse stock **increases** |
| **Procurement / non-inventory** | Office supplies, cleaning services | **Does not** enter warehouse stock; recorded as expense |
| **Fixed asset** | Laptop, machine, furniture | Creates an **asset card**, not warehouse stock |

Check the following on the product form:

- **Procurement / non-inventory item** → for consumables / services
- **Fixed asset item** → for items that must be recorded as company assets
</div>

---

## 3. Struktur Menu & Hak Akses / Menu Structure & Access Rights

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

Setelah masuk aplikasi **Pengadaan**, sidebar dibagi menjadi grup berikut. **Menu yang tampil bergantung pada pengaturan perusahaan dan hak role user.**

### Grup Overview (Ikhtisar)

| Menu | Fungsi |
|------|--------|
| **Dashboard** | Ringkasan antrian, spend bulan ini, alert |
| **Reports** | Laporan analitik (spend, aging, budget, dll.) |

### Grup Sourcing

| Menu | Fungsi | Syarat tampil |
|------|--------|---------------|
| **RFQ** | Request for Quotation | Setting RFQ aktif |
| **Vendor Price List** | Daftar harga kontrak supplier | Setting price list aktif |
| **Contracts** | Blanket PO / kontrak tahunan | Setting kontrak aktif |

### Grup Planning (Perencanaan)

| Menu | Fungsi | Syarat tampil |
|------|--------|---------------|
| **Procurement Plan** | Rencana belanja tahunan per dept | Setting annual plan aktif |

### Grup Operations (Operasional)

| Menu | Fungsi | Syarat tampil |
|------|--------|---------------|
| **Purchase Requisition** | PR | Flow = Strict PR→PO→GR |
| **Purchase Order** | PO | Flow = PO→GR atau Strict |
| **Goods Receipt** | GR dari PO | Flow = PO→GR atau Strict |
| **Direct Receipt** | Penerimaan langsung tanpa PO | Flow = Direct |
| **Purchase Return** | Retur ke supplier | Setting retur aktif |
| **Debit/Credit Note** | Koreksi harga/qty setelah GR | Setting adjustment aktif |
| **Delivery Schedule** | Jadwal kirim per PO | Setting delivery aktif + flow PO |

### Grup AP (Accounts Payable)

| Menu | Fungsi |
|------|--------|
| **Vendor Invoice** | Tagihan supplier |
| **Match Exceptions** | Selisih PO↔GR↔Invoice |
| **Payment Batch** | Batch pembayaran hutang |
| **Prepayment** | Uang muka ke supplier |
| **Withholding Tax** | Aturan & rekap PPh |

### Grup Finance

| Menu | Fungsi |
|------|--------|
| **GL Journals** | Jurnal otomatis dari procurement |
| **Budget** | Anggaran & komitmen |
| **Fixed Assets** | Kartu aset dari pembelian |

### Grup Settings

| Menu | Fungsi |
|------|--------|
| **Approval Matrix** | Aturan approver otomatis by amount/dept |
| **Approval Delegation** | Pengganti approver saat cuti |
| **Settings** | Semua toggle fitur procurement |

### Aplikasi Approval terpisah

Selain menu di Pengadaan, user approver juga bisa buka aplikasi **Approvals** di desktop untuk inbox persetujuan PR, PO, retur, invoice, dll.

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

After opening the **Procurement** application, the sidebar is divided into the following groups. **Menus shown depend on company settings and the user's role permissions.**

### Overview group

| Menu | Function |
|------|--------|
| **Dashboard** | Summary of queues, spend this month, alerts |
| **Reports** | Analytic reports (spend, aging, budget, etc.) |

### Sourcing group

| Menu | Function | Display requirement |
|------|--------|---------------|
| **RFQ** | Request for Quotation | RFQ setting enabled |
| **Vendor Price List** | Supplier contract price list | Price list setting enabled |
| **Contracts** | Blanket PO / annual contract | Contract setting enabled |

### Planning group

| Menu | Function | Display requirement |
|------|--------|---------------|
| **Procurement Plan** | Annual purchase plan per department | Annual plan setting enabled |

### Operations group

| Menu | Function | Display requirement |
|------|--------|---------------|
| **Purchase Requisition** | PR | Flow = Strict PR→PO→GR |
| **Purchase Order** | PO | Flow = PO→GR or Strict |
| **Goods Receipt** | GR from PO | Flow = PO→GR or Strict |
| **Direct Receipt** | Direct receipt without PO | Flow = Direct |
| **Purchase Return** | Return to supplier | Return setting enabled |
| **Debit/Credit Note** | Price/qty correction after GR | Adjustment setting enabled |
| **Delivery Schedule** | Delivery schedule per PO | Delivery setting enabled + PO flow |

### AP (Accounts Payable) group

| Menu | Function |
|------|--------|
| **Vendor Invoice** | Vendor invoice |
| **Match Exceptions** | PO↔GR↔Invoice discrepancies |
| **Payment Batch** | Payables payment batch |
| **Prepayment** | Advance payment to supplier |
| **Withholding Tax** | Withholding tax rules & summary |

### Finance group

| Menu | Function |
|------|--------|
| **GL Journals** | Automatic journals from procurement |
| **Budget** | Budget & commitments |
| **Fixed Assets** | Asset cards from purchases |

### Settings group

| Menu | Function |
|------|--------|
| **Approval Matrix** | Automatic approver rules by amount/department |
| **Approval Delegation** | Substitute approver while on leave |
| **Settings** | All procurement feature toggles |

### Separate Approvals application

In addition to menus in Procurement, approver users can also open the **Approvals** application on the desktop for an inbox of PR, PO, return, invoice, and other approvals.
</div>

---

## 4. Pengaturan Modul (Settings) / Module Settings (Settings)

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

Buka **Pengadaan → Settings**. Hanya user dengan hak `purchasesettings` (biasanya admin/manager) yang bisa mengubah.

### 4.1 Alur pembelian (Purchase Flow)

| Opsi | Arti | Menu yang muncul |
|------|------|------------------|
| **Direct** | Langsung terima barang tanpa PR/PO | Direct Receipt saja |
| **PO → GR** | Buat PO dulu, lalu terima barang | PO + GR |
| **Strict PR → PO → GR** | Wajib PR disetujui dulu, baru PO, baru GR | PR + PO + GR |

> **Rekomendasi:**  
> - Toko/resto kecil → **Direct**  
> - Perusahaan dengan kontrol purchasing → **PO → GR**  
> - Perusahaan dengan kontrol dept + approval ketat → **Strict PR → PO → GR**

### 4.2 Approval

| Setting | Default | Keterangan |
|---------|---------|------------|
| PR wajib approval | Off | PR harus disetujui sebelum jadi PO |
| PO wajib approval | Off | PO harus disetujui sebelum di-order ke supplier |
| Retur wajib approval | Off | Retur perlu persetujuan |
| Invoice wajib approval | Off | Tagihan supplier perlu approval |
| Payment batch wajib approval | Off | Batch bayar perlu approval |
| Prepayment wajib approval | Off | Uang muka perlu approval |
| **Mode approval** | Manual | `manual` = pilih approver saat submit; `matrix` = otomatis dari Approval Matrix |
| Parallel approval | Off | Beberapa approver satu level (semua harus setuju) |
| Delegation | Off | Izinkan pengganti approver |
| Escalation / SLA | Off | Auto-eskalasi jika pending > X hari |
| SLA hari | 3 | Batas hari sebelum eskalasi |
| SoD: creator ≠ approver | On | Pembuat dokumen tidak boleh approve sendiri |
| SoD: approver ≠ receiver | Off | Approver tidak boleh konfirmasi GR |
| Field audit | On | Catat history perubahan qty/harga |

### 4.3 Fitur operasional

| Setting | Default | Keterangan |
|---------|---------|------------|
| Update harga pokok saat GR | On | `cost_price` produk diupdate dari GR |
| Auto-close PO saat full receive | On | PO otomatis `received` jika semua qty diterima |
| Retur pembelian | On | Aktifkan menu Purchase Return |
| GR reversal (void) | Off | Batalkan GR yang sudah confirmed |
| Debit/Credit note | On | Koreksi setelah GR |
| Delivery schedule | On | Jadwal kirim per PO |
| Lampiran dokumen | On | Upload quotation, foto, PDF |
| Cost center / dept | On | Field departemen di PR/PO |

### 4.4 Fitur keuangan (Finance)

| Setting | Default | Keterangan |
|---------|---------|------------|
| Vendor invoice (AP) | Off | Aktifkan hutang supplier |
| 3-way match | Off | Cocokkan PO ↔ GR ↔ Invoice |
| 2-way match | Off | Cocokkan PO ↔ Invoice (jasa/non-stock) |
| Toleransi qty match (%) | 0 | Selisih qty yang masih diterima |
| Toleransi harga match (%) | 0 | Selisih harga yang masih diterima |
| Payment batch | Off | Batch pembayaran supplier |
| Prepayment | Off | Uang muka supplier |
| Withholding tax (PPh) | Off | Potong PPh 23/22/4(2) |
| GL posting otomatis | Off | Buat jurnal saat GR/invoice/payment |
| Budget check | Off | Cek anggaran saat submit PR/PO |

### 4.5 Fitur sourcing & perencanaan

| Setting | Default | Keterangan |
|---------|---------|------------|
| RFQ | Off | Request for Quotation |
| Vendor price list | Off | Harga kontrak per supplier×produk |
| Contract / Blanket PO | Off | Kontrak tahunan |
| Auto-reorder | Off | Generate PR draft dari reorder point |
| Demand planning | Off | Forecast → suggested PR |
| Annual procurement plan | Off | Rencana beli per dept/tahun |
| Landed cost | Off | Freight/customs dialokasikan ke item GR |

### 4.6 Mapping akun GL

Jika GL posting aktif, isi akun COA untuk:

- Persediaan (inventory)
- GRNI (Goods Received Not Invoiced)
- Hutang usaha (AP)
- PPN Masukan
- Kas / Bank
- Hutang PPh
- Beban langsung (expense)
- Aset tetap

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

Open **Procurement → Settings**. Only users with the `purchasesettings` permission (usually admin/manager) can make changes.

### 4.1 Purchase flow

| Option | Meaning | Menus that appear |
|------|------|------------------|
| **Direct** | Receive goods directly without PR/PO | Direct Receipt only |
| **PO → GR** | Create PO first, then receive goods | PO + GR |
| **Strict PR → PO → GR** | PR must be approved first, then PO, then GR | PR + PO + GR |

> **Recommendation:**  
> - Small shop/restaurant → **Direct**  
> - Company with purchasing control → **PO → GR**  
> - Company with department control + strict approval → **Strict PR → PO → GR**

### 4.2 Approval

| Setting | Default | Notes |
|---------|---------|------------|
| PR requires approval | Off | PR must be approved before becoming PO |
| PO requires approval | Off | PO must be approved before ordering to supplier |
| Return requires approval | Off | Return needs approval |
| Invoice requires approval | Off | Vendor invoice needs approval |
| Payment batch requires approval | Off | Payment batch needs approval |
| Prepayment requires approval | Off | Prepayment needs approval |
| **Approval mode** | Manual | `manual` = select approver on submit; `matrix` = automatic from Approval Matrix |
| Parallel approval | Off | Multiple approvers at one level (all must agree) |
| Delegation | Off | Allow substitute approver |
| Escalation / SLA | Off | Auto-escalate if pending > X days |
| SLA days | 3 | Day limit before escalation |
| SoD: creator ≠ approver | On | Document creator cannot approve their own document |
| SoD: approver ≠ receiver | Off | Approver cannot confirm GR |
| Field audit | On | Record history of qty/price changes |

### 4.3 Operational features

| Setting | Default | Notes |
|---------|---------|------------|
| Update cost price on GR | On | Product `cost_price` updated from GR |
| Auto-close PO on full receive | On | PO automatically becomes `received` if all qty received |
| Purchase return | On | Enable Purchase Return menu |
| GR reversal (void) | Off | Cancel confirmed GR |
| Debit/Credit note | On | Correction after GR |
| Delivery schedule | On | Delivery schedule per PO |
| Document attachments | On | Upload quotation, photo, PDF |
| Cost center / department | On | Department field on PR/PO |

### 4.4 Finance features

| Setting | Default | Notes |
|---------|---------|------------|
| Vendor invoice (AP) | Off | Enable vendor payables |
| 3-way match | Off | Match PO ↔ GR ↔ Invoice |
| 2-way match | Off | Match PO ↔ Invoice (services/non-stock) |
| Qty match tolerance (%) | 0 | Qty variance still accepted |
| Price match tolerance (%) | 0 | Price variance still accepted |
| Payment batch | Off | Supplier payment batch |
| Prepayment | Off | Supplier prepayment |
| Withholding tax (PPh) | Off | Withhold PPh 23/22/4(2) |
| Automatic GL posting | Off | Create journal on GR/invoice/payment |
| Budget check | Off | Check budget on PR/PO submit |

### 4.5 Sourcing & planning features

| Setting | Default | Notes |
|---------|---------|------------|
| RFQ | Off | Request for Quotation |
| Vendor price list | Off | Contract price per supplier×product |
| Contract / Blanket PO | Off | Annual contract |
| Auto-reorder | Off | Generate PR draft from reorder point |
| Demand planning | Off | Forecast → suggested PR |
| Annual procurement plan | Off | Purchase plan per dept/year |
| Landed cost | Off | Freight/customs allocated to GR items |

### 4.6 GL account mapping

If GL posting is active, fill in COA accounts for:

- Inventory
- GRNI (Goods Received Not Invoiced)
- Accounts payable (AP)
- Input VAT (PPN Masukan)
- Cash / Bank
- Withholding tax payable
- Direct expense
- Fixed assets
</div>

---

## 5. Tiga Mode Alur Pembelian / Three Purchase Flow Modes

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### Mode A — Direct (Penerimaan Langsung)

```
Supplier → Direct Receipt (GR) → Stok / Expense / Aset
```

**Kapan dipakai:** Resto, retail kecil, pembelian ad-hoc.

**Langkah user:**
1. Buka **Direct Receipt**
2. Pilih supplier (wajib)
3. Tambah baris produk + qty + harga
4. Simpan draft → **Confirm**
5. Stok bertambah (jika produk track stock)

---

### Mode B — PO → GR

```
PO (draft) → Submit/Approve → Order → GR → Confirm → Stok
```

**Kapan dipakai:** Perusahaan yang sudah punya proses PO ke supplier.

**Langkah user:**
1. Buat **PO** → isi supplier & baris
2. Submit ( + approval jika aktif )
3. Klik **Order** — PO status jadi `ordered`
4. Saat barang datang, buat **GR** dari PO
5. **Confirm** GR → stok masuk

---

### Mode C — Strict PR → PO → GR

```
PR → Approve → PO (dari PR) → Order → GR → Confirm
```

**Kapan dipakai:** Multi-departemen, kontrol budget & approval ketat.

**Langkah user:**
1. Dept/staff buat **PR**
2. Submit → approver setujui
3. Purchasing buat **PO** dari PR approved (bisa split per supplier)
4. Order PO ke supplier
5. Gudang buat **GR** saat barang tiba
6. Confirm GR

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### Mode A — Direct (Direct Receipt)

```
Supplier → Direct Receipt (GR) → Stock / Expense / Asset
```

**When to use:** Restaurant, small retail, ad-hoc purchases.

**User steps:**
1. Open **Direct Receipt**
2. Select supplier (required)
3. Add product lines + qty + price
4. Save draft → **Confirm**
5. Stock increases (if product tracks stock)

---

### Mode B — PO → GR

```
PO (draft) → Submit/Approve → Order → GR → Confirm → Stock
```

**When to use:** Companies that already have a PO process with suppliers.

**User steps:**
1. Create **PO** → fill supplier & lines
2. Submit (+ approval if enabled)
3. Click **Order** — PO status becomes `ordered`
4. When goods arrive, create **GR** from PO
5. **Confirm** GR → stock received

---

### Mode C — Strict PR → PO → GR

```
PR → Approve → PO (from PR) → Order → GR → Confirm
```

**When to use:** Multi-department, strict budget & approval control.

**User steps:**
1. Department/staff create **PR**
2. Submit → approver approves
3. Purchasing create **PO** from approved PR (can split per supplier)
4. Order PO to supplier
5. Warehouse create **GR** when goods arrive
6. Confirm GR
</div>

---

## 6. Alur Kerja End-to-End / End-to-End Workflow

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

Diagram lengkap modul Pengadaan (semua fitur aktif):

```
[Perencanaan]          [Sourcing]              [Operasional]           [Keuangan]
     │                      │                       │                      │
 Rencana Tahunan      RFQ → Quote            PR → PO → GR            Vendor Invoice
 Auto-reorder         Price List                  │                      │
 Demand Forecast      Contract                    ├→ Return              3-Way Match
     │                      │                     ├→ Adjustment               │
     └──────────→ PR ←─────┘                     └→ Delivery          Payment Batch
                                                          │              Prepayment
                                                          └────────→ GL Journal
```

### Urutan implementasi yang disarankan untuk perusahaan baru

| Tahap | Aktifkan | User yang terlibat |
|-------|----------|-------------------|
| **1** | Direct atau PO→GR, supplier, produk | Gudang, purchasing |
| **2** | PR + approval, retur | Dept head, manager |
| **3** | Vendor invoice + 3-way match | AP / finance |
| **4** | Payment batch, PPh, GL | Finance |
| **5** | RFQ, budget, matrix approval | Manager, director |
| **6** | Planning, reports, vendor portal | Strategic procurement |

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

Complete Procurement module diagram (all features enabled):

```
[Planning]          [Sourcing]              [Operations]           [Finance]
     │                      │                       │                      │
 Annual Plan         RFQ → Quote            PR → PO → GR            Vendor Invoice
 Auto-reorder         Price List                  │                      │
 Demand Forecast      Contract                    ├→ Return              3-Way Match
     │                      │                     ├→ Adjustment               │
     └──────────→ PR ←─────┘                     └→ Delivery          Payment Batch
                                                          │              Prepayment
                                                          └────────→ GL Journal
```

### Recommended implementation sequence for a new company

| Phase | Enable | Users involved |
|-------|----------|-------------------|
| **1** | Direct or PO→GR, supplier, product | Warehouse, purchasing |
| **2** | PR + approval, return | Department head, manager |
| **3** | Vendor invoice + 3-way match | AP / finance |
| **4** | Payment batch, withholding tax, GL | Finance |
| **5** | RFQ, budget, matrix approval | Manager, director |
| **6** | Planning, reports, vendor portal | Strategic procurement |
</div>

---

## 7. Dashboard Pengadaan / Procurement Dashboard

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Lokasi:** Pengadaan → Dashboard

Dashboard menampilkan snapshot operasional:

### Kartu ringkasan (contoh)

| Metrik | Arti |
|--------|------|
| **Spend MTD** | Total belanja bulan berjalan (dari GR confirmed) |
| **PR Draft / Submitted** | PR menunggu dilanjutkan / disetujui |
| **PO Draft / Submitted / Open** | PO dalam proses |
| **PO Overdue** | PO sudah ordered tapi belum diterima melewati jadwal |
| **GR Draft** | Penerimaan belum dikonfirmasi |
| **Return Submitted** | Retur menunggu approval |
| **Invoice Draft / Payable** | Tagihan belum/lunas |
| **Match Exception Open** | Selisih match belum diselesaikan |
| **Delivery Overdue** | Jadwal kirim terlambat |

### Widget tambahan (jika fitur aktif)

- **Auto-reorder preview** — produk di bawah reorder point
- **Demand forecast** — saran PR dari perencanaan
- **Vendor compliance alerts** — dokumen supplier (SIUP/NPWP) expired

Klik baris **Recent activity** untuk loncat ke dokumen terkait.

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Location:** Procurement → Dashboard

The dashboard displays an operational snapshot:

### Summary cards (examples)

| Metric | Meaning |
|--------|------|
| **Spend MTD** | Total spend in the current month (from confirmed GR) |
| **PR Draft / Submitted** | PR waiting to proceed / be approved |
| **PO Draft / Submitted / Open** | PO in process |
| **PO Overdue** | PO already ordered but not yet received past schedule |
| **GR Draft** | Receipt not yet confirmed |
| **Return Submitted** | Return waiting for approval |
| **Invoice Draft / Payable** | Invoice unpaid/outstanding |
| **Match Exception Open** | Unresolved match discrepancy |
| **Delivery Overdue** | Delivery schedule overdue |

### Additional widgets (if feature enabled)

- **Auto-reorder preview** — products below reorder point
- **Demand forecast** — suggested PR from planning
- **Vendor compliance alerts** — expired supplier documents (SIUP/NPWP)

Click a **Recent activity** row to jump to the related document.
</div>

---

## 8. Master Data Pendukung / Supporting Master Data

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### 8.1 Supplier (Pemasok)

**Lokasi:** Master → Kontak → tipe **Supplier**

Isi minimal:
- Nama, telepon, alamat
- NPWP (jika ada)
- Payment term (tempo bayar)
- Tax type (PKP/non-PKP)

Fitur vendor management (jika digunakan):
- **Tier:** Strategic / Preferred / One-time
- **Status onboarding:** Pending / Approved
- **Status vendor:** Active / Suspended / Blacklisted
- **Dokumen legal:** SIUP, NPWP, PKP + tanggal expired
- **Portal token:** Link portal supplier

> Supplier yang **suspended** atau **blacklisted** tidak bisa dipilih di PO baru.

### 8.2 Produk untuk pembelian

Produk muncul di picker PR/PO/RFQ jika:
- Kategori = bahan baku (**raw material**), ATAU
- Centang **Item procurement / non-inventory**, ATAU
- Centang **Item aset tetap**

### 8.3 Departemen & Cost Center

Jika **Cost center enabled**, field **Departemen** muncul di header PR/PO. Berguna untuk:
- Laporan spend per dept
- Budget check per dept
- Approval matrix per dept

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### 8.1 Supplier (Vendor)

**Location:** Master → Contacts → **Supplier** type

Minimum fields:
- Name, phone, address
- Tax ID / NPWP (if applicable)
- Payment term
- Tax type (PKP/non-PKP)

Vendor management features (if used):
- **Tier:** Strategic / Preferred / One-time
- **Onboarding status:** Pending / Approved
- **Vendor status:** Active / Suspended / Blacklisted
- **Legal documents:** SIUP, NPWP, PKP + expiry date
- **Portal token:** Supplier portal link

> Suppliers that are **suspended** or **blacklisted** cannot be selected on new POs.

### 8.2 Products for purchasing

Products appear in the PR/PO/RFQ picker if:
- Category = raw material, OR
- **Procurement / non-inventory item** is checked, OR
- **Fixed asset item** is checked

### 8.3 Department & Cost Center

If **Cost center enabled**, the **Department** field appears on the PR/PO header. Useful for:
- Spend reports per department
- Budget check per department
- Approval matrix per department
</div>

---

## 9. Sourcing — RFQ, Price List, Kontrak / Sourcing — RFQ, Price List, Contract

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### 9.1 RFQ (Request for Quotation)

**Aktifkan dulu:** Settings → RFQ enabled

**Langkah membuat RFQ:**

1. Buka **Pengadaan → RFQ**
2. Klik **Buat baru**
3. Isi:
   - Judul / referensi
   - Tanggal deadline quote
   - Baris item (produk, qty, spesifikasi)
   - Supplier yang diajak (multi supplier)
4. Simpan → **Submit** / kirim ke supplier (via share link jika ada)
5. Supplier mengisi **Vendor Quote** (penawaran harga)
6. Buka **Quote Comparison** — banding harga side-by-side
7. Pilih **winner** → buat **PR** atau **PO** dari quote terpilih

**Status RFQ tipikal:** `draft` → `open` → `closed` / `cancelled`

---

### 9.2 Vendor Price List

**Aktifkan dulu:** Settings → Vendor price list enabled

Menyimpan **harga kontrak** per kombinasi supplier × produk.

**Manfaat:**
- Saat buat PO, harga otomatis terisi dari price list
- Kontrol price variance di laporan

**Langkah:**
1. Buka **Vendor Price List**
2. Pilih supplier + produk
3. Isi harga, satuan, periode berlaku (valid from/to)
4. Simpan

---

### 9.3 Kontrak / Blanket PO

**Aktifkan dulu:** Settings → Contract enabled

Untuk pembelian **kontraktual** (misal: kontrak tahunan ATK dengan 1 supplier).

**Alur:**
1. Buat **Contract** — supplier, nilai kontrak, periode
2. Tambah baris item / kategori
3. **Release PO** — buat PO partial dari sisa kontrak per periode
4. PO released mengurangi **remaining value** kontrak

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### 9.1 RFQ (Request for Quotation)

**Enable first:** Settings → RFQ enabled

**Steps to create an RFQ:**

1. Open **Procurement → RFQ**
2. Click **Create new**
3. Fill in:
   - Title / reference
   - Quote deadline date
   - Line items (product, qty, specification)
   - Invited suppliers (multiple suppliers)
4. Save → **Submit** / send to supplier (via share link if available)
5. Supplier fills in **Vendor Quote** (price quotation)
6. Open **Quote Comparison** — compare prices side-by-side
7. Select **winner** → create **PR** or **PO** from selected quote

**Typical RFQ status:** `draft` → `open` → `closed` / `cancelled`

---

### 9.2 Vendor Price List

**Enable first:** Settings → Vendor price list enabled

Stores **contract prices** per supplier × product combination.

**Benefits:**
- When creating PO, price is automatically filled from price list
- Control price variance in reports

**Steps:**
1. Open **Vendor Price List**
2. Select supplier + product
3. Fill in price, unit, valid period (valid from/to)
4. Save

---

### 9.3 Contract / Blanket PO

**Enable first:** Settings → Contract enabled

For **contractual** purchases (e.g., annual office supplies contract with one supplier).

**Flow:**
1. Create **Contract** — supplier, contract value, period
2. Add line items / categories
3. **Release PO** — create partial PO from remaining contract per period
4. Released PO reduces contract **remaining value**
</div>

---

## 10. Perencanaan — Rencana Tahunan & Demand Planning / Planning — Annual Plan & Demand Planning

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### 10.1 Rencana Pengadaan Tahunan (Annual Plan)

**Aktifkan:** Settings → Annual procurement plan

1. Buka **Procurement Plan**
2. Buat rencana per **tahun** dan **departemen**
3. Isi baris: produk/kategori, qty estimasi, budget estimasi
4. Status: `draft` → `approved` → `active`
5. Saat buat PR, bisa refer ke baris rencana (jika diimplementasi di form)

### 10.2 Auto-reorder

**Aktifkan:** Settings → Auto-reorder

- Sistem cek produk dengan stok ≤ **reorder point**
- Dashboard menampilkan preview
- Bisa generate **PR draft** otomatis

### 10.3 Demand Planning / Forecast

**Aktifkan:** Settings → Demand planning

- Input forecast qty per produk × gudang × periode
- Sistem suggest kebutuhan pembelian
- Purchasing review → buat PR

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### 10.1 Annual Procurement Plan

**Enable:** Settings → Annual procurement plan

1. Open **Procurement Plan**
2. Create plan per **year** and **department**
3. Fill lines: product/category, estimated qty, estimated budget
4. Status: `draft` → `approved` → `active`
5. When creating PR, you can reference plan lines (if implemented in the form)

### 10.2 Auto-reorder

**Enable:** Settings → Auto-reorder

- System checks products with stock ≤ **reorder point**
- Dashboard shows preview
- Can generate **PR draft** automatically

### 10.3 Demand Planning / Forecast

**Enable:** Settings → Demand planning

- Input forecast qty per product × warehouse × period
- System suggests purchase requirements
- Purchasing reviews → create PR
</div>

---

## 11. Purchase Requisition (PR) / Purchase Requisition (PR)

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Purchase Requisition  
**Hanya tampil jika flow = Strict PR → PO → GR**

### 11.1 Kapan membuat PR?

- Dept butuh barang/jasa, belum tentu supplier
- Butuh approval manager sebelum purchasing order
- Budget check sebelum komitmen

### 11.2 Langkah membuat PR

1. Klik **+ Buat PR**
2. Isi header:
   - **Outlet** (opsional)
   - **Departemen** (jika cost center aktif)
   - **Catatan** / keperluan
3. Tambah **baris item:**
   - Produk
   - Qty + satuan
   - Estimasi harga (opsional)
   - Catatan per baris
4. **Lampiran** (opsional) — quotation, spec
5. Jika approval aktif:
   - Mode **manual:** pilih approver (urutan = level 1, 2, 3…)
   - Mode **matrix:** approver otomatis
6. Simpan **Draft**

### 11.3 Status PR

| Status | Arti | Aksi tersedia |
|--------|------|---------------|
| `draft` | Masih diedit | Submit, Cancel |
| `submitted` | Menunggu approval | Approve, Reject (approver) |
| `approved` | Disetujui | Bisa dibuat PO |
| `rejected` | Ditolak | Edit & submit ulang |
| `cancelled` | Dibatalkan | — |

### 11.4 Aturan approval PR

- Approver **boleh mengurangi qty** atau **menghapus baris**
- Approver **tidak boleh menaikkan qty**
- Jika **budget check** aktif, submit gagal jika melebihi anggaran dept

### 11.5 Setelah PR approved

1. Buka **Approved PR → PO Board** (atau dari detail PR)
2. Pilih baris PR yang akan di-PO
3. Tentukan **supplier per baris** (bisa beda supplier → split jadi beberapa PO)
4. Sistem buat **PO draft** otomatis

### 11.6 Share PR

- **PDF** — download / print
- **WhatsApp** — kirim link
- **Public link** — supplier/internal tanpa login (read-only)

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Purchase Requisition  
**Only shown if flow = Strict PR → PO → GR**

### 11.1 When to create a PR?

- Department needs goods/services, supplier not yet determined
- Manager approval required before purchasing orders
- Budget check before commitment

### 11.2 Steps to create a PR

1. Click **+ Create PR**
2. Fill header:
   - **Outlet** (optional)
   - **Department** (if cost center enabled)
   - **Notes** / purpose
3. Add **line items:**
   - Product
   - Qty + unit
   - Estimated price (optional)
   - Notes per line
4. **Attachments** (optional) — quotation, spec
5. If approval enabled:
   - **Manual** mode: select approver (order = level 1, 2, 3…)
   - **Matrix** mode: approver automatic
6. Save **Draft**

### 11.3 PR status

| Status | Meaning | Available actions |
|--------|------|---------------|
| `draft` | Still being edited | Submit, Cancel |
| `submitted` | Waiting for approval | Approve, Reject (approver) |
| `approved` | Approved | Can create PO |
| `rejected` | Rejected | Edit & resubmit |
| `cancelled` | Cancelled | — |

### 11.4 PR approval rules

- Approver **may reduce qty** or **delete lines**
- Approver **may not increase qty**
- If **budget check** is enabled, submit fails if it exceeds department budget

### 11.5 After PR is approved

1. Open **Approved PR → PO Board** (or from PR detail)
2. Select PR lines to convert to PO
3. Set **supplier per line** (different suppliers → split into multiple POs)
4. System creates **PO draft** automatically

### 11.6 Share PR

- **PDF** — download / print
- **WhatsApp** — send link
- **Public link** — supplier/internal without login (read-only)
</div>

---

## 12. Purchase Order (PO) / Purchase Order (PO)

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Purchase Order

### 12.1 Cara membuat PO

| Cara | Keterangan |
|------|------------|
| **Manual** | Buat PO baru, pilih supplier, isi baris |
| **Dari PR approved** | Board PR → PO, auto-split per supplier |
| **Dari RFQ winner** | Quote terpilih → PO |
| **Dari Contract release** | Release PO dari kontrak |
| **Dari Price list** | Harga terisi otomatis |

### 12.2 Langkah membuat PO manual

1. Klik **+ Buat PO**
2. Pilih **Supplier** (wajib)
3. Isi header: outlet, dept, expected date, catatan
4. Tambah baris: produk, qty, harga, diskon, satuan
5. Tax & payment term **snapshot** dari supplier
6. Lampiran (quotation PDF)
7. Jadwal delivery (jika aktif) — per baris atau per PO
8. Pilih approver (jika manual approval)
9. Simpan draft

### 12.3 Status PO

| Status | Arti | Aksi |
|--------|------|------|
| `draft` | Draft | Submit / Order / Cancel |
| `submitted` | Menunggu approval | Approve / Reject |
| `approved` | Disetujui | **Order** ke supplier |
| `ordered` | Sudah dikirim ke supplier | Buat GR, Close, Cancel |
| `partial` | Sebagian sudah diterima | Buat GR sisa, Close |
| `received` | Semua qty diterima | — |
| `rejected` | Ditolak | — |
| `cancelled` | Dibatalkan | — |

### 12.4 Tombol penting

| Tombol | Fungsi |
|--------|--------|
| **Submit** | Kirim untuk approval |
| **Approve / Reject** | Keputusan approver |
| **Order** | Tandai PO sudah dikirim ke supplier |
| **Close** | Tutup PO partial — stop penerimaan sisa |
| **Cancel** | Batalkan PO |

### 12.5 Partial receiving

- Setiap GR menambah `qty_received` per baris PO
- PO status otomatis `partial` jika belum full
- Jika **auto-close on full receive** aktif → PO jadi `received` saat qty penuh

### 12.6 Share PO ke supplier

- PDF, WhatsApp, public link
- Supplier bisa lihat detail PO via link
- Jika **vendor portal** aktif, supplier login via token untuk konfirmasi & upload invoice

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Purchase Order

### 12.1 How to create a PO

| Method | Notes |
|------|------------|
| **Manual** | Create new PO, select supplier, fill lines |
| **From approved PR** | PR Board → PO, auto-split per supplier |
| **From RFQ winner** | Selected quote → PO |
| **From Contract release** | Release PO from contract |
| **From Price list** | Price filled automatically |

### 12.2 Steps to create a manual PO

1. Click **+ Create PO**
2. Select **Supplier** (required)
3. Fill header: outlet, department, expected date, notes
4. Add lines: product, qty, price, discount, unit
5. Tax & payment term **snapshot** from supplier
6. Attachments (quotation PDF)
7. Delivery schedule (if enabled) — per line or per PO
8. Select approver (if manual approval)
9. Save draft

### 12.3 PO status

| Status | Meaning | Actions |
|--------|------|------|
| `draft` | Draft | Submit / Order / Cancel |
| `submitted` | Waiting for approval | Approve / Reject |
| `approved` | Approved | **Order** to supplier |
| `ordered` | Already sent to supplier | Create GR, Close, Cancel |
| `partial` | Partially received | Create remaining GR, Close |
| `received` | All qty received | — |
| `rejected` | Rejected | — |
| `cancelled` | Cancelled | — |

### 12.4 Important buttons

| Button | Function |
|--------|--------|
| **Submit** | Send for approval |
| **Approve / Reject** | Approver decision |
| **Order** | Mark PO as sent to supplier |
| **Close** | Close partial PO — stop remaining receipt |
| **Cancel** | Cancel PO |

### 12.5 Partial receiving

- Each GR adds `qty_received` per PO line
- PO status automatically becomes `partial` if not fully received
- If **auto-close on full receive** is enabled → PO becomes `received` when qty is complete

### 12.6 Share PO with supplier

- PDF, WhatsApp, public link
- Supplier can view PO detail via link
- If **vendor portal** is enabled, supplier logs in via token to confirm & upload invoice
</div>

---

## 13. Goods Receipt (GR) & Penerimaan Langsung / Goods Receipt (GR) & Direct Receipt

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### 13.1 GR dari PO

**Menu:** Pengadaan → Goods Receipt

1. Klik **+ Buat GR** atau **GR dari PO**
2. Pilih PO berstatus `ordered` atau `partial`
3. Baris PO muncul — isi **qty diterima** (boleh partial)
4. Pilih **gudang** tujuan
5. Scan barcode (jika pakai scanner)
6. **Landed cost** (jika aktif) — tambah freight/customs, dialokasikan ke baris
7. Simpan draft → **Confirm**

**Saat Confirm:**
- Stok gudang **+qty** (jika produk track stock)
- `cost_price` produk diupdate (jika setting aktif)
- PO `qty_received` terupdate
- Produk **procurement item** → tidak masuk stok, catat expense
- Produk **fixed asset** → buat kartu aset
- GL journal (jika GL posting aktif)
- Trigger 3-way match (jika AP aktif)

### 13.2 Direct Receipt

**Menu:** Pengadaan → Direct Receipt (flow = Direct)

Sama seperti GR tapi **tanpa PO**:
- Supplier wajib dipilih
- Langsung confirm → stok/expense/aset

### 13.3 Status GR

| Status | Arti |
|--------|------|
| `draft` | Belum final |
| `confirmed` | Penerimaan final, stok terupdate |
| `cancelled` | Dibatalkan saat masih draft |

### 13.4 GR Reversal (Void)

**Aktifkan:** Settings → GR reversal enabled

- Batalkan GR yang sudah **confirmed**
- Stok di-rollback
- PO `qty_received` dikurangi
- Hati-hati: gunakan hanya jika benar-benar salah input

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### 13.1 GR from PO

**Menu:** Procurement → Goods Receipt

1. Click **+ Create GR** or **GR from PO**
2. Select PO with status `ordered` or `partial`
3. PO lines appear — fill in **qty received** (partial allowed)
4. Select destination **warehouse**
5. Scan barcode (if using scanner)
6. **Landed cost** (if enabled) — add freight/customs, allocated to lines
7. Save draft → **Confirm**

**On Confirm:**
- Warehouse stock **+qty** (if product tracks stock)
- Product `cost_price` updated (if setting enabled)
- PO `qty_received` updated
- **Procurement item** product → does not enter stock, records expense
- **Fixed asset** product → creates asset card
- GL journal (if GL posting enabled)
- Triggers 3-way match (if AP enabled)

### 13.2 Direct Receipt

**Menu:** Procurement → Direct Receipt (flow = Direct)

Same as GR but **without PO**:
- Supplier must be selected
- Confirm directly → stock/expense/asset

### 13.3 GR status

| Status | Meaning |
|--------|------|
| `draft` | Not yet final |
| `confirmed` | Final receipt, stock updated |
| `cancelled` | Cancelled while still draft |

### 13.4 GR Reversal (Void)

**Enable:** Settings → GR reversal enabled

- Cancel GR that is already **confirmed**
- Stock is rolled back
- PO `qty_received` is reduced
- Caution: use only if input was truly incorrect
</div>

---

## 14. Retur Pembelian (Purchase Return) / Purchase Return

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Purchase Return  
**Aktifkan:** Settings → Return enabled

### Kapan dipakai?

- Barang rusak / salah kirim
- Return ke supplier setelah GR

### Langkah

1. Buat **Purchase Return**
2. Referensi **GR confirmed** atau **PO**
3. Pilih baris + qty retur
4. Submit → approval (jika aktif)
5. **Confirm** retur → stok **berkurang**

### Status

`draft` → `submitted` → `approved` → `confirmed` / `rejected` / `cancelled`

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Purchase Return  
**Enable:** Settings → Return enabled

### When to use?

- Damaged goods / wrong delivery
- Return to supplier after GR

### Steps

1. Create **Purchase Return**
2. Reference **confirmed GR** or **PO**
3. Select lines + return qty
4. Submit → approval (if enabled)
5. **Confirm** return → stock **decreases**

### Status

`draft` → `submitted` → `approved` → `confirmed` / `rejected` / `cancelled`
</div>

---

## 15. Nota Debit / Kredit Supplier / Supplier Debit / Credit Notes

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Debit/Credit Note  
**Aktifkan:** Settings → Vendor adjustment enabled

### Kapan dipakai?

- Supplier kurang kirim → **credit note** (kredit hutang)
- Supplier charge extra → **debit note**
- Koreksi harga setelah GR tanpa retur fisik

### Langkah

1. Buat nota, pilih supplier
2. Link ke GR / Invoice (opsional)
3. Isi baris koreksi (+/- amount)
4. Confirm → adjust hutung / match

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Debit/Credit Note  
**Enable:** Settings → Vendor adjustment enabled

### When to use?

- Supplier under-delivered → **credit note** (credit payables)
- Supplier charged extra → **debit note**
- Price correction after GR without physical return

### Steps

1. Create note, select supplier
2. Link to GR / Invoice (optional)
3. Fill correction lines (+/- amount)
4. Confirm → adjust payables / match
</div>

---

## 16. Jadwal Pengiriman (Delivery Schedule) / Delivery Schedule

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Delivery Schedule  
**Syarat:** Delivery enabled + flow PO

### Fungsi

- Jadwalkan **tanggal kirim** per PO atau per baris
- Dashboard alert **delivery overdue**
- Gudang tahu kapan harus siap terima

### Langkah

1. Dari detail PO → panel **Delivery Schedule**, atau
2. Menu Delivery Schedule → buat jadwal linked ke PO
3. Isi expected date, qty, catatan
4. Update status saat barang datang / terlambat

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Delivery Schedule  
**Requirement:** Delivery enabled + PO flow

### Function

- Schedule **delivery date** per PO or per line
- Dashboard **delivery overdue** alert
- Warehouse knows when to prepare for receipt

### Steps

1. From PO detail → **Delivery Schedule** panel, or
2. Delivery Schedule menu → create schedule linked to PO
3. Fill expected date, qty, notes
4. Update status when goods arrive / are late
</div>

---

## 17. Tagihan Supplier (Vendor Invoice / AP) / Vendor Invoice (Vendor Invoice / AP)

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Vendor Invoice  
**Aktifkan:** Settings → Vendor invoice enabled

### 17.1 Alur AP

```
PO + GR → Supplier kirim invoice → Input AP → Match → Approve → Payment
```

### 17.2 Cara input invoice

| Cara | Keterangan |
|------|------------|
| **Manual** | Buat invoice, pilih supplier, isi baris |
| **Dari PO/GR** | Pull qty & harga referensi |
| **Vendor portal** | Supplier upload PDF sendiri |

### 17.3 Langkah manual

1. **+ Buat Vendor Invoice**
2. Pilih supplier
3. Isi: nomor faktur supplier, tanggal, jatuh tempo
4. Baris: produk/jasa, qty, harga, PPN
5. Link ke PO / GR ( untuk 3-way match )
6. Lampiran scan faktur
7. Submit → approval (jika aktif)

### 17.4 Status invoice

| Status | Arti |
|--------|------|
| `draft` | Draft |
| `submitted` | Menunggu approval |
| `approved` | Disetujui, siap match/bayar |
| `matched` | Sudah match dengan PO/GR |
| `partially_paid` | Sebagian sudah dibayar |
| `paid` | Lunas |
| `rejected` / `cancelled` | Ditolak / batal |

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Vendor Invoice  
**Enable:** Settings → Vendor invoice enabled

### 17.1 AP flow

```
PO + GR → Supplier sends invoice → Input AP → Match → Approve → Payment
```

### 17.2 How to input invoice

| Method | Notes |
|------|------------|
| **Manual** | Create invoice, select supplier, fill lines |
| **From PO/GR** | Pull qty & price reference |
| **Vendor portal** | Supplier uploads PDF themselves |

### 17.3 Manual steps

1. **+ Create Vendor Invoice**
2. Select supplier
3. Fill in: supplier invoice number, date, due date
4. Lines: product/service, qty, price, VAT
5. Link to PO / GR (for 3-way match)
6. Attach scanned invoice
7. Submit → approval (if enabled)

### 17.4 Invoice status

| Status | Meaning |
|--------|------|
| `draft` | Draft |
| `submitted` | Waiting for approval |
| `approved` | Approved, ready for match/payment |
| `matched` | Already matched with PO/GR |
| `partially_paid` | Partially paid |
| `paid` | Fully paid |
| `rejected` / `cancelled` | Rejected / cancelled |
</div>

---

## 18. 3-Way Match & Match Exception / 3-Way Match & Match Exception

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Match Exceptions  
**Aktifkan:** Settings → 3-way match (atau 2-way)

### Apa itu 3-way match?

Sistem membandingkan **tiga sumber**:

| Sumber | Data |
|--------|------|
| **PO** | Qty & harga pesanan |
| **GR** | Qty diterima |
| **Invoice** | Qty & harga ditagih |

Jika selisih melebihi **toleransi** (setting), muncul **Match Exception**.

### 2-way match

Untuk **jasa / non-stock** — bandingkan PO ↔ Invoice saja (tanpa GR).

### Menyelesaikan exception

1. Buka **Match Exceptions**
2. Review selisih qty/harga
3. Tindakan:
   - Koreksi invoice
   - Buat debit/credit note
   - Override dengan otorisasi (jika diizinkan)
4. Mark **resolved**

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Match Exceptions  
**Enable:** Settings → 3-way match (or 2-way)

### What is 3-way match?

The system compares **three sources**:

| Source | Data |
|--------|------|
| **PO** | Ordered qty & price |
| **GR** | Qty received |
| **Invoice** | Qty & price billed |

If the variance exceeds **tolerance** (setting), a **Match Exception** appears.

### 2-way match

For **services / non-stock** — compare PO ↔ Invoice only (without GR).

### Resolving exceptions

1. Open **Match Exceptions**
2. Review qty/price variance
3. Actions:
   - Correct invoice
   - Create debit/credit note
   - Override with authorization (if allowed)
4. Mark **resolved**
</div>

---

## 19. Batch Pembayaran Supplier / Supplier Payment Batch

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Payment Batch  
**Aktifkan:** Settings → Payment batch enabled

### Langkah

1. **+ Buat Payment Batch**
2. Pilih invoice yang akan dibayar (multi invoice, 1 supplier atau campur)
3. Isi metode bayar (transfer/kas)
4. Submit → approval (jika aktif)
5. **Pay / Confirm** → invoice status `paid`, GL jurnal (jika aktif)

### Manfaat

- Satu kali transfer untuk banyak invoice
- Audit trail pembayaran
- Integrasi cash/bank account

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Payment Batch  
**Enable:** Settings → Payment batch enabled

### Steps

1. **+ Create Payment Batch**
2. Select invoices to pay (multiple invoices, one supplier or mixed)
3. Fill payment method (transfer/cash)
4. Submit → approval (if enabled)
5. **Pay / Confirm** → invoice status `paid`, GL journal (if enabled)

### Benefits

- One transfer for many invoices
- Payment audit trail
- Cash/bank account integration
</div>

---

## 20. Uang Muka Supplier (Prepayment) / Supplier Prepayment

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Prepayment  
**Aktifkan:** Settings → Prepayment enabled

### Kapan dipakai?

- DP sebelum barang dikirim
- Kontrak dengan termin uang muka

### Langkah

1. Buat **Prepayment** — supplier, amount, referensi PO (opsional)
2. Approval → **Pay**
3. Saat invoice datang, prepayment **dikurangkan** (knock-off)

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Prepayment  
**Enable:** Settings → Prepayment enabled

### When to use?

- Down payment before goods are shipped
- Contract with advance payment terms

### Steps

1. Create **Prepayment** — supplier, amount, PO reference (optional)
2. Approval → **Pay**
3. When invoice arrives, prepayment is **deducted** (knock-off)
</div>

---

## 21. PPh / Withholding Tax / Withholding Tax (PPh)

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Withholding Tax  
**Aktifkan:** Settings → Withholding tax enabled

### Fungsi

- Aturan PPh 23 / PPh 22 / PPh 4(2) per supplier atau jenis transaksi
- Saat payment batch, sistem hitung **PPh potong**
- Generate bukti potong / hutang PPh ke akun GL

### Setup

1. Definisikan **tax rules** — jenis, rate, base amount
2. Assign ke supplier atau kategori
3. Saat bayar invoice, PPh otomatis terpotong

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Withholding Tax  
**Enable:** Settings → Withholding tax enabled

### Function

- PPh 23 / PPh 22 / PPh 4(2) rules per supplier or transaction type
- On payment batch, system calculates **withheld tax**
- Generate withholding certificate / withholding tax payable to GL account

### Setup

1. Define **tax rules** — type, rate, base amount
2. Assign to supplier or category
3. When paying invoice, tax is automatically withheld
</div>

---

## 22. Jurnal GL Otomatis / Automatic GL Journals

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → GL Journals  
**Aktifkan:** Settings → GL posting enabled + mapping COA diisi

### Jurnal otomatis dibuat saat:

| Event | Jurnal tipikal |
|-------|----------------|
| GR confirmed (stok) | Dr Persediaan / Cr GRNI |
| Invoice approved | Dr GRNI / Dr PPN / Cr Hutang |
| Payment | Dr Hutang / Cr Bank |
| Prepayment | Dr Uang Muka / Cr Bank |
| Fixed asset GR | Dr Aset Tetap / Cr Hutang |
| Expense item GR | Dr Beban / Cr Hutang |

User finance bisa review jurnal di menu **GL Journals** — biasanya read-only (auto-generated).

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → GL Journals  
**Enable:** Settings → GL posting enabled + COA mapping filled in

### Automatic journals created on:

| Event | Typical journal |
|-------|----------------|
| GR confirmed (stock) | Dr Inventory / Cr GRNI |
| Invoice approved | Dr GRNI / Dr VAT / Cr Payables |
| Payment | Dr Payables / Cr Bank |
| Prepayment | Dr Prepayment / Cr Bank |
| Fixed asset GR | Dr Fixed Asset / Cr Payables |
| Expense item GR | Dr Expense / Cr Payables |

Finance users can review journals in the **GL Journals** menu — usually read-only (auto-generated).
</div>

---

## 23. Anggaran (Budget) / Budget

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Budget  
**Aktifkan:** Settings → Budget check enabled

### 23.1 Setup budget

1. **+ Buat Budget**
2. Isi: nama, tahun fiskal, periode mulai-selesai
3. Tambah **baris per departemen:**
   - Dept A: Rp 100.000.000
   - Dept B: Rp 50.000.000
4. **Activate** budget

### 23.2 Mekanisme

| Konsep | Arti |
|--------|------|
| **Allocated** | Total anggaran |
| **Committed** | Sudah di-PO/PR approved (komitmen) |
| **Available** | Sisa = Allocated - Committed - Actual |
| **Actual** | Realisasi dari GR |

### 23.3 Budget check

Saat **submit PR/PO**, jika total melebihi **available** budget dept → sistem **menolak** submit (jika check aktif).

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Budget  
**Enable:** Settings → Budget check enabled

### 23.1 Budget setup

1. **+ Create Budget**
2. Fill in: name, fiscal year, start-end period
3. Add **lines per department:**
   - Dept A: Rp 100,000,000
   - Dept B: Rp 50,000,000
4. **Activate** budget

### 23.2 Mechanism

| Concept | Meaning |
|--------|------|
| **Allocated** | Total budget |
| **Committed** | Already on approved PO/PR (commitment) |
| **Available** | Remaining = Allocated - Committed - Actual |
| **Actual** | Realization from GR |

### 23.3 Budget check

On **PR/PO submit**, if total exceeds department **available** budget → system **rejects** submit (if check enabled).
</div>

---

## 24. Aset Tetap dari Pembelian / Fixed Assets from Purchases

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Fixed Assets

### Alur

1. Produk di Master → centang **Item aset tetap**
2. Buat PO → GR seperti biasa
3. Saat GR **Confirm** → sistem buat **kartu aset** per unit
4. Field aset: nomor aset, serial, lokasi, custodian, nilai perolehan

### Manfaat

- Laptop/meja/mesin tidak masuk stok gudang
- Langsung register di register aset perusahaan
- GL: Dr Aset Tetap (bukan persediaan)

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Fixed Assets

### Flow

1. Product in Master → check **Fixed asset item**
2. Create PO → GR as usual
3. On GR **Confirm** → system creates **asset card** per unit
4. Asset fields: asset number, serial, location, custodian, acquisition value

### Benefits

- Laptop/desk/machine does not enter warehouse stock
- Directly registered in company asset register
- GL: Dr Fixed Asset (not inventory)
</div>

---

## 25. Approval — Manual, Matrix, Delegasi / Approval — Manual, Matrix, Delegation

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### 25.1 Approval Manual (default)

Saat **Submit** PR/PO/Retur/Invoice:

1. Form menampilkan field **Approver**
2. Pilih user approver — urutan = level (1, 2, 3…)
3. Approver dapat notifikasi → buka app **Approvals**
4. Approve / Reject sequential (level 2 menunggu level 1 selesai)

**Kecuali Parallel approval aktif** → semua approver satu level harus approve.

### 25.2 Approval Matrix

**Menu:** Pengadaan → Approval Matrix  
**Setting:** Mode approval = **Matrix**

Definisikan aturan otomatis:

| Field | Contoh |
|-------|--------|
| Doc type | PR / PO |
| Departemen | Finance / IT / All |
| Min amount | Rp 0 |
| Max amount | Rp 10.000.000 |
| Level | 1, 2, 3 |
| Approver type | User / Role / Position / Job Level |
| Approver ref | Nama user atau role |
| Escalate after X days | 3 hari → eskalasi ke direktur |

Saat submit, sistem **resolve approver otomatis** — user tidak perlu pilih manual.

### 25.3 Approval Delegation

**Menu:** Pengadaan → Approval Delegation

Jika approver cuti:

1. Buat delegasi: **From user** → **To user**
2. Periode tanggal mulai-selesai
3. Semua approval yang masuk ke From user di-forward ke To user

### 25.4 Segregation of Duties (SoD)

| Aturan | Efek |
|--------|------|
| Creator ≠ Approver | Pembuat dokumen tidak bisa approve sendiri |
| Approver ≠ Receiver | Approver PO tidak bisa confirm GR (opsional) |

### 25.5 Escalation / SLA

Jika approval pending > **SLA days** → eskalasi ke user yang ditentukan di matrix.

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### 25.1 Manual Approval (default)

When **Submit** PR/PO/Return/Invoice:

1. Form displays **Approver** field
2. Select approver user — order = level (1, 2, 3…)
3. Approver receives notification → open **Approvals** app
4. Approve / Reject sequentially (level 2 waits for level 1 to finish)

**Unless Parallel approval is enabled** → all approvers at one level must approve.

### 25.2 Approval Matrix

**Menu:** Procurement → Approval Matrix  
**Setting:** Approval mode = **Matrix**

Define automatic rules:

| Field | Example |
|-------|--------|
| Doc type | PR / PO |
| Department | Finance / IT / All |
| Min amount | Rp 0 |
| Max amount | Rp 10,000,000 |
| Level | 1, 2, 3 |
| Approver type | User / Role / Position / Job Level |
| Approver ref | User name or role |
| Escalate after X days | 3 days → escalate to director |

On submit, system **resolves approver automatically** — user does not need to select manually.

### 25.3 Approval Delegation

**Menu:** Procurement → Approval Delegation

If approver is on leave:

1. Create delegation: **From user** → **To user**
2. Start-end date period
3. All approvals to From user are forwarded to To user

### 25.4 Segregation of Duties (SoD)

| Rule | Effect |
|--------|------|
| Creator ≠ Approver | Document creator cannot approve their own document |
| Approver ≠ Receiver | PO approver cannot confirm GR (optional) |

### 25.5 Escalation / SLA

If approval pending > **SLA days** → escalate to user defined in matrix.
</div>

---

## 26. Manajemen Vendor / Vendor Management

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

Selain master supplier, fitur vendor management mencakup:

### 26.1 Onboarding

- Supplier baru status **Pending**
- Upload dokumen legal
- Admin **Approve** → supplier bisa dipakai di PO

### 26.2 Vendor Evaluation

Score otomatis dari histori:
- **On-time delivery** — PO vs GR date
- **Quality** — retur / rejection rate
- **Price variance** — PO vs invoice

### 26.3 Tier & Status

| Tier | Arti |
|------|------|
| Strategic | Supplier kunci |
| Preferred | Supplier favorit |
| One-time | Sekali pakai |

| Status | Efek |
|--------|------|
| Active | Normal |
| Suspended | Tidak bisa PO baru |
| Blacklisted | Diblokir permanen |

### 26.4 Compliance Alert

Dashboard menampilkan dokumen supplier (SIUP, NPWP, PKP) yang **akan/sudah expired**.

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

In addition to supplier master data, vendor management features include:

### 26.1 Onboarding

- New supplier status **Pending**
- Upload legal documents
- Admin **Approve** → supplier can be used on PO

### 26.2 Vendor Evaluation

Automatic score from history:
- **On-time delivery** — PO vs GR date
- **Quality** — return / rejection rate
- **Price variance** — PO vs invoice

### 26.3 Tier & Status

| Tier | Meaning |
|------|------|
| Strategic | Key supplier |
| Preferred | Preferred supplier |
| One-time | One-time use |

| Status | Effect |
|--------|------|
| Active | Normal |
| Suspended | Cannot create new PO |
| Blacklisted | Permanently blocked |

### 26.4 Compliance Alert

Dashboard shows supplier documents (SIUP, NPWP, PKP) that are **about to expire / already expired**.
</div>

---

## 27. Portal Vendor (Supplier) / Vendor Portal (Supplier)

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### Akses

Supplier menerima **link portal** unik (token) dari perusahaan Anda:

```
https://[domain-keaone]/vendor-portal/[token]
```

Token di-generate dari detail supplier di Master.

### Fitur portal (untuk supplier)

| Fitur | Keterangan |
|-------|------------|
| **Lihat PO** | Daftar PO aktif |
| **Konfirmasi PO** | Tandai sudah terima order |
| **Upload invoice** | Kirim PDF faktur → jadi Vendor Invoice `submitted` |

### Langkah admin mengaktifkan portal

1. Buka supplier di Master
2. Generate / copy **Portal link**
3. Kirim ke supplier via email/WhatsApp
4. Pastikan **Vendor invoice enabled** agar supplier bisa upload faktur

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### Access

Supplier receives a unique **portal link** (token) from your company:

```
https://[keaone-domain]/vendor-portal/[token]
```

Token is generated from supplier detail in Master.

### Portal features (for supplier)

| Feature | Notes |
|-------|------------|
| **View PO** | List of active POs |
| **Confirm PO** | Mark order as received |
| **Upload invoice** | Send invoice PDF → becomes Vendor Invoice `submitted` |

### Admin steps to enable portal

1. Open supplier in Master
2. Generate / copy **Portal link**
3. Send to supplier via email/WhatsApp
4. Ensure **Vendor invoice enabled** so supplier can upload invoice
</div>

---

## 28. Laporan & Analitik / Reports & Analytics

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

**Menu:** Pengadaan → Reports

### 28.1 Jenis laporan

| Laporan | Isi | Filter |
|---------|-----|--------|
| **Spend Analysis** | Belanja per supplier/kategori/dept + trend bulanan | Tanggal, group by |
| **Cycle Time** | Rata-rata hari PR→PO→GR→Invoice | Tanggal |
| **Vendor Performance** | On-time %, quality score, price variance | Tanggal |
| **Budget vs Actual** | Alokasi vs komitmen vs realisasi | Tanggal |
| **Open PO Aging** | PO open bucket 0-30 / 31-60 / 61+ hari | Snapshot (tanpa date range) |
| **Price Variance** | Selisih harga PO vs GR vs Invoice | Tanggal |
| **ABC Analysis** | Top supplier/produk klasifikasi A/B/C | Tanggal, group supplier/product |

### 28.2 Cara pakai

1. Pilih **tab laporan**
2. Set **tanggal dari – sampai** (atau preset Hari ini / Bulan ini)
3. Pilih **Group by** (untuk Spend & ABC)
4. Data refresh otomatis

### 28.3 Tips interpretasi

- **Open PO Aging tinggi** → supplier sering telat atau gudang belum GR
- **Cycle time panjang** → bottleneck di approval atau purchasing
- **Price variance** → negosiasi ulang atau supplier price list perlu update
- **ABC** → fokuskan negosiasi ke supplier/produk klasifikasi A (80% spend)

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

**Menu:** Procurement → Reports

### 28.1 Report types

| Report | Content | Filters |
|---------|-----|--------|
| **Spend Analysis** | Spend per supplier/category/dept + monthly trend | Date, group by |
| **Cycle Time** | Average days PR→PO→GR→Invoice | Date |
| **Vendor Performance** | On-time %, quality score, price variance | Date |
| **Budget vs Actual** | Allocation vs commitment vs actual | Date |
| **Open PO Aging** | Open PO buckets 0-30 / 31-60 / 61+ days | Snapshot (no date range) |
| **Price Variance** | Price variance PO vs GR vs Invoice | Date |
| **ABC Analysis** | Top supplier/product A/B/C classification | Date, group supplier/product |

### 28.2 How to use

1. Select **report tab**
2. Set **date from – to** (or preset Today / This Month)
3. Select **Group by** (for Spend & ABC)
4. Data refreshes automatically

### 28.3 Interpretation tips

- **High Open PO Aging** → supplier often late or warehouse has not GR yet
- **Long cycle time** → bottleneck in approval or purchasing
- **Price variance** → renegotiate or supplier price list needs update
- **ABC** → focus negotiation on classification A suppliers/products (80% spend)
</div>

---

## 29. Fitur Pendukung Lainnya / Other Supporting Features

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### 29.1 Lampiran (Attachments)

- Upload file ke PR, PO, GR, Invoice
- Format: PDF, gambar, dokumen
- Aktifkan/nonaktifkan di Settings

### 29.2 Barcode Scanner

- Di form GR/Direct → scan barcode produk
- Mempercepat penerimaan barang

### 29.3 Quick Add Bar

- Tambah produk/supplier cepat dari form PO tanpa keluar halaman

### 29.4 Share & PDF

Semua dokumen PR/PO mendukung:
- Cetak PDF
- Share WhatsApp
- Public link read-only

### 29.5 Activity Log

Semua aksi tercatat di **Activity Log** (modul global):
- Siapa buat/edit/approve
- Perubahan field (jika field audit aktif)

### 29.6 Notifikasi

Approver menerima notifikasi saat ada dokumen **submitted** menunggu tindakan.

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### 29.1 Attachments

- Upload files to PR, PO, GR, Invoice
- Formats: PDF, image, documents
- Enable/disable in Settings

### 29.2 Barcode Scanner

- On GR/Direct form → scan product barcode
- Speeds up goods receipt

### 29.3 Quick Add Bar

- Quickly add product/supplier from PO form without leaving the page

### 29.4 Share & PDF

All PR/PO documents support:
- Print PDF
- Share WhatsApp
- Public read-only link

### 29.5 Activity Log

All actions are recorded in **Activity Log** (global module):
- Who created/edited/approved
- Field changes (if field audit enabled)

### 29.6 Notifications

Approvers receive notifications when a document is **submitted** and waiting for action.
</div>

---

## 30. Peran User & Contoh Skenario Harian / User Roles & Daily Scenario Examples

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### 30.1 Peran tipikal

| Peran | Menu utama | Tugas |
|-------|-----------|-------|
| **Staff dept** | PR | Ajukan kebutuhan barang |
| **Dept head** | PR approval, Budget | Setujui PR dept |
| **Purchasing** | PO, RFQ, Supplier | Order ke supplier, negosiasi |
| **Gudang** | GR, Return, Delivery | Terima barang, catat qty |
| **Finance/AP** | Invoice, Match, Payment | Proses tagihan & bayar |
| **Manager/Director** | Approval, Reports | Oversight & analytics |
| **Admin** | Settings, Matrix, Roles | Konfigurasi modul |

### 30.2 Skenario: Beli bahan baku resto (PO → GR)

1. **07:00** — Purchasing buat PO ke supplier sayur (50 kg tomat)
2. **07:05** — Manager approve PO via app Approvals
3. **07:10** — Purchasing klik **Order**, kirim PDF via WhatsApp
4. **14:00** — Barang datang, gudang buat GR 50 kg → Confirm
5. **14:01** — Stok tomat +50 kg, cost price update
6. **Senin** — Supplier kirim faktur, AP input Vendor Invoice
7. **Selasa** — 3-way match OK → Payment batch → transfer

### 30.3 Skenario: Laptop IT (PR → PO → GR → Aset)

1. IT buat PR 3 laptop
2. IT Manager approve
3. Purchasing PO ke supplier IT
4. Setelah approve → Order
5. Gudang/IT terima → GR Confirm
6. Sistem buat 3 **kartu aset** otomatis
7. Finance review jurnal Dr Aset Tetap

### 30.4 Skenario: ATK via Direct Receipt

1. Admin beli ATK langsung di toko
2. Buka Direct Receipt, pilih supplier toko ATK
3. Pilih produk procurement (non-inventory)
4. Confirm → tidak masuk stok, tercatat expense

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### 30.1 Typical roles

| Role | Main menus | Tasks |
|-------|-----------|-------|
| **Department staff** | PR | Submit goods requirements |
| **Department head** | PR approval, Budget | Approve department PR |
| **Purchasing** | PO, RFQ, Supplier | Order to supplier, negotiate |
| **Warehouse** | GR, Return, Delivery | Receive goods, record qty |
| **Finance/AP** | Invoice, Match, Payment | Process invoices & payment |
| **Manager/Director** | Approval, Reports | Oversight & analytics |
| **Admin** | Settings, Matrix, Roles | Module configuration |

### 30.2 Scenario: Buy restaurant raw materials (PO → GR)

1. **07:00** — Purchasing creates PO to vegetable supplier (50 kg tomatoes)
2. **07:05** — Manager approves PO via Approvals app
3. **07:10** — Purchasing clicks **Order**, sends PDF via WhatsApp
4. **14:00** — Goods arrive, warehouse creates GR 50 kg → Confirm
5. **14:01** — Tomato stock +50 kg, cost price updated
6. **Monday** — Supplier sends invoice, AP inputs Vendor Invoice
7. **Tuesday** — 3-way match OK → Payment batch → transfer

### 30.3 Scenario: IT laptop (PR → PO → GR → Asset)

1. IT creates PR for 3 laptops
2. IT Manager approves
3. Purchasing PO to IT supplier
4. After approve → Order
5. Warehouse/IT receives → GR Confirm
6. System creates 3 **asset cards** automatically
7. Finance reviews journal Dr Fixed Asset

### 30.4 Scenario: Office supplies via Direct Receipt

1. Admin buys office supplies directly at store
2. Open Direct Receipt, select office supply store supplier
3. Select procurement product (non-inventory)
4. Confirm → does not enter stock, recorded as expense
</div>

---

## 31. FAQ & Troubleshooting / FAQ & Troubleshooting

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

### Q: Menu PR tidak muncul?

**A:** Cek **Settings → Purchase Flow**. PR hanya muncul jika flow = **Strict PR → PO → GR**.

### Q: Tidak bisa pilih supplier di PO?

**A:** Supplier mungkin **suspended**, **blacklisted**, atau **onboarding pending**. Cek status di Master → Supplier.

### Q: Submit PR/PO ditolak "budget exceeded"?

**A:** Budget check aktif dan dept sudah kehabisan anggaran. Minta admin tambah budget atau kurangi qty.

### Q: GR Confirm tapi stok tidak bertambah?

**A:** Produk mungkin **procurement item** atau **fixed asset** (sengaja tidak track stock). Cek flag produk di Master.

### Q: Approver tidak muncul di dropdown?

**A:** Pastikan user aktif & punya akses. Mode **matrix** → approver otomatis, tidak perlu pilih manual.

### Q: Match exception terus muncul?

**A:** Cek toleransi qty/harga di Settings. Pastikan invoice qty/harga sesuai PO/GR atau buat adjustment note.

### Q: Vendor portal link invalid?

**A:** Token expired atau supplier di-suspend. Regenerate token dari Master supplier.

### Q: Laporan Reports kosong?

**A:** Pastikan ada GR confirmed / PO dalam rentang tanggal. Cek hak akses menu `procurementreports`.

### Q: Jurnal GL tidak terbentuk?

**A:** GL posting harus aktif **dan** semua akun COA mapping sudah diisi di Settings.

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

### Q: PR menu does not appear?

**A:** Check **Settings → Purchase Flow**. PR only appears if flow = **Strict PR → PO → GR**.

### Q: Cannot select supplier on PO?

**A:** Supplier may be **suspended**, **blacklisted**, or **onboarding pending**. Check status in Master → Supplier.

### Q: PR/PO submit rejected "budget exceeded"?

**A:** Budget check is active and department has run out of budget. Ask admin to add budget or reduce qty.

### Q: GR Confirm but stock does not increase?

**A:** Product may be **procurement item** or **fixed asset** (intentionally does not track stock). Check product flags in Master.

### Q: Approver does not appear in dropdown?

**A:** Ensure user is active & has access. **Matrix** mode → approver automatic, no manual selection needed.

### Q: Match exception keeps appearing?

**A:** Check qty/price tolerance in Settings. Ensure invoice qty/price matches PO/GR or create adjustment note.

### Q: Vendor portal link invalid?

**A:** Token expired or supplier suspended. Regenerate token from Master supplier.

### Q: Reports empty?

**A:** Ensure there is confirmed GR / PO within date range. Check menu access permission `procurementreports`.

### Q: GL journal not created?

**A:** GL posting must be active **and** all COA mapping must be filled in Settings.
</div>

---

## 32. Glosarium / Glossary

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

| Istilah | Definisi |
|---------|----------|
| **AP** | Accounts Payable — hutang ke supplier |
| **Approval Matrix** | Aturan approver otomatis berdasarkan amount/dept |
| **Blanket PO** | Kontrak PO tahunan dengan release berkala |
| **Commitment** | Anggaran terpakai untuk PO/PR approved |
| **Cost Center** | Pusat biaya, biasanya = departemen |
| **Direct Receipt** | Penerimaan tanpa PO |
| **GR** | Goods Receipt — bukti terima barang |
| **GRNI** | Goods Received Not Invoiced — akun perantara |
| **Landed Cost** | Biaya tambahan (freight, bea) dialokasikan ke item |
| **Match Exception** | Selisih PO/GR/Invoice yang perlu diselesaikan |
| **Partial Receive** | Terima barang sebagian dari PO |
| **PO** | Purchase Order — pesanan ke supplier |
| **PR** | Purchase Requisition — permintaan internal |
| **PRN** | Purchase Return — retur ke supplier |
| **RFQ** | Request for Quotation — minta penawaran |
| **SoD** | Segregation of Duties — pemisahan peran |
| **3-Way Match** | Pencocokan PO + GR + Invoice |
| **2-Way Match** | Pencocokan PO + Invoice |
| **Vendor Portal** | Halaman supplier untuk lihat PO & upload invoice |

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

| Term | Definition |
|---------|----------|
| **AP** | Accounts Payable — payables to supplier |
| **Approval Matrix** | Automatic approver rules based on amount/department |
| **Blanket PO** | Annual PO contract with periodic releases |
| **Commitment** | Budget used for approved PO/PR |
| **Cost Center** | Cost center, usually = department |
| **Direct Receipt** | Receipt without PO |
| **GR** | Goods Receipt — proof of goods received |
| **GRNI** | Goods Received Not Invoiced — interim account |
| **Landed Cost** | Additional costs (freight, customs) allocated to items |
| **Match Exception** | PO/GR/Invoice variance that must be resolved |
| **Partial Receive** | Receive partial goods from PO |
| **PO** | Purchase Order — order to supplier |
| **PR** | Purchase Requisition — internal request |
| **PRN** | Purchase Return — return to supplier |
| **RFQ** | Request for Quotation — request for quotation |
| **SoD** | Segregation of Duties — role separation |
| **3-Way Match** | Matching PO + GR + Invoice |
| **2-Way Match** | Matching PO + Invoice |
| **Vendor Portal** | Supplier page to view PO & upload invoice |
</div>

---

## Lampiran: Checklist Go-Live Procurement / Appendix: Procurement Go-Live Checklist

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

Gunakan checklist ini saat pertama kali deploy modul ke perusahaan client:

- [ ] Modul Pengadaan aktif di tenant
- [ ] Role & permission diset per user
- [ ] Master: produk, supplier, gudang, dept
- [ ] Settings: pilih flow (direct / PO→GR / strict)
- [ ] Settings: toggle fitur sesuai kebutuhan client
- [ ] Jika AP: aktifkan invoice, match, payment + COA mapping
- [ ] Jika approval: tentukan manual vs matrix
- [ ] Jika matrix: isi Approval Matrix rules
- [ ] Test 1 siklus penuh: PO → GR → Invoice → Payment
- [ ] Training user per role (dept, purchasing, gudang, finance)
- [ ] Bagikan link tutorial ini ke tim client

---

*Dokumen ini menjelaskan fitur modul Pengadaan KEA One per Agustus 2026. Jika ada perbedaan dengan tampilan di environment Anda, kemungkinan ada fitur yang belum diaktifkan di Settings atau hak role belum diberikan.*

**Pertanyaan atau permintaan training tambahan?** Hubungi admin KEA One / tim implementasi.
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

Use this checklist when first deploying the module to a client company:

- [ ] Procurement module active in tenant
- [ ] Roles & permissions set per user
- [ ] Master: products, suppliers, warehouses, departments
- [ ] Settings: choose flow (direct / PO→GR / strict)
- [ ] Settings: toggle features according to client needs
- [ ] If AP: enable invoice, match, payment + COA mapping
- [ ] If approval: decide manual vs matrix
- [ ] If matrix: fill Approval Matrix rules
- [ ] Test 1 full cycle: PO → GR → Invoice → Payment
- [ ] User training per role (department, purchasing, warehouse, finance)
- [ ] Share this tutorial link with client team

---

*This document describes KEA One Procurement module features as of August 2026. If there are differences from what you see in your environment, some features may not be enabled in Settings or role permissions may not have been granted yet.*

**Questions or additional training requests?** Contact KEA One admin / implementation team.
</div>

---

<div class="lang-block lang-id">
<span class="lang-label">Bahasa Indonesia</span>

---
</div>
<div class="lang-block lang-en">
<span class="lang-label">English</span>

*This document describes KEA One Procurement module features as of August 2026. If the UI differs from your environment, a feature may not be enabled in Settings or role permissions may be missing.*

**Questions or additional training?** Contact your KEA One administrator / implementation team.
</div>
