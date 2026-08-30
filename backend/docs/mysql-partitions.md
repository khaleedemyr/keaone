# MySQL Table Partitioning — KEA One

Panduan referensi untuk partisi tabel high-volume di backend Laravel KEA One.

Partisi **hanya aktif** saat driver database `mysql` atau `mariadb`. Di local dev dengan SQLite, semua operasi partisi di-skip otomatis — tidak perlu konfigurasi tambahan.

---

## Ringkasan

| Aspek | Detail |
|-------|--------|
| Metode | `RANGE COLUMNS (created_at)` — partisi bulanan |
| Nama partisi | `p202605`, `p202606`, … + `pmax` (catch-all) |
| Window awal | 3 bulan ke belakang + 15 bulan ke depan (konfigurasi via `.env`) |
| Retensi | Hanya tabel dengan `retention: true` — drop partisi lama via prune command |
| FK | Foreign key di-drop saat partisi — integritas dijaga di level aplikasi |

---

## Kapan perlu partisi?

Partisi cocok untuk tabel yang:

- Data terus bertambah (log, transaksi, event, notifikasi)
- Query sering filter rentang waktu (`WHERE created_at BETWEEN …`)
- Berpotensi jutaan baris per tenant / per database

**Tidak perlu** dipartisi: tabel master kecil (company, product, category, user, dll.).

---

## File penting

| File | Fungsi |
|------|--------|
| `config/partitions.php` | Daftar tabel, retensi, window bulan |
| `app/Support/MySqlPartitions.php` | Helper: deteksi, ALTER, tambah/hapus partisi |
| `app/Support/HighVolumePartitionInstaller.php` | Logic install per tabel (index, PK, ALTER) |
| `app/Console/Commands/InstallTablePartitionsCommand.php` | `partitions:install` |
| `app/Console/Commands/EnsureTablePartitionsCommand.php` | `partitions:ensure` |
| `app/Console/Commands/TablePartitionsStatusCommand.php` | `partitions:status` |
| `database/migrations/2026_08_29_200000_partition_high_volume_tables.php` | Index reporting + install awal |
| `database/migrations/2026_08_29_210000_apply_high_volume_partitions.php` | Re-apply install (recovery) |
| `bootstrap/app.php` | Scheduler `partitions:ensure` + prune commands |

---

## Tabel yang sudah terpartisi

| Tabel | Retensi auto-drop | Prune command |
|-------|-------------------|---------------|
| `activity_logs` | 90 hari | `activity-logs:prune` |
| `user_notifications` | 90 hari | `notifications:prune` |
| `messages` | 365 hari | `chat:prune` |
| `stock_movements` | Tidak (archive) | — |
| `sales` | Tidak (archive) | — |
| `sale_items` | Tidak (archive) | — |
| `payments` | Tidak (archive) | — |
| `goods_receipts` | Tidak (archive) | — |
| `goods_receipt_items` | Tidak (archive) | — |
| `purchase_returns` | Tidak (archive) | — |
| `purchase_return_items` | Tidak (archive) | — |
| `purchase_return_approvals` | Tidak (archive) | — |
| `vendor_adjustment_notes` | Tidak (archive) | — |
| `vendor_adjustment_note_items` | Tidak (archive) | — |
| `purchase_order_delivery_schedules` | Tidak (archive) | — |
| `procurement_attachments` | Tidak (archive) | — |

**Catatan:** `stock_balances` sengaja **tidak** dipartisi — snapshot qty, bukan append-only log.

---

## Artisan commands

### Cek status

```bash
php artisan partitions:status
```

Menampilkan driver, nama database, dan per tabel: exists / partitioned / jumlah partisi.

### Install partisi (tabel baru atau recovery)

```bash
php artisan partitions:install
php artisan partitions:install -v   # verbose — lihat alasan skip per tabel
```

- Tabel yang sudah terpartisi → di-skip
- Tabel belum ada → di-skip
- Aman dijalankan ulang (idempotent)

