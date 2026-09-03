# Tutorial Modul Pengadaan (Procurement) — KEA One

Panduan lengkap untuk **pengguna akhir** (staff purchasing, gudang, finance, approver, dan admin perusahaan) dalam menggunakan modul **Pengadaan** di KEA One.

> **Versi dokumen:** Agustus 2026  
> **Target pembaca:** User operasional & manajemen, bukan developer  
> **Bahasa UI:** Modul ini ditampilkan sebagai **Pengadaan** di aplikasi desktop KEA One

---

## Daftar Isi

1. [Apa itu Modul Pengadaan?](#1-apa-itu-modul-pengadaan)
2. [Persiapan Sebelum Mulai](#2-persiapan-sebelum-mulai)
3. [Struktur Menu & Hak Akses](#3-struktur-menu--hak-akses)
4. [Pengaturan Modul (Settings)](#4-pengaturan-modul-settings)
5. [Tiga Mode Alur Pembelian](#5-tiga-mode-alur-pembelian)
6. [Alur Kerja End-to-End](#6-alur-kerja-end-to-end)
7. [Dashboard Pengadaan](#7-dashboard-pengadaan)
8. [Master Data Pendukung](#8-master-data-pendukung)
9. [Sourcing — RFQ, Price List, Kontrak](#9-sourcing--rfq-price-list-kontrak)
10. [Perencanaan — Rencana Tahunan & Demand Planning](#10-perencanaan--rencana-tahunan--demand-planning)
11. [Purchase Requisition (PR)](#11-purchase-requisition-pr)
12. [Purchase Order (PO)](#12-purchase-order-po)
13. [Goods Receipt (GR) & Penerimaan Langsung](#13-goods-receipt-gr--penerimaan-langsung)
14. [Retur Pembelian (Purchase Return)](#14-retur-pembelian-purchase-return)
15. [Nota Debit / Kredit Supplier](#15-nota-debit--kredit-supplier)
16. [Jadwal Pengiriman (Delivery Schedule)](#16-jadwal-pengiriman-delivery-schedule)
17. [Tagihan Supplier (Vendor Invoice / AP)](#17-tagihan-supplier-vendor-invoice--ap)
18. [3-Way Match & Match Exception](#18-3-way-match--match-exception)
19. [Batch Pembayaran Supplier](#19-batch-pembayaran-supplier)
20. [Uang Muka Supplier (Prepayment)](#20-uang-muka-supplier-prepayment)
21. [PPh / Withholding Tax](#21-pph--withholding-tax)
22. [Jurnal GL Otomatis](#22-jurnal-gl-otomatis)
23. [Anggaran (Budget)](#23-anggaran-budget)
24. [Aset Tetap dari Pembelian](#24-aset-tetap-dari-pembelian)
25. [Approval — Manual, Matrix, Delegasi](#25-approval--manual-matrix-delegasi)
26. [Manajemen Vendor](#26-manajemen-vendor)
27. [Portal Vendor (Supplier)](#27-portal-vendor-supplier)
28. [Laporan & Analitik](#28-laporan--analitik)
29. [Fitur Pendukung Lainnya](#29-fitur-pendukung-lainnya)
30. [Peran User & Contoh Skenario Harian](#30-peran-user--contoh-skenario-harian)
31. [FAQ & Troubleshooting](#31-faq--troubleshooting)
32. [Glosarium](#32-glosarium)

---

## 1. Apa itu Modul Pengadaan?

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

## 2. Persiapan Sebelum Mulai

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

## 3. Struktur Menu & Hak Akses

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

## 4. Pengaturan Modul (Settings)

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

## 5. Tiga Mode Alur Pembelian

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

## 6. Alur Kerja End-to-End

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

## 7. Dashboard Pengadaan

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

## 8. Master Data Pendukung

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

## 9. Sourcing — RFQ, Price List, Kontrak

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

## 10. Perencanaan — Rencana Tahunan & Demand Planning

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

## 11. Purchase Requisition (PR)

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

## 12. Purchase Order (PO)

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

## 13. Goods Receipt (GR) & Penerimaan Langsung

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

## 14. Retur Pembelian (Purchase Return)

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

## 15. Nota Debit / Kredit Supplier

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

## 16. Jadwal Pengiriman (Delivery Schedule)

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

## 17. Tagihan Supplier (Vendor Invoice / AP)

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

## 18. 3-Way Match & Match Exception

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

## 19. Batch Pembayaran Supplier

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

## 20. Uang Muka Supplier (Prepayment)

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

## 21. PPh / Withholding Tax

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

## 22. Jurnal GL Otomatis

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

## 23. Anggaran (Budget)

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

## 24. Aset Tetap dari Pembelian

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

## 25. Approval — Manual, Matrix, Delegasi

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

## 26. Manajemen Vendor

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

## 27. Portal Vendor (Supplier)

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

## 28. Laporan & Analitik

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

## 29. Fitur Pendukung Lainnya

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

## 30. Peran User & Contoh Skenario Harian

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

## 31. FAQ & Troubleshooting

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

## 32. Glosarium

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

## Lampiran: Checklist Go-Live Procurement

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
