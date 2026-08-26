<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Product;
use App\Models\Promotion;
use Illuminate\Database\Seeder;

class PromotionSeeder extends Seeder
{
    public function run(): void
    {
        Company::query()->orderBy('id')->get()->each(function (Company $company) {
            $this->seedForCompany($company);
        });
    }

    private function seedForCompany(Company $company): void
    {
        $products = Product::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->where('sell_price', '>', 0)
            ->orderBy('id')
            ->get();

        if ($products->isEmpty()) {
            return;
        }

        $first = $products->first();
        $second = $products->skip(1)->first() ?? $first;
        $third = $products->skip(2)->first() ?? $second;

        $rows = [
            [
                'name' => 'Diskon 10% semua',
                'type' => 'percent',
                'value' => 10,
                'scope' => 'sale',
                'code' => 'HEMAT10',
                'apply_mode' => 'manual',
                'priority' => 10,
                'config' => null,
                'product_ids' => [],
            ],
            [
                'name' => 'Potongan Rp5.000',
                'type' => 'fixed',
                'value' => 5000,
                'scope' => 'sale',
                'code' => 'POTONG5',
                'apply_mode' => 'manual',
                'priority' => 5,
                'min_subtotal' => 30000,
                'config' => null,
                'product_ids' => [],
            ],
            [
                'name' => 'B1G1 '.$first->name,
                'type' => 'bogo',
                'value' => 0,
                'scope' => 'item',
                'code' => 'B1G1',
                'apply_mode' => 'auto',
                'priority' => 20,
                'config' => [
                    'buy_qty' => 1,
                    'get_qty' => 1,
                    'buy_product_ids' => [$first->id],
                    'get_product_ids' => [],
                ],
                'product_ids' => [$first->id],
            ],
            [
                'name' => 'Beli '.$first->name.' gratis '.$second->name,
                'type' => 'bogo',
                'value' => 0,
                'scope' => 'item',
                'code' => 'BELIAGRATISB',
                'apply_mode' => 'manual',
                'priority' => 15,
                'config' => [
                    'buy_qty' => 1,
                    'get_qty' => 1,
                    'buy_product_ids' => [$first->id],
                    'get_product_ids' => [$second->id],
                ],
                'product_ids' => array_values(array_unique([$first->id, $second->id])),
            ],
            [
                'name' => 'Paket hemat 2 item',
                'type' => 'bundle',
                'value' => max(1000, (int) round(($first->sell_price + $third->sell_price) * 0.85)),
                'scope' => 'item',
                'code' => 'PAKET2',
                'apply_mode' => 'manual',
                'priority' => 8,
                'config' => [
                    'bundle_price' => max(1000, (int) round(($first->sell_price + $third->sell_price) * 0.85)),
                    'items' => [
                        ['product_id' => $first->id, 'qty' => 1],
                        ['product_id' => $third->id, 'qty' => 1],
                    ],
                ],
                'product_ids' => array_values(array_unique([$first->id, $third->id])),
            ],
        ];

        foreach ($rows as $row) {
            $productIds = $row['product_ids'];
            unset($row['product_ids']);

            $promo = Promotion::query()->updateOrCreate(
                [
                    'company_id' => $company->id,
                    'code' => $row['code'],
                ],
                [
                    'name' => $row['name'],
                    'type' => $row['type'],
                    'value' => $row['value'],
                    'scope' => $row['scope'],
                    'max_discount' => null,
                    'min_subtotal' => $row['min_subtotal'] ?? null,
                    'starts_at' => null,
                    'ends_at' => null,
                    'apply_mode' => $row['apply_mode'],
                    'priority' => $row['priority'],
                    'config' => $row['config'],
                    'sort_order' => 0,
                    'is_active' => true,
                ],
            );

            $promo->products()->sync($productIds);
            $promo->categories()->sync([]);
        }
    }
}
