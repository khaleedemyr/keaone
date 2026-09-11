<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\StorefrontNewsPost;
use App\Services\StorefrontService;
use Illuminate\Database\Seeder;

class StorefrontNewsDemoSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::query()->where('name', 'Toko Demo')->first();
        if (! $company) {
            $this->command?->warn('Toko Demo belum ada. Jalankan DemoSeeder dulu.');

            return;
        }

        $storefront = app(StorefrontService::class)->forCompany($company);

        $dir = storage_path('app/public/storefront');
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $demos = [
            [
                'slug' => 'koleksi-musim-baru',
                'title' => 'Koleksi Musim Baru Avalon',
                'excerpt' => 'Drop terbaru apparel street: kaos, hoodie, dan sneakers untuk gaya harian.',
                'body' => "<p>Musim baru sudah tiba. Kami merilis line Avalon dengan potongan nyaman dan warna yang mudah dipadukan.</p><p>Cek <strong>Kaos Classic Tee</strong> dan <strong>Hoodie Street Soft</strong> di katalog toko — stok terbatas untuk warna debut.</p>",
                'tags' => 'Fashion, Launch',
                'sort_order' => 10,
                'is_published' => true,
                'days_ago' => 2,
                'image' => ['label' => 'NEW DROP', 'rgb' => [28, 28, 28]],
            ],
            [
                'slug' => 'tips-merawat-hoodie',
                'title' => 'Tips Merawat Hoodie Cotton',
                'excerpt' => 'Agar hoodie tetap lembut dan bentuknya awet: cuci, jemur, dan simpan dengan benar.',
                'body' => "<p>Gunakan air dingin, balik bagian dalam saat mencuci, dan hindari bleach.</p><ul><li>Cuci terpisah dari jeans kasar</li><li>Jemur di tempat teduh</li><li>Jangan setrika langsung di sablon</li></ul>",
                'tags' => 'Tips, Care',
                'sort_order' => 20,
                'is_published' => true,
                'days_ago' => 5,
                'image' => ['label' => 'CARE TIP', 'rgb' => [90, 40, 40]],
            ],
            [
                'slug' => 'free-ongkir-akhir-pekan',
                'title' => 'Promo Free Ongkir Akhir Pekan',
                'excerpt' => 'Gratis ongkir untuk belanja di atas Rp 150.000 setiap Jumat–Minggu.',
                'body' => "<p>Berlaku otomatis di checkout untuk destinasi dalam pulau Jawa.</p><p>Gunakan kurir yang tersedia di toko (JNE / J&T / SiCepat) dan pastikan alamat lengkap.</p>",
                'tags' => 'Promo',
                'sort_order' => 30,
                'is_published' => true,
                'days_ago' => 1,
                'image' => ['label' => 'FREE ONG', 'rgb' => [20, 90, 70]],
            ],
            [
                'slug' => 'behind-the-scenes-draft',
                'title' => 'Behind the Scenes (Draft)',
                'excerpt' => 'Cuplikan proses shooting lookbook — masih draft, belum dipublish.',
                'body' => '<p>Artikel draft untuk uji tampilan admin berita. Lengkapi foto final sebelum publish.</p>',
                'tags' => 'Studio',
                'sort_order' => 40,
                'is_published' => false,
                'days_ago' => 0,
                'image' => ['label' => 'DRAFT', 'rgb' => [70, 70, 90]],
            ],
        ];

        $created = 0;
        foreach ($demos as $index => $demo) {
            $file = 'demo_news_'.$company->id.'_'.($index + 1).'.jpg';
            $full = $dir.DIRECTORY_SEPARATOR.$file;
            $this->writeJpeg($full, $demo['image']['label'], $demo['image']['rgb'][0], $demo['image']['rgb'][1], $demo['image']['rgb'][2]);

            $publishedAt = $demo['is_published']
                ? now()->subDays((int) $demo['days_ago'])->setTime(10, 0)
                : null;

            StorefrontNewsPost::query()->updateOrCreate(
                [
                    'storefront_id' => $storefront->id,
                    'slug' => $demo['slug'],
                ],
                [
                    'company_id' => $company->id,
                    'title' => $demo['title'],
                    'excerpt' => $demo['excerpt'],
                    'body' => $demo['body'],
                    'image_path' => 'storefront/'.$file,
                    'tags' => $demo['tags'],
                    'sort_order' => $demo['sort_order'],
                    'is_published' => $demo['is_published'],
                    'published_at' => $publishedAt,
                ],
            );
            $created++;
        }

        $this->command?->info("Storefront news demo siap: {$created} berita untuk Toko Demo.");
        $this->command?->info('Buka Toko Online → Berita (template Avalon sudah has_news).');
    }

    private function writeJpeg(string $path, string $label, int $r, int $g, int $b): void
    {
        if (! function_exists('imagecreatetruecolor')) {
            file_put_contents($path, '');

            return;
        }

        $im = imagecreatetruecolor(1200, 720);
        $bg = imagecolorallocate($im, max(0, min(255, $r)), max(0, min(255, $g)), max(0, min(255, $b)));
        imagefill($im, 0, 0, $bg);

        $fg = (($r + $g + $b) / 3) > 140
            ? imagecolorallocate($im, 20, 20, 20)
            : imagecolorallocate($im, 255, 255, 255);

        $text = mb_strtoupper(mb_substr($label, 0, 24));
        $font = 5;
        $tw = imagefontwidth($font) * strlen($text);
        $th = imagefontheight($font);
        imagestring($im, $font, (int) ((1200 - $tw) / 2), (int) ((720 - $th) / 2), $text, $fg);

        imagejpeg($im, $path, 88);
        imagedestroy($im);
    }
}
