<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\User;
use Illuminate\Database\Seeder;

class BlogSeeder extends Seeder
{
    public function run(): void
    {
        if (BlogPost::query()->exists()) {
            return;
        }

        $authorId = User::query()->where('is_platform', true)->value('id')
            ?? User::query()->value('id');

        $posts = [
            [
                'status' => 'published',
                'published_at' => now()->subDays(5),
                'translations' => [
                    [
                        'locale' => 'id',
                        'title' => 'Mengapa toko modern butuh sistem operasi usaha',
                        'slug' => 'sistem-operasi-usaha',
                        'excerpt' => 'POS saja tidak cukup. Outlet, stok, peran, dan insight harus bergerak dalam satu ruang kerja.',
                        'body' => "Toko yang tumbuh cepat biasanya bukan kekurangan kasir — mereka kekurangan sistem yang menyatukan operasi.\n\nKEA One dirancang sebagai business operating system: desktop kerja tempat POS, master data, laporan, dan admin hidup berdampingan.\n\nHasilnya: keputusan lebih tajam, training lebih cepat, dan kontrol multi-outlet yang konsisten.",
                    ],
                    [
                        'locale' => 'en',
                        'title' => 'Why modern stores need a business operating system',
                        'slug' => 'business-operating-system',
                        'excerpt' => 'A register alone is not enough. Outlets, stock, roles, and insight must share one workspace.',
                        'body' => "Growing stores rarely lack cashiers — they lack a system that unifies operations.\n\nKEA One is built as a business operating system: a desktop workspace where POS, master data, reports, and admin live side by side.\n\nThe result: sharper decisions, faster training, and consistent multi-outlet control.",
                    ],
                ],
            ],
            [
                'status' => 'published',
                'published_at' => now()->subDays(2),
                'translations' => [
                    [
                        'locale' => 'id',
                        'title' => 'Retail, restoran, atau kafe: satu platform, mode yang tepat',
                        'slug' => 'mode-retail-restoran-kafe',
                        'excerpt' => 'Pilih mode kasir yang cocok tanpa mengganti seluruh sistem setiap kali model bisnis berubah.',
                        'body' => "Retail butuh scan cepat. Restoran butuh meja dan alur dapur. Kafe butuh menu dan kanal harga yang lincah.\n\nDengan KEA One, mode kasir bisa disesuaikan per perusahaan — tetap dalam satu ekosistem peran, produk, dan laporan.\n\nItu artinya ekspansi format usaha tidak harus berarti migrasi software.",
                    ],
                    [
                        'locale' => 'en',
                        'title' => 'Retail, restaurant, or cafe: one platform, the right mode',
                        'slug' => 'retail-restaurant-cafe-modes',
                        'excerpt' => 'Pick the checkout mode that fits — without replacing your whole stack when the model changes.',
                        'body' => "Retail needs fast scanning. Restaurants need tables and kitchen flow. Cafes need menus and agile price channels.\n\nWith KEA One, POS mode adapts per company — still inside one ecosystem of roles, products, and reports.\n\nThat means expanding formats does not have to mean migrating software.",
                    ],
                ],
            ],
            [
                'status' => 'published',
                'published_at' => now()->subDay(),
                'translations' => [
                    [
                        'locale' => 'id',
                        'title' => 'Kontrol akses yang sebenarnya: peran, bukan sekadar password',
                        'slug' => 'kontrol-peran-akses',
                        'excerpt' => 'Owner, admin, dan kasir melihat dunia yang berbeda — by design.',
                        'body' => "Keamanan operasional bukan hanya login. Itu tentang siapa boleh membuka POS, mengubah harga, atau melihat laporan.\n\nKEA One memakai matriks hak per menu: view, create, edit, delete — untuk tenant maupun operator platform.\n\nDengan begitu, demo dan produksi tetap rapi: setiap orang masuk ke ruang kerja yang sesuai tanggung jawabnya.",
                    ],
                    [
                        'locale' => 'en',
                        'title' => 'Real access control: roles, not just passwords',
                        'slug' => 'role-based-access',
                        'excerpt' => 'Owners, admins, and cashiers see different worlds — by design.',
                        'body' => "Operational security is more than login. It is about who can open POS, change prices, or read reports.\n\nKEA One uses a per-menu permission matrix: view, create, edit, delete — for tenants and platform operators.\n\nDemo and production stay clean: everyone enters the workspace that matches their responsibility.",
                    ],
                ],
            ],
        ];

        foreach ($posts as $row) {
            $post = BlogPost::query()->create([
                'status' => $row['status'],
                'published_at' => $row['published_at'],
                'author_id' => $authorId,
            ]);
            foreach ($row['translations'] as $tr) {
                $post->translations()->create($tr);
            }
        }
    }
}
