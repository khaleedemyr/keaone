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
                $po = RolePermission::query()
                    ->where('role_id', $role->id)
                    ->where('menu_key', 'purchaseorders')
                    ->first();
                if (! $po) {
                    return;
                }

                RolePermission::query()->updateOrCreate(
                    [
                        'role_id' => $role->id,
                        'menu_key' => 'deliveryschedules',
                    ],
                    [
                        'can_view' => (bool) $po->can_view,
                        'can_create' => (bool) $po->can_create,
                        'can_edit' => (bool) $po->can_edit,
                        'can_delete' => (bool) $po->can_delete,
                    ],
                );
            });
    }

    public function down(): void
    {
        RolePermission::query()->where('menu_key', 'deliveryschedules')->delete();
    }
};