### Tambah partisi bulan ke depan

```bash
php artisan partitions:ensure
php artisan partitions:ensure --months=6
```

Otomatis dijadwalkan: **tanggal 1 setiap bulan, jam 02:00** (`bootstrap/app.php`).

---

## Variabel environment

```env
# ACTIVITY_LOG_RETENTION_DAYS=90
# NOTIFICATION_RETENTION_DAYS=90
# CHAT_MESSAGE_RETENTION_DAYS=365
# PARTITION_MONTHS_BACK=3      # bulan ke belakang saat install awal
# PARTITION_MONTHS_AHEAD=15    # bulan ke depan saat install + ensure
```

Setelah ubah `.env` di production:

```bash
php artisan config:clear
```

---

## Cara menambah tabel baru (checklist)

### 1. Desain migration

Syarat struktur agar compatible MySQL partition:

1. Kolom **`created_at`** — prefer `DATETIME` (bukan `TIMESTAMP`; error 1659 di banyak host)
2. Primary key akhirnya **`(id, created_at)`** — installer bisa recompose otomatis
3. **Hindari foreign key** ke/dari tabel terpartisi (batasan InnoDB)
4. **Unique index** harus include `created_at`, contoh: `(company_id, number, created_at)`

Contoh migration sederhana:

```php
Schema::create('webhook_logs', function (Blueprint $table) {
    $table->id();
    $table->foreignId('company_id')->index();
    $table->string('event');
    $table->json('payload')->nullable();
    $table->timestamps();
});
```

### 2. Daftarkan di `config/partitions.php`

```php
'tables' => [
    // ... existing ...
    'webhook_logs' => ['retention' => true, 'column' => 'created_at'],
],

'retention_days' => [
    // ... existing ...
    'webhook_logs' => (int) env('WEBHOOK_LOG_RETENTION_DAYS', 90),
],
```

- `retention: true` → partisi lama bisa di-drop otomatis
- `retention: false` → data disimpan permanen (seperti sales)

### 3. Tambah method di `HighVolumePartitionInstaller.php`

**Tabel sederhana** (tanpa unique index khusus) — pola `stock_movements`:

```php
// Di array foreach apply():
'webhook_logs' => fn () => self::webhookLogs(),

// Method baru:
private static function webhookLogs(): void
{
    MySqlPartitions::recomposePrimaryKey('webhook_logs');
    MySqlPartitions::applyRangeByCreatedAt('webhook_logs');
}
```

**Tabel dengan unique index** — pola `sales` / `payments`:

```php
private static function webhookLogs(): void
{
    MySqlPartitions::dropIndexIfExists('webhook_logs', 'webhook_logs_company_id_event_unique');
    MySqlPartitions::createIndexIfNotExists(
        'webhook_logs',
        'webhook_logs_company_event_created_unique',
        '`company_id`, `event`, `created_at`',
        true
    );
    MySqlPartitions::recomposePrimaryKey('webhook_logs');
    MySqlPartitions::applyRangeByCreatedAt('webhook_logs');
}
```

**Tabel yang direferensi FK tabel lain** — panggil `dropIncomingForeignKeys()` dulu (lihat `sales()`).

### 4. (Opsional) Prune command — jika `retention: true`

Salin `PruneActivityLogsCommand.php`, sesuaikan model/tabel/config key.

Daftarkan di `bootstrap/app.php`:

```php
$schedule->command('webhook-logs:prune')->dailyAt('04:15');
```

Prune command otomatis pakai `MySqlPartitions::dropPartitionsBefore()` jika tabel sudah terpartisi; fallback DELETE batch jika belum.

### 5. Deploy

```bash
git pull origin main
cd backend
php artisan migrate --force
php artisan partitions:install -v
php artisan partitions:status
```

---

## Aturan desain (MySQL InnoDB)

