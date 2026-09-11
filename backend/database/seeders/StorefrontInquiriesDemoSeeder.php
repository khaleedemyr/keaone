<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\StorefrontInquiry;
use App\Services\StorefrontService;
use Illuminate\Database\Seeder;

class StorefrontInquiriesDemoSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::query()->where('name', 'Toko Demo')->first();
        if (! $company) {
            $this->command?->warn('Toko Demo belum ada. Jalankan DemoSeeder dulu.');

            return;
        }

        $storefront = app(StorefrontService::class)->forCompany($company);

        $demos = [
            [
                'kind' => StorefrontInquiry::KIND_CONTACT,
                'status' => StorefrontInquiry::STATUS_NEW,
                'name' => 'Rina Wulandari',
                'email' => 'rina.inbox@demo.test',
                'phone' => '081234570001',
                'subject' => 'Stok kaos size L',
                'message' => "Halo, apakah Kaos Classic Tee warna Navy size L masih tersedia?\nMau order 2 pcs kalau ready.",
                'hours_ago' => 1,
            ],
            [
                'kind' => StorefrontInquiry::KIND_QUOTE,
                'status' => StorefrontInquiry::STATUS_NEW,
                'name' => 'Budi Santoso',
                'email' => 'procurement@majujaya.test',
                'phone' => '0215551001',
                'subject' => 'Penawaran 50 hoodie',
                'message' => "Kami dari CV Maju Jaya ingin request quotation untuk 50 pcs Hoodie Street Soft (campur size M–XL).\nMohon info harga grosir dan estimasi pengiriman ke Jakarta.",
                'hours_ago' => 3,
            ],
            [
                'kind' => StorefrontInquiry::KIND_CONTACT,
                'status' => StorefrontInquiry::STATUS_NEW,
                'name' => 'Maya Putri',
                'email' => 'maya@demo.test',
                'phone' => '081234570002',
                'subject' => null,
                'message' => 'Apakah bisa custom sablon untuk totebag? Minimal order berapa pcs?',
                'hours_ago' => 5,
            ],
            [
                'kind' => StorefrontInquiry::KIND_CONTACT,
                'status' => StorefrontInquiry::STATUS_READ,
                'name' => 'Fajar Nugroho',
                'email' => 'fajar.inbox@demo.test',
                'phone' => '081234570003',
                'subject' => 'Status pengiriman SF9004',
                'message' => 'Saya sudah transfer untuk order SF9004. Boleh minta update resi pengirimannya?',
                'hours_ago' => 28,
                'read_hours_ago' => 20,
            ],
            [
                'kind' => StorefrontInquiry::KIND_QUOTE,
                'status' => StorefrontInquiry::STATUS_READ,
                'name' => 'Luna Boutique',
                'email' => 'luna@boutique.test',
                'phone' => '081298761234',
                'subject' => 'Reseller dropship',
                'message' => "Tertarik jadi reseller/dropship untuk line apparel KEA Demo Shop.\nBoleh kirim pricelist dan syarat kerjasamanya?",
                'hours_ago' => 48,
                'read_hours_ago' => 40,
            ],
            [
                'kind' => StorefrontInquiry::KIND_CONTACT,
                'status' => StorefrontInquiry::STATUS_ARCHIVED,
                'name' => 'Promo Bot',
                'email' => 'spam@example.test',
                'phone' => null,
                'subject' => 'Jasa SEO murah',
                'message' => 'Kami tawarkan jasa SEO dan backlink murah. Hubungi sekarang!',
                'hours_ago' => 96,
                'read_hours_ago' => 90,
            ],
        ];

        $created = 0;
        foreach ($demos as $demo) {
            $createdAt = now()->subHours((int) $demo['hours_ago']);
            $readAt = null;
            if (in_array($demo['status'], [StorefrontInquiry::STATUS_READ, StorefrontInquiry::STATUS_ARCHIVED], true)) {
                $readAt = now()->subHours((int) ($demo['read_hours_ago'] ?? max(1, (int) $demo['hours_ago'] - 2)));
            }

            $inquiry = StorefrontInquiry::query()->updateOrCreate(
                [
                    'storefront_id' => $storefront->id,
                    'email' => $demo['email'],
                    'subject' => $demo['subject'],
                ],
                [
                    'company_id' => $company->id,
                    'kind' => $demo['kind'],
                    'name' => $demo['name'],
                    'phone' => $demo['phone'],
                    'message' => $demo['message'],
                    'meta' => ['demo' => true, 'source' => 'storefront-inquiries-demo'],
                    'status' => $demo['status'],
                    'read_at' => $readAt,
                    'ip' => '127.0.0.1',
                    'user_agent' => 'StorefrontInquiriesDemoSeeder',
                ],
            );

            $inquiry->forceFill([
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ])->save(['timestamps' => false]);

            $created++;
        }

        $this->command?->info("Storefront inquiries demo siap: {$created} pesan untuk Toko Demo.");
        $this->command?->info('Buka Toko Online → Kotak masuk.');
    }
}
