<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Company;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductOutletPrice;
use App\Models\ProductVariantAttribute;
use App\Models\ProductVariantOption;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\StorefrontDomain;
use App\Models\StorefrontPage;
use App\Models\StorefrontProduct;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Services\StorefrontService;
use App\Support\StorefrontCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class StorefrontShopDemoSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::query()->where('name', 'Toko Demo')->first();
        if (! $company) {
            $this->command?->warn('Toko Demo belum ada. Jalankan DemoSeeder dulu.');

            return;
        }

        $modules = is_array($company->modules) ? $company->modules : [];
        $modules['storefront'] = true;
        $company->forceFill(['modules' => $modules])->save();

        $outlet = Outlet::query()
            ->where('company_id', $company->id)
            ->orderByDesc('is_default')
            ->first();

        $warehouse = Warehouse::query()->firstOrCreate(
            [
                'company_id' => $company->id,
                'name' => 'Utama',
            ],
            [
                'outlet_id' => $outlet?->id,
                'address' => $outlet?->address,
                'is_default' => true,
                'is_active' => true,
            ],
        );
        $unit = Unit::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Pcs'],
            ['symbol' => 'pcs', 'sort_order' => 1, 'is_active' => true],
        );

        $apparel = Category::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Apparel'],
            ['sort_order' => 10, 'is_active' => true],
        );
        $aksesoris = Category::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Aksesoris'],
            ['sort_order' => 11, 'is_active' => true],
        );

        $dir = storage_path('app/public/products');
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $catalog = [
            [
                'sku' => 'SF-TEE-001',
                'barcode' => '8999001100001',
                'name' => 'Kaos Classic Tee',
                'category_id' => $apparel->id,
                'sell_price' => 129000,
                'cost_price' => 65000,
                'weight_gram' => 250,
                'qty' => 40,
                'is_new_arrival' => true,
                'is_bestseller' => true,
                'description' => "Kaos cotton combed 24s, potongan regular fit.\nNyaman dipakai harian, jahitan rapi, dan tidak mudah melar.\n\nBahan: 100% cotton\nPerawatan: cuci dengan air dingin, jangan bleach.",
                'gallery' => [
                    ['label' => 'TEE FRONT', 'rgb' => [34, 34, 34]],
                    ['label' => 'TEE BACK', 'rgb' => [55, 55, 55]],
                    ['label' => 'TEE DETAIL', 'rgb' => [80, 80, 80]],
                    ['label' => 'TEE FLAT', 'rgb' => [120, 120, 120]],
                ],
                'variants' => [
                    [
                        'name' => 'Warna',
                        'show_in_storefront' => true,
                        'options' => [
                            ['name' => 'Hitam', 'extra_price' => 0, 'rgb' => [20, 20, 20]],
                            ['name' => 'Putih', 'extra_price' => 0, 'rgb' => [235, 235, 235]],
                            ['name' => 'Navy', 'extra_price' => 10000, 'rgb' => [25, 45, 90]],
                        ],
                    ],
                    [
                        'name' => 'Size',
                        'show_in_storefront' => true,
                        'options' => [
                            ['name' => 'S', 'extra_price' => 0],
                            ['name' => 'M', 'extra_price' => 0],
                            ['name' => 'L', 'extra_price' => 5000],
                            ['name' => 'XL', 'extra_price' => 10000],
                        ],
                    ],
                ],
            ],
            [
                'sku' => 'SF-HDY-001',
                'barcode' => '8999001100002',
                'name' => 'Hoodie Street Soft',
                'category_id' => $apparel->id,
                'sell_price' => 289000,
                'cost_price' => 160000,
                'weight_gram' => 650,
                'qty' => 24,
                'is_deal' => true,
                'is_bestseller' => true,
                'description' => "Hoodie fleece lembut dengan kap dan kantong depan.\nCocok untuk cuaca dingin atau layering kasual.\n\nBahan: cotton fleece\nFit: oversized ringan",
                'gallery' => [
                    ['label' => 'HOODIE 1', 'rgb' => [90, 40, 40]],
                    ['label' => 'HOODIE 2', 'rgb' => [70, 30, 30]],
                    ['label' => 'HOODIE 3', 'rgb' => [110, 60, 60]],
                ],
                'variants' => [
                    [
                        'name' => 'Warna',
                        'show_in_storefront' => true,
                        'options' => [
                            ['name' => 'Maroon', 'extra_price' => 0, 'rgb' => [110, 30, 40]],
                            ['name' => 'Abu', 'extra_price' => 0, 'rgb' => [140, 140, 140]],
                            ['name' => 'Olive', 'extra_price' => 15000, 'rgb' => [80, 100, 55]],
                        ],
                    ],
                    [
                        'name' => 'Size',
                        'show_in_storefront' => true,
                        'options' => [
                            ['name' => 'M', 'extra_price' => 0],
                            ['name' => 'L', 'extra_price' => 0],
                            ['name' => 'XL', 'extra_price' => 10000],
                        ],
                    ],
                ],
            ],
            [
                'sku' => 'SF-SNK-001',
                'barcode' => '8999001100003',
                'name' => 'Sneakers Urban Runner',
                'category_id' => $aksesoris->id,
                'sell_price' => 459000,
                'cost_price' => 280000,
                'weight_gram' => 900,
                'qty' => 18,
                'is_new_arrival' => true,
                'description' => "Sneakers ringan untuk aktivitas harian.\nOutsole anti-slip, upper breathable, dan cushion nyaman seharian.\n\nMaterial: mesh + synthetic\nSole: rubber",
                'gallery' => [
                    ['label' => 'SNEAKER A', 'rgb' => [30, 90, 120]],
                    ['label' => 'SNEAKER B', 'rgb' => [40, 110, 140]],
                    ['label' => 'SNEAKER C', 'rgb' => [20, 70, 100]],
                    ['label' => 'SNEAKER D', 'rgb' => [60, 130, 160]],
                ],
                'variants' => [
                    [
                        'name' => 'Size',
                        'show_in_storefront' => true,
                        'options' => [
                            ['name' => '40', 'extra_price' => 0],
                            ['name' => '41', 'extra_price' => 0],
                            ['name' => '42', 'extra_price' => 0],
                            ['name' => '43', 'extra_price' => 15000],
                            ['name' => '44', 'extra_price' => 15000],
                        ],
                    ],
                ],
            ],
            [
                'sku' => 'SF-BAG-001',
                'barcode' => '8999001100004',
                'name' => 'Totebag Canvas Daily',
                'category_id' => $aksesoris->id,
                'sell_price' => 99000,
                'cost_price' => 45000,
                'weight_gram' => 320,
                'qty' => 50,
                'is_deal' => true,
                'description' => "Totebag kanvas tebal untuk belanja atau kerja.\nMuat laptop 13\", ada saku dalam, dan tali bahu nyaman.\n\nBahan: canvas 12oz\nDimensi: 38 x 42 cm",
                'gallery' => [
                    ['label' => 'TOTE 1', 'rgb' => [180, 150, 100]],
                    ['label' => 'TOTE 2', 'rgb' => [160, 130, 80]],
                    ['label' => 'TOTE 3', 'rgb' => [200, 170, 120]],
                ],
                'variants' => [
                    [
                        'name' => 'Warna',
                        'show_in_storefront' => true,
                        'options' => [
                            ['name' => 'Natural', 'extra_price' => 0, 'rgb' => [210, 185, 140]],
                            ['name' => 'Hitam', 'extra_price' => 0, 'rgb' => [25, 25, 25]],
                            ['name' => 'Cream', 'extra_price' => 5000, 'rgb' => [240, 230, 210]],
                        ],
                    ],
                ],
            ],
        ];

        $seededProducts = [];

        foreach ($catalog as $index => $row) {
            $product = Product::query()->updateOrCreate(
                [
                    'company_id' => $company->id,
                    'sku' => $row['sku'],
                ],
                [
                    'type' => 'goods',
                    'category_id' => $row['category_id'],
                    'unit_id' => $unit->id,
                    'unit' => 'pcs',
                    'name' => $row['name'],
                    'description' => $row['description'],
                    'barcode' => $row['barcode'],
                    'sell_price' => $row['sell_price'],
                    'cost_price' => $row['cost_price'],
                    'weight_gram' => $row['weight_gram'],
                    'track_stock' => true,
                    'min_stock' => 3,
                    'is_active' => true,
                ],
            );

            if ($outlet) {
                ProductOutletPrice::query()->updateOrCreate(
                    ['product_id' => $product->id, 'outlet_id' => $outlet->id],
                    ['company_id' => $company->id, 'sell_price' => $product->sell_price],
                );

                $balance = StockBalance::query()->firstOrCreate(
                    [
                        'company_id' => $company->id,
                        'warehouse_id' => $warehouse->id,
                        'product_id' => $product->id,
                    ],
                    [
                        'outlet_id' => $outlet->id,
                        'qty' => $row['qty'],
                        'avg_cost' => (int) $product->cost_price,
                        'cost_value' => 0,
                    ],
                );
                if ((int) $balance->qty <= 0) {
                    $balance->update(['qty' => $row['qty']]);
                }

                StockMovement::query()->firstOrCreate(
                    [
                        'company_id' => $company->id,
                        'product_id' => $product->id,
                        'ref_type' => 'product',
                        'ref_id' => $product->id,
                        'note' => 'storefront-shop-demo',
                    ],
                    [
                        'outlet_id' => $outlet->id,
                        'warehouse_id' => $warehouse->id,
                        'type' => 'adjustment',
                        'qty_change' => $row['qty'],
                        'qty_after' => max((int) $balance->qty, $row['qty']),
                    ],
                );
            }

            $this->syncGallery($product, $row['gallery'], $dir);
            $this->syncVariants($product, $row['variants'] ?? [], $dir);

            $seededProducts[] = [
                'product' => $product,
                'sort_order' => $index + 1,
                'is_deal' => (bool) ($row['is_deal'] ?? false),
                'is_new_arrival' => (bool) ($row['is_new_arrival'] ?? false),
                'is_bestseller' => (bool) ($row['is_bestseller'] ?? false),
            ];
        }

        $storefront = app(StorefrontService::class)->forCompany($company);
        $storefront->forceFill([
            'site_kind' => 'shop',
            'template_key' => 'shop_avalon',
            'status' => 'published',
            'published_at' => now(),
            'title' => 'KEA Demo Shop',
            'tagline' => 'Apparel & essentials untuk gaya harian',
            'about' => 'Toko demo untuk melihat gallery, deskripsi, dan varian produk di online shop.',
            'contact_email' => 'shop@demo.test',
            'contact_phone' => '081234567890',
            'contact_address' => 'Jl. Merdeka No. 1, Jakarta',
            'stock_mode' => 'realtime',
            'outlet_id' => $outlet?->id,
            'warehouse_id' => $warehouse->id,
            'bank_accounts' => [
                [
                    'bank_name' => 'BCA',
                    'account_name' => 'Toko Demo',
                    'account_number' => '1234567890',
                ],
            ],
            'shipping' => [
                'enabled' => true,
                'default_weight_gram' => 500,
                'couriers' => ['jne', 'jnt', 'sicepat'],
            ],
            'brand_colors' => [
                'primary' => '#111111',
                'accent' => '#da3f3f',
                'background' => '#ffffff',
                'text' => '#111111',
            ],
        ])->save();

        $blocks = StorefrontCatalog::presetBlocksFor('shop_avalon');
        if (isset($blocks[0]) && ($blocks[0]['type'] ?? null) === 'hero') {
            $blocks[0]['props']['headline'] = 'KEA Demo Shop';
            $blocks[0]['props']['subheadline'] = 'Lihat gallery, deskripsi, dan pilihan varian di halaman produk.';
        }

        StorefrontPage::query()->updateOrCreate(
            [
                'storefront_id' => $storefront->id,
                'kind' => 'home',
            ],
            [
                'company_id' => $company->id,
                'slug' => 'home',
                'title' => 'Beranda',
                'content' => ['blocks' => $blocks],
                'sort_order' => 0,
                'is_published' => true,
            ],
        );

        StorefrontDomain::query()->updateOrCreate(
            [
                'company_id' => $company->id,
                'host' => 'demo-shop.localhost',
            ],
            [
                'storefront_id' => $storefront->id,
                'status' => 'active',
                'acquisition' => 'custom',
                'is_primary' => true,
                'verified_at' => now(),
                'ssl_status' => 'ok',
            ],
        );

        foreach ($seededProducts as $item) {
            /** @var Product $product */
            $product = $item['product'];
            StorefrontProduct::query()->updateOrCreate(
                [
                    'storefront_id' => $storefront->id,
                    'product_id' => $product->id,
                ],
                [
                    'company_id' => $company->id,
                    'is_visible' => true,
                    'sort_order' => $item['sort_order'],
                    'allocated_qty' => null,
                    'override_price' => null,
                    'is_deal' => $item['is_deal'],
                    'is_new_arrival' => $item['is_new_arrival'],
                    'is_bestseller' => $item['is_bestseller'],
                ],
            );
        }

        // Juga publish beberapa produk demo lama biar katalog lebih ramai.
        $legacy = Product::query()
            ->where('company_id', $company->id)
            ->whereIn('sku', ['MIN-001', 'MAK-001', 'SEM-001'])
            ->get();
        $sort = count($seededProducts) + 1;
        foreach ($legacy as $product) {
            StorefrontProduct::query()->updateOrCreate(
                [
                    'storefront_id' => $storefront->id,
                    'product_id' => $product->id,
                ],
                [
                    'company_id' => $company->id,
                    'is_visible' => true,
                    'sort_order' => $sort++,
                    'allocated_qty' => null,
                    'override_price' => null,
                ],
            );
        }

        $this->command?->info('Storefront shop demo siap: KEA Demo Shop (shop_avalon).');
        $this->command?->info('Login owner@demo.test / password, buka Storefront → Preview atau domain demo-shop.localhost.');
    }

    /**
     * @param  list<array{label: string, rgb: array{0:int,1:int,2:int}}>  $gallery
     */
    private function syncGallery(Product $product, array $gallery, string $dir): void
    {
        $product->images()->delete();
        foreach ($gallery as $i => $shot) {
            $file = $product->id.'_gallery_'.$i.'_'.Str::lower(Str::random(6)).'.jpg';
            $path = $dir.DIRECTORY_SEPARATOR.$file;
            $this->writeJpeg($path, $shot['label'], $shot['rgb'][0], $shot['rgb'][1], $shot['rgb'][2]);
            ProductImage::query()->create([
                'company_id' => $product->company_id,
                'product_id' => $product->id,
                'path' => 'products/'.$file,
                'sort_order' => $i,
                'is_primary' => $i === 0,
            ]);
        }
    }

    /**
     * @param  list<array{name: string, show_in_storefront: bool, options: list<array{name: string, extra_price?: int, rgb?: array{0:int,1:int,2:int}}>}>  $variants
     */
    private function syncVariants(Product $product, array $variants, string $dir): void
    {
        ProductVariantOption::query()->where('product_id', $product->id)->delete();
        ProductVariantAttribute::query()->where('product_id', $product->id)->delete();

        foreach ($variants as $attrIndex => $attr) {
            $attribute = ProductVariantAttribute::query()->create([
                'company_id' => $product->company_id,
                'product_id' => $product->id,
                'name' => $attr['name'],
                'sort_order' => $attrIndex,
                'show_in_storefront' => (bool) ($attr['show_in_storefront'] ?? true),
            ]);

            foreach ($attr['options'] as $optIndex => $opt) {
                $imagePath = null;
                if (isset($opt['rgb']) && is_array($opt['rgb'])) {
                    $file = $product->id.'_opt_'.$attrIndex.'_'.$optIndex.'_'.Str::lower(Str::random(6)).'.jpg';
                    $full = $dir.DIRECTORY_SEPARATOR.$file;
                    $this->writeJpeg($full, (string) $opt['name'], $opt['rgb'][0], $opt['rgb'][1], $opt['rgb'][2]);
                    $imagePath = 'products/'.$file;
                }

                ProductVariantOption::query()->create([
                    'company_id' => $product->company_id,
                    'product_id' => $product->id,
                    'attribute_id' => $attribute->id,
                    'name' => $opt['name'],
                    'sort_order' => $optIndex,
                    'extra_price' => max(0, (int) ($opt['extra_price'] ?? 0)),
                    'image_path' => $imagePath,
                    'is_active' => true,
                ]);
            }
        }
    }

    private function writeJpeg(string $path, string $label, int $r, int $g, int $b): void
    {
        if (! function_exists('imagecreatetruecolor')) {
            file_put_contents($path, '');

            return;
        }

        $im = imagecreatetruecolor(900, 900);
        $bg = imagecolorallocate($im, max(0, min(255, $r)), max(0, min(255, $g)), max(0, min(255, $b)));
        imagefill($im, 0, 0, $bg);

        $fg = (($r + $g + $b) / 3) > 140
            ? imagecolorallocate($im, 20, 20, 20)
            : imagecolorallocate($im, 255, 255, 255);

        $text = mb_strtoupper(mb_substr($label, 0, 24));
        $font = 5;
        $tw = imagefontwidth($font) * strlen($text);
        $th = imagefontheight($font);
        imagestring($im, $font, (int) ((900 - $tw) / 2), (int) ((900 - $th) / 2), $text, $fg);

        imagejpeg($im, $path, 88);
        imagedestroy($im);
    }
}
