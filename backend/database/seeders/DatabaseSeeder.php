<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            CatalogSeeder::class,
            DemoSeeder::class,
            PromotionSeeder::class,
        ]);

        $billing = app(\App\Services\BillingService::class);
        \App\Models\Company::query()->doesntHave('subscription')->get()->each(
            fn (\App\Models\Company $company) => $billing->startTrial($company),
        );
    }
}
