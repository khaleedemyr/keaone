<?php

use App\Models\Company;
use App\Models\Role;
use App\Models\RolePermission;
use App\Services\RoleService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $roles = app(RoleService::class);
        Company::query()->each(fn (Company $company) => $roles->ensureTenantRoles($company));

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

                RolePermission::query()->updateOrCreate(
                    [
                        'role_id' => $role->id,
                        'menu_key' => 'vendorprepayments',
                    ],
                    [
                        'can_view' => (bool) $vi->can_view,
                        'can_create' => (bool) $vi->can_create,
                        'can_edit' => (bool) $vi->can_edit,
                        'can_delete' => (bool) $vi->can_delete,
                    ],
                );
            });
    }

    public function down(): void
    {
        RolePermission::query()->where('menu_key', 'vendorprepayments')->delete();
    }
};
