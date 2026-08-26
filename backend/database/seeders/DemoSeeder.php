<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Choice;
use App\Models\ChoiceType;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Contact;
use App\Models\DiningLayout;
use App\Models\ItemType;
use App\Models\Outlet;
use App\Models\PriceChannel;
use App\Models\Product;
use App\Models\ProductBomItem;
use App\Models\ProductChannelPrice;
use App\Models\ProductOutletPrice;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\SubCategory;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = new Company;

        $company = Company::query()->firstOrCreate(
            ['name' => 'Toko Demo'],
            [
                'business_type' => 'retail',
                'phone' => '081234567890',
                'address' => 'Jl. Merdeka No. 1, Jakarta',
                'modules' => $defaults->defaultModules(),
                'settings' => $defaults->defaultSettings(),
                'status' => 'active',
            ],
        );

        $outlet = Outlet::query()->firstOrCreate(
            [
                'company_id' => $company->id,
                'name' => 'Utama',
            ],
            [
                'address' => 'Jl. Merdeka No. 1, Jakarta',
                'is_default' => true,
            ],
        );

        $owner = User::query()->firstOrCreate(
            ['email' => 'owner@demo.test'],
            [
                'name' => 'Owner Demo',
                'username' => 'owner',
                'password' => 'password',
            ],
        );

        $cashier = User::query()->firstOrCreate(
            ['email' => 'kasir@demo.test'],
            [
                'name' => 'Kasir Demo',
                'username' => 'kasir',
                'password' => 'password',
            ],
        );

        CompanyUser::query()->firstOrCreate(
            [
                'company_id' => $company->id,
                'user_id' => $owner->id,
            ],
            [
                'outlet_id' => $outlet->id,
                'role' => 'owner',
                'is_active' => true,
            ],
        );

        CompanyUser::query()->firstOrCreate(
            [
                'company_id' => $company->id,
                'user_id' => $cashier->id,
            ],
            [
                'outlet_id' => $outlet->id,
                'role' => 'cashier',
                'is_active' => true,
            ],
        );

        $cafe = Company::query()->firstOrCreate(
            ['name' => 'Cafe Demo'],
            [
                'business_type' => 'fnb',
                'phone' => '081200000001',
                'address' => 'Jl. Braga No. 8, Bandung',
                'modules' => $defaults->defaultModules(),
                'settings' => $defaults->defaultSettings(),
                'status' => 'active',
            ],
        );
        $cafe->settings = array_merge($cafe->defaultSettings(), $cafe->settings ?? [], [
            'pos_mode' => 'cafe',
        ]);
        $cafe->save();

        $cafeOutlet = Outlet::query()->firstOrCreate(
            [
                'company_id' => $cafe->id,
                'name' => 'Utama',
            ],
            [
                'address' => 'Jl. Braga No. 8, Bandung',
                'is_default' => true,
            ],
        );

        DiningLayout::installCafeDemoPlan($cafe->id, $cafeOutlet->id);

        CompanyUser::query()->firstOrCreate(
            [
                'company_id' => $cafe->id,
                'user_id' => $owner->id,
            ],
            [
                'outlet_id' => $cafeOutlet->id,
                'role' => 'owner',
                'is_active' => true,
            ],
        );

        $platform = User::query()->where('email', 'platform@keaone.test')->first()
            ?? User::query()->where('username', 'platform')->first();
        if (! $platform) {
            $platform = User::query()->create([
                'name' => 'KEA Platform',
                'email' => 'platform@keaone.test',
                'username' => 'platform',
                'password' => 'password',
            ]);
        }
        $platform->forceFill(['is_platform' => true, 'platform_role' => 'owner'])->save();

        $roleService = app(\App\Services\RoleService::class);
        $roleService->ensurePlatformRoles();
        $roleService->bindPlatformUsers();
        $roleService->ensureTenantRoles($company);
        $roleService->ensureTenantRoles($cafe);

        $minuman = Category::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Minuman'],
            ['sort_order' => 1],
        );
        $makanan = Category::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Makanan'],
            ['sort_order' => 2],
        );
        $sembako = Category::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Sembako'],
            ['sort_order' => 3],
        );

        $pcs = Unit::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Pcs'],
            ['symbol' => 'pcs', 'sort_order' => 1, 'is_active' => true],
        );
        Unit::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Box'],
            ['symbol' => 'box', 'sort_order' => 2, 'is_active' => true],
        );
        Unit::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Kilogram'],
            ['symbol' => 'kg', 'sort_order' => 3, 'is_active' => true],
        );

        $botol = SubCategory::query()->firstOrCreate(
            ['company_id' => $company->id, 'category_id' => $minuman->id, 'name' => 'Botol'],
            ['sort_order' => 1, 'is_active' => true],
        );
        SubCategory::query()->firstOrCreate(
            ['company_id' => $company->id, 'category_id' => $minuman->id, 'name' => 'Kaleng'],
            ['sort_order' => 2, 'is_active' => true],
        );
        $instan = SubCategory::query()->firstOrCreate(
            ['company_id' => $company->id, 'category_id' => $makanan->id, 'name' => 'Instan'],
            ['sort_order' => 1, 'is_active' => true],
        );

        Warehouse::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Gudang Utama'],
            [
                'outlet_id' => $outlet->id,
                'address' => $outlet->address,
                'is_default' => true,
                'is_active' => true,
            ],
        );

        $products = [
            [
                'category_id' => $minuman->id,
                'sub_category_id' => $botol->id,
                'unit_id' => $pcs->id,
                'name' => 'Air Mineral 600ml',
                'description' => 'Air mineral kemasan botol 600 ml.',
                'sku' => 'MIN-001',
                'barcode' => '8991002100015',
                'sell_price' => 4000,
                'cost_price' => 2500,
                'min_stock' => 12,
                'qty' => 48,
            ],
            [
                'category_id' => $minuman->id,
                'sub_category_id' => $botol->id,
                'unit_id' => $pcs->id,
                'name' => 'Teh Botol',
                'description' => 'Teh manis kemasan botol.',
                'sku' => 'MIN-002',
                'barcode' => '8991002100022',
                'sell_price' => 5000,
                'cost_price' => 3500,
                'min_stock' => 10,
                'qty' => 36,
            ],
            [
                'category_id' => $makanan->id,
                'sub_category_id' => $instan->id,
                'unit_id' => $pcs->id,
                'name' => 'Indomie Goreng',
                'description' => 'Mi instan goreng siap saji.',
                'sku' => 'MAK-001',
                'barcode' => '8991002100039',
                'sell_price' => 3500,
                'cost_price' => 2500,
                'min_stock' => 20,
                'qty' => 80,
            ],
            [
                'category_id' => $makanan->id,
                'unit_id' => $pcs->id,
                'name' => 'Roti Tawar',
                'description' => 'Roti tawar kemasan.',
                'sku' => 'MAK-002',
                'barcode' => '8991002100046',
                'sell_price' => 15000,
                'cost_price' => 11000,
                'min_stock' => 5,
                'qty' => 12,
            ],
            [
                'category_id' => $sembako->id,
                'unit_id' => $pcs->id,
                'name' => 'Beras 5kg',
                'description' => 'Beras premium kemasan 5 kg.',
                'sku' => 'SEM-001',
                'barcode' => '8991002100053',
                'sell_price' => 75000,
                'cost_price' => 65000,
                'min_stock' => 4,
                'qty' => 10,
            ],
            [
                'category_id' => $sembako->id,
                'unit_id' => $pcs->id,
                'name' => 'Gula 1kg',
                'description' => 'Gula pasir kemasan 1 kg.',
                'sku' => null,
                'barcode' => '8991002100060',
                'sell_price' => 18000,
                'cost_price' => 15000,
                'min_stock' => 6,
                'qty' => 20,
            ],
        ];

        foreach ($products as $row) {
            $qty = $row['qty'];
            unset($row['qty']);

            $product = Product::query()->firstOrCreate(
                [
                    'company_id' => $company->id,
                    'barcode' => $row['barcode'],
                ],
                [
                    'type' => 'goods',
                    'unit' => 'pcs',
                    'track_stock' => true,
                    'is_active' => true,
                    ...$row,
                ],
            );

            ProductOutletPrice::query()->firstOrCreate(
                [
                    'product_id' => $product->id,
                    'outlet_id' => $outlet->id,
                ],
                [
                    'company_id' => $company->id,
                    'sell_price' => $product->sell_price,
                ],
            );

            $balance = StockBalance::query()->firstOrCreate(
                [
                    'company_id' => $company->id,
                    'outlet_id' => $outlet->id,
                    'product_id' => $product->id,
                ],
                ['qty' => $qty],
            );

            StockMovement::query()->firstOrCreate(
                [
                    'company_id' => $company->id,
                    'product_id' => $product->id,
                    'ref_type' => 'product',
                    'ref_id' => $product->id,
                    'note' => 'opening',
                ],
                [
                    'outlet_id' => $outlet->id,
                    'type' => 'adjustment',
                    'qty_change' => $qty,
                    'qty_after' => $balance->qty,
                ],
            );
        }

        $kopi = Category::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Kopi'],
            ['sort_order' => 1],
        );
        $nonKopi = Category::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Non Kopi'],
            ['sort_order' => 2],
        );
        $menuMakanan = Category::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Makanan'],
            ['sort_order' => 3],
        );
        $bahan = Category::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Bahan'],
            ['sort_order' => 4],
        );

        Warehouse::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Bar'],
            [
                'outlet_id' => $cafeOutlet->id,
                'address' => $cafeOutlet->address,
                'is_default' => true,
                'is_active' => true,
            ],
        );

        $cafePcs = Unit::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Pcs'],
            ['symbol' => 'pcs', 'sort_order' => 1, 'is_active' => true],
        );

        $tipeMakanan = ItemType::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Makanan'],
            ['sort_order' => 1, 'is_active' => true],
        );
        $tipeMinuman = ItemType::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Minuman'],
            ['sort_order' => 2, 'is_active' => true],
        );
        ItemType::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Snack'],
            ['sort_order' => 3, 'is_active' => true],
        );

        $grabFood = PriceChannel::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'code' => 'grabfood'],
            ['name' => 'GrabFood', 'sort_order' => 1, 'is_active' => true],
        );
        $goFood = PriceChannel::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'code' => 'gofood'],
            ['name' => 'GoFood', 'sort_order' => 2, 'is_active' => true],
        );

        $cafeProducts = [
            [
                'category_id' => $kopi->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Espresso',
                'description' => 'Espresso shot.',
                'sku' => 'KOP-001',
                'barcode' => '8992002100011',
                'sell_price' => 18000,
                'cost_price' => 6000,
                'min_stock' => 20,
                'qty' => 40,
            ],
            [
                'category_id' => $kopi->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Americano',
                'description' => 'Espresso dengan air panas.',
                'sku' => 'KOP-002',
                'barcode' => '8992002100028',
                'sell_price' => 22000,
                'cost_price' => 7000,
                'min_stock' => 20,
                'qty' => 40,
            ],
            [
                'category_id' => $kopi->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Caffe Latte',
                'description' => 'Espresso dengan susu steamed.',
                'sku' => 'KOP-003',
                'barcode' => '8992002100035',
                'sell_price' => 28000,
                'cost_price' => 9000,
                'min_stock' => 15,
                'qty' => 35,
            ],
            [
                'category_id' => $nonKopi->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Teh Tarik',
                'description' => 'Teh susu ditarik.',
                'sku' => 'NKP-001',
                'barcode' => '8992002100042',
                'sell_price' => 18000,
                'cost_price' => 5000,
                'min_stock' => 15,
                'qty' => 30,
            ],
            [
                'category_id' => $nonKopi->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Chocolate',
                'description' => 'Cokelat panas.',
                'sku' => 'NKP-002',
                'barcode' => '8992002100059',
                'sell_price' => 25000,
                'cost_price' => 8000,
                'min_stock' => 15,
                'qty' => 24,
            ],
            [
                'category_id' => $menuMakanan->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Nasi Goreng',
                'description' => 'Nasi goreng special.',
                'sku' => 'MKN-001',
                'barcode' => '8992002100066',
                'sell_price' => 28000,
                'cost_price' => 12000,
                'min_stock' => 10,
                'qty' => 20,
            ],
            [
                'category_id' => $menuMakanan->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Roti Bakar',
                'description' => 'Roti bakar cokelat keju.',
                'sku' => 'MKN-002',
                'barcode' => '8992002100073',
                'sell_price' => 18000,
                'cost_price' => 7000,
                'min_stock' => 10,
                'qty' => 18,
            ],
            [
                'category_id' => $bahan->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Nasi putih',
                'description' => 'Porsi nasi untuk resep.',
                'sku' => 'BHN-001',
                'barcode' => '8992002100080',
                'sell_price' => 0,
                'cost_price' => 3000,
                'min_stock' => 20,
                'qty' => 80,
            ],
            [
                'category_id' => $bahan->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Telur',
                'description' => 'Telur untuk resep.',
                'sku' => 'BHN-002',
                'barcode' => '8992002100097',
                'sell_price' => 0,
                'cost_price' => 2500,
                'min_stock' => 20,
                'qty' => 60,
            ],
            [
                'category_id' => $bahan->id,
                'unit_id' => $cafePcs->id,
                'name' => 'Ayam suwir',
                'description' => 'Ayam suwir untuk resep.',
                'sku' => 'BHN-003',
                'barcode' => '8992002100103',
                'sell_price' => 0,
                'cost_price' => 8000,
                'min_stock' => 15,
                'qty' => 40,
            ],
        ];

        foreach ($cafeProducts as $row) {
            $qty = $row['qty'];
            unset($row['qty']);

            $product = Product::query()->firstOrCreate(
                [
                    'company_id' => $cafe->id,
                    'barcode' => $row['barcode'],
                ],
                [
                    'type' => 'goods',
                    'unit' => 'pcs',
                    'track_stock' => true,
                    'is_active' => true,
                    ...$row,
                ],
            );

            ProductOutletPrice::query()->firstOrCreate(
                [
                    'product_id' => $product->id,
                    'outlet_id' => $cafeOutlet->id,
                ],
                [
                    'company_id' => $cafe->id,
                    'sell_price' => $product->sell_price,
                ],
            );

            $balance = StockBalance::query()->firstOrCreate(
                [
                    'company_id' => $cafe->id,
                    'outlet_id' => $cafeOutlet->id,
                    'product_id' => $product->id,
                ],
                ['qty' => $qty],
            );

            StockMovement::query()->firstOrCreate(
                [
                    'company_id' => $cafe->id,
                    'product_id' => $product->id,
                    'ref_type' => 'product',
                    'ref_id' => $product->id,
                    'note' => 'opening',
                ],
                [
                    'outlet_id' => $cafeOutlet->id,
                    'type' => 'adjustment',
                    'qty_change' => $qty,
                    'qty_after' => $balance->qty,
                ],
            );
        }

        Product::query()
            ->where('company_id', $cafe->id)
            ->where('sell_price', '>', 0)
            ->get()
            ->each(function (Product $product) use ($cafe, $grabFood, $goFood) {
                ProductChannelPrice::query()->firstOrCreate(
                    [
                        'product_id' => $product->id,
                        'price_channel_id' => $grabFood->id,
                    ],
                    [
                        'company_id' => $cafe->id,
                        'sell_price' => (int) round($product->sell_price * 1.15),
                    ],
                );
                ProductChannelPrice::query()->firstOrCreate(
                    [
                        'product_id' => $product->id,
                        'price_channel_id' => $goFood->id,
                    ],
                    [
                        'company_id' => $cafe->id,
                        'sell_price' => (int) round($product->sell_price * 1.2),
                    ],
                );
            });

        $nasiGoreng = Product::query()->where('company_id', $cafe->id)->where('sku', 'MKN-001')->first();
        $nasiPutih = Product::query()->where('company_id', $cafe->id)->where('sku', 'BHN-001')->first();
        $telur = Product::query()->where('company_id', $cafe->id)->where('sku', 'BHN-002')->first();
        $ayam = Product::query()->where('company_id', $cafe->id)->where('sku', 'BHN-003')->first();

        if ($nasiGoreng && $nasiPutih && $telur && $ayam) {
            $nasiGoreng->update(['track_stock' => false]);
            foreach ([$nasiPutih, $telur, $ayam] as $i => $component) {
                ProductBomItem::query()->updateOrCreate(
                    [
                        'product_id' => $nasiGoreng->id,
                        'component_id' => $component->id,
                    ],
                    [
                        'company_id' => $cafe->id,
                        'qty' => 1,
                        'unit_id' => $component->unit_id,
                        'sort_order' => $i,
                    ],
                );
            }
        }

        $saus = ChoiceType::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Saus'],
            ['is_required' => true, 'min_select' => 1, 'max_select' => 1, 'sort_order' => 1, 'is_active' => true],
        );
        $kentang = ChoiceType::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Kentang'],
            ['is_required' => true, 'min_select' => 1, 'max_select' => 1, 'sort_order' => 2, 'is_active' => true],
        );
        $pedas = ChoiceType::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Level pedas'],
            ['is_required' => false, 'min_select' => 0, 'max_select' => 1, 'sort_order' => 3, 'is_active' => true],
        );
        $gula = ChoiceType::query()->firstOrCreate(
            ['company_id' => $cafe->id, 'name' => 'Level gula'],
            ['is_required' => false, 'min_select' => 0, 'max_select' => 1, 'sort_order' => 4, 'is_active' => true],
        );

        $choiceRows = [
            [$saus->id, 'Original', 0, 1],
            [$saus->id, 'BBQ', 3000, 2],
            [$saus->id, 'Cheese', 4000, 3],
            [$kentang->id, 'Regular', 0, 1],
            [$kentang->id, 'Wedges', 3000, 2],
            [$kentang->id, 'Sweet potato', 5000, 3],
            [$pedas->id, 'Tidak pedas', 0, 1],
            [$pedas->id, 'Sedang', 0, 2],
            [$pedas->id, 'Pedas', 0, 3],
            [$gula->id, 'Kurang manis', 0, 1],
            [$gula->id, 'Normal', 0, 2],
            [$gula->id, 'Extra manis', 0, 3],
        ];

        $choiceIds = [];
        foreach ($choiceRows as [$typeId, $name, $extra, $order]) {
            $choice = Choice::query()->firstOrCreate(
                [
                    'company_id' => $cafe->id,
                    'choice_type_id' => $typeId,
                    'name' => $name,
                ],
                [
                    'extra_price' => $extra,
                    'sort_order' => $order,
                    'is_active' => true,
                ],
            );
            $choiceIds[$typeId][] = $choice->id;
        }

        $foodChoices = array_merge($choiceIds[$saus->id] ?? [], $choiceIds[$pedas->id] ?? []);
        $drinkChoices = $choiceIds[$gula->id] ?? [];

        Product::query()
            ->where('company_id', $cafe->id)
            ->whereIn('sku', ['MKN-001', 'MKN-002'])
            ->get()
            ->each(fn (Product $product) => $product->choices()->sync($foodChoices));

        Product::query()
            ->where('company_id', $cafe->id)
            ->whereIn('sku', ['KOP-001', 'KOP-002', 'KOP-003', 'NKP-001', 'NKP-002'])
            ->get()
            ->each(fn (Product $product) => $product->choices()->sync($drinkChoices));

        Product::query()
            ->where('company_id', $cafe->id)
            ->whereIn('sku', ['MKN-001', 'MKN-002'])
            ->update(['item_type_id' => $tipeMakanan->id]);

        Product::query()
            ->where('company_id', $cafe->id)
            ->whereIn('sku', ['KOP-001', 'KOP-002', 'KOP-003', 'NKP-001', 'NKP-002'])
            ->update(['item_type_id' => $tipeMinuman->id]);

        Contact::query()->updateOrCreate(
            [
                'company_id' => $company->id,
                'phone' => '081298765432',
            ],
            [
                'type' => 'customer',
                'name' => 'Budi Santoso',
                'email' => 'budi@example.test',
                'address' => 'Jl. Melati No. 12',
                'city' => 'Jakarta',
                'province' => 'DKI Jakarta',
                'postal_code' => '12110',
                'payment_term' => 'net14',
                'payment_days' => 14,
                'is_active' => true,
            ],
        );

        Contact::query()->updateOrCreate(
            [
                'company_id' => $company->id,
                'phone' => '0215550101',
            ],
            [
                'type' => 'supplier',
                'name' => 'PT Sumber Jaya',
                'email' => 'beli@sumberjaya.test',
                'address' => 'Jl. Industri Raya No. 8',
                'city' => 'Jakarta Utara',
                'province' => 'DKI Jakarta',
                'postal_code' => '14110',
                'npwp' => '10.0.0.1-012.000',
                'bank_name' => 'BCA',
                'bank_account' => '1234567890',
                'bank_account_name' => 'PT Sumber Jaya',
                'payment_term' => 'net30',
                'payment_days' => 30,
                'is_active' => true,
            ],
        );
    }
}