| Aturan | Alasan |
|--------|--------|
| Partition key = kolom di PRIMARY KEY | MySQL wajib; kita pakai `(id, created_at)` |
| Unique index harus include `created_at` | Unique hanya valid per partisi |
| FK tidak didukung antar tabel partitioned | FK di-drop saat install; validasi di app |
| `TIMESTAMP` → `DATETIME` sebelum partisi | Error 1659 di Hostinger / MariaDB |
| `RANGE COLUMNS`, bukan `TO_DAYS()` | Error 1486 — timezone-dependent |

---

## Scheduler production

Pastikan cron Laravel aktif:

```cron
* * * * * cd /path/to/keaone/backend && php artisan schedule:run >> /dev/null 2>&1
```

Task terkait partisi & retensi:

| Jadwal | Command |
|--------|---------|
| Setiap hari 03:30 | `activity-logs:prune` |
| Setiap hari 03:45 | `notifications:prune` |
| Minggu 04:00 | `chat:prune` |
| Tanggal 1, 02:00 | `partitions:ensure` |

---

## Dev lokal vs production

| Environment | Perilaku |
|-------------|----------|
| SQLite (`DB_CONNECTION=sqlite`) | Partisi di-skip — dev normal |
| MySQL/MariaDB lokal | Bisa test `partitions:install` |
| Production (Hostinger) | MySQL — partisi aktif |

Cek driver:

```bash
php artisan tinker --execute="echo config('database.default').' '.Schema::getConnection()->getDriverName();"
```

---

## Verifikasi di database

```sql
SELECT TABLE_NAME, COUNT(DISTINCT PARTITION_NAME) AS parts
FROM information_schema.PARTITIONS
WHERE TABLE_SCHEMA = DATABASE()
  AND PARTITION_NAME IS NOT NULL
GROUP BY TABLE_NAME;
```

Harus muncul semua tabel terpartisi dengan ~20 partisi (tergantung `PARTITION_MONTHS_BACK` + `PARTITION_MONTHS_AHEAD`).

Detail satu tabel:

```sql
SELECT PARTITION_NAME, PARTITION_DESCRIPTION, TABLE_ROWS
FROM information_schema.PARTITIONS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'activity_logs'
  AND PARTITION_NAME IS NOT NULL
ORDER BY PARTITION_ORDINAL_POSITION;
```

---

## Troubleshooting

| Gejala | Kemungkinan penyebab | Solusi |
|--------|---------------------|--------|
| `partitions:install` → "No tables were partitioned" | Tabel belum ada / sudah terpartisi | `partitions:status` dan `partitions:install -v` |
| Migration DONE tapi 0 partisi | Driver bukan mysql/mariadb atau config cache stale | `config:clear`, cek `.env`, jalankan `partitions:install` |
| Error 1659 | Kolom `created_at` masih TIMESTAMP | Installer otomatis convert; atau ALTER manual ke DATETIME |
| Error 1217 | FK dari tabel lain ke tabel ini | `dropIncomingForeignKeys()` sebelum ALTER |
| Error 1486 | Pakai `TO_DAYS()` | Sudah diganti `RANGE COLUMNS` — jangan revert |
| `partitions:ensure` → 0 new | Partisi bulan depan sudah ada | Normal |

---

## Menghapus partisi (manual, hati-hati)

Tidak ada `down()` otomatis di migration partisi — menghapus partisi di production berisiko.

Untuk tabel **retention**, biarkan prune command yang `DROP PARTITION` partisi lama.

Rollback manual hanya jika benar-benar diperlukan dan sudah backup — konsultasikan dulu.

---

## Referensi cepat — alur develop

```
Buat migration tabel baru (created_at, hindari FK)
        ↓
Tambah ke config/partitions.php
        ↓
Tambah method di HighVolumePartitionInstaller.php
        ↓
(opsional) Buat prune command + scheduler
        ↓
Push → migrate → partitions:install -v → partitions:status
        ↓
Scheduler otomatis maintain partisi & retensi
```

---

*Terakhir diperbarui: Agustus 2026 — sesuai implementasi commit scaling & partitioning layer.*
