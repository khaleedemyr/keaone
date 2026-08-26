<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Outlet;
use App\Models\User;
use App\Models\BusinessType;

class ProvisionCompany
{
    public function create(User $user, string $name, string $businessType = 'retail'): Company
    {
        $type = BusinessType::query()->where('slug', $businessType)->where('is_active', true)->first();
        abort_unless($type, 422, 'Jenis usaha tidak valid.');

        $defaults = new Company;
        $billing = app(BillingService::class);
        $plan = $billing->defaultPlan();

        $company = Company::query()->create([
            'name' => $name,
            'business_type' => $type->slug,
            'modules' => $plan->allowedModules(),
            'settings' => $defaults->defaultSettings(),
            'status' => 'active',
        ]);

        $outlet = new Outlet;
        $outlet->company_id = $company->id;
        $outlet->name = 'Utama';
        $outlet->is_default = true;
        $outlet->save();

        CompanyUser::query()->create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'outlet_id' => $outlet->id,
            'role' => 'owner',
            'is_active' => true,
        ]);

        $roles = app(\App\Services\RoleService::class);
        $roles->ensureTenantRoles($company);
        $ownerRole = \App\Models\Role::query()
            ->where('company_id', $company->id)
            ->where('slug', 'owner')
            ->first();
        if ($ownerRole) {
            CompanyUser::query()
                ->where('company_id', $company->id)
                ->where('user_id', $user->id)
                ->update(['role_id' => $ownerRole->id, 'role' => 'owner']);
        }

        $user->forceFill(['last_company_id' => $company->id])->save();

        $billing->startTrial($company, $plan);

        return $company->fresh();
    }
}
