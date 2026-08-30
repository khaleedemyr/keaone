<?php

use App\Models\Company;
use App\Models\GlAccount;
use App\Models\Role;
use App\Models\RolePermission;
use App\Services\GlAccountService;
use App\Services\RoleService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $roles = app(RoleService::class);
        Company::query()->each(fn (Company $company) => $roles->ensureTenantRoles($company));

        $accountService = app(GlAccountService::class);
        Company::query()->each(function (Company $company) use ($accountService) {
            $accountService->ensureDefaults($company);
        });

        Role::query()
            ->where('scope', 'tenant')
            ->each(function (Role $role) {
                $vi = RolePermission::query()
                    ->where('role_id', $role->id)
                    ->where('menu_key', 'vendorinvoices')
                    ->first();
                if (! $vi) {
                    return;
                }

                foreach (['glaccounts', 'gljournals'] as $menu) {
                    RolePermission::query()->updateOrCreate(
                        [
                            'role_id' => $role->id,
                            'menu_key' => $menu,
                        ],
                        [
                            'can_view' => (bool) $vi->can_view,
                            'can_create' => $menu === 'glaccounts' ? (bool) $vi->can_create : false,
                            'can_edit' => $menu === 'glaccounts' ? (bool) $vi->can_edit : false,
                            'can_delete' => false,
                        ],
                    );
                }
            });
    }

    public function down(): void
    {
        RolePermission::query()->whereIn('menu_key', ['glaccounts', 'gljournals'])->delete();
    }
};
