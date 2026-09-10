<?php

use App\Models\Company;
use App\Models\Plan;
use App\Support\ModuleCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Plan::query()->each(function (Plan $plan) {
            $modules = ModuleCatalog::resolve($plan->modules);
            $modules['finance'] = true;
            $plan->modules = $modules;
            $plan->save();
        });

        Company::query()->each(function (Company $company) {
            $modules = ModuleCatalog::resolve($company->modules);
            $modules['finance'] = true;
            $company->modules = $modules;
            $company->save();
        });
    }

    public function down(): void
    {
        // Keep finance enabled; intentional no-op.
    }
};
