<?php

use App\Models\Plan;
use App\Support\ModuleCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Plan::query()->each(function (Plan $plan) {
            $modules = ModuleCatalog::resolve($plan->modules);
            // Growth / Pro get storefront allowed; starter stays off.
            $modules['storefront'] = in_array($plan->slug, ['growth', 'pro'], true);
            $plan->modules = $modules;
            $plan->save();
        });
    }

    public function down(): void
    {
        Plan::query()->each(function (Plan $plan) {
            $modules = ModuleCatalog::resolve($plan->modules);
            unset($modules['storefront']);
            $plan->modules = ModuleCatalog::resolve($modules);
            $plan->save();
        });
    }
};
