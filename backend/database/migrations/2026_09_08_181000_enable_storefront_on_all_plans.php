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
            $modules['storefront'] = true;
            $plan->modules = $modules;
            $plan->save();
        });
    }

    public function down(): void
    {
        Plan::query()->each(function (Plan $plan) {
            $modules = ModuleCatalog::resolve($plan->modules);
            // Keep starter locked again; growth/pro remain allowed.
            $modules['storefront'] = in_array($plan->slug, ['growth', 'pro'], true);
            $plan->modules = $modules;
            $plan->save();
        });
    }
};
