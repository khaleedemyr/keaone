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
                $ref = RolePermission::query()
                    ->where('role_id', $role->id)
                    ->where('menu_key', 'rfqs')
                    ->first();
                if (! $ref) {
                    $ref = RolePermission::query()
                        ->where('role_id', $role->id)
                        ->where('menu_key', 'purchaserequisitions')
                        ->first();
                }
                if (! $ref) {
                    return;
                }

                RolePermission::query()->updateOrCreate(
                    [
                        'role_id' => $role->id,
                        'menu_key' => 'supplierpricelists',
                    ],
                    [
                        'can_view' => (bool) $ref->can_view,
                        'can_create' => (bool) $ref->can_create,
                        'can_edit' => (bool) $ref->can_edit,
                        'can_delete' => (bool) $ref->can_delete,
                    ],
                );
            });
    }

    public function down(): void
    {
        RolePermission::query()->where('menu_key', 'supplierpricelists')->delete();
    }
};
