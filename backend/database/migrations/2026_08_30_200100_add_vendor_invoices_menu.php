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
                $gr = RolePermission::query()
                    ->where('role_id', $role->id)
                    ->where('menu_key', 'goodsreceipts')
                    ->first();
                if (! $gr) {
                    return;
                }

                RolePermission::query()->updateOrCreate(
                    [
                        'role_id' => $role->id,
                        'menu_key' => 'vendorinvoices',
                    ],
                    [
                        'can_view' => (bool) $gr->can_view,
                        'can_create' => (bool) $gr->can_create,
                        'can_edit' => (bool) $gr->can_edit,
                        'can_delete' => (bool) $gr->can_delete,
                    ],
                );
            });
    }

    public function down(): void
    {
        RolePermission::query()->where('menu_key', 'vendorinvoices')->delete();
    }
};
