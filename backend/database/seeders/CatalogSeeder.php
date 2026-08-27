<?php

namespace Database\Seeders;

use App\Models\BusinessType;
use App\Models\Company;
use App\Models\Plan;
use App\Services\BillingService;
use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            ['slug' => 'retail', 'name' => 'Retail / minimarket', 'sort_order' => 1],
            ['slug' => 'fnb', 'name' => 'F&B / resto / cafe', 'sort_order' => 2],
            ['slug' => 'pharmacy', 'name' => 'Apotek', 'sort_order' => 3],
            ['slug' => 'fashion', 'name' => 'Fashion / butik', 'sort_order' => 4],
            ['slug' => 'service', 'name' => 'Jasa', 'sort_order' => 5],
            ['slug' => 'wholesale', 'name' => 'Grosir', 'sort_order' => 6],
            ['slug' => 'mixed', 'name' => 'Campuran', 'sort_order' => 7],
        ];

        foreach ($types as $type) {
            BusinessType::query()->firstOrCreate(
                ['slug' => $type['slug']],
                ['name' => $type['name'], 'is_active' => true, 'sort_order' => $type['sort_order']],
            );
        }

        $plans = [
            [
                'slug' => 'starter',
                'name' => 'Starter',
                'price_monthly' => 149000,
                'price_yearly' => 1490000,
                'trial_days' => 14,
                'max_users' => 3,
                'max_outlets' => 1,
                'is_default' => true,
                'sort_order' => 1,
                'modules' => [
                    'pos' => true,
                    'stock' => true,
                    'invoice' => true,
                    'purchase' => true,
                    'work_order' => false,
                    'promotions' => true,
                    'choices' => true,
                ],
            ],
            [
                'slug' => 'growth',
                'name' => 'Growth',
                'price_monthly' => 349000,
                'price_yearly' => 3490000,
                'trial_days' => 14,
                'max_users' => 10,
                'max_outlets' => 5,
                'is_default' => false,
                'sort_order' => 2,
                'modules' => [
                    'pos' => true,
                    'stock' => true,
                    'invoice' => true,
                    'purchase' => true,
                    'work_order' => false,
                    'promotions' => true,
                    'choices' => true,
                ],
            ],
            [
                'slug' => 'pro',
                'name' => 'Pro',
                'price_monthly' => 699000,
                'price_yearly' => 6990000,
                'trial_days' => 14,
                'max_users' => null,
                'max_outlets' => null,
                'is_default' => false,
                'sort_order' => 3,
                'modules' => [
                    'pos' => true,
                    'stock' => true,
                    'invoice' => true,
                    'purchase' => true,
                    'work_order' => true,
                    'promotions' => true,
                    'choices' => true,
                ],
            ],
        ];

        foreach ($plans as $row) {
            Plan::query()->updateOrCreate(['slug' => $row['slug']], [...$row, 'is_active' => true]);
        }

        $billing = app(BillingService::class);
        Company::query()->doesntHave('subscription')->get()->each(function (Company $company) use ($billing) {
            $billing->startTrial($company);
        });
    }
}
