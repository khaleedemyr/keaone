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
            $plan->modules = ModuleCatalog::resolve($plan->modules);
            $plan->save();
        });

        Company::query()->each(function (Company $company) {
            $company->modules = ModuleCatalog::resolve($company->modules);
            $company->save();
        });
    }

    public function down(): void
    {
        //
    }
};
