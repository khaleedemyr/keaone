<?php

use App\Models\Role;
use App\Models\RolePermission;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Role::query()
            ->where('scope', 'tenant')
            ->each(function (Role $role) {
                $source = null;
                foreach (['purchasesettings', 'glaccounts', 'possettings'] as $menuKey) {
                    $source = RolePermission::query()
                        ->where('role_id', $role->id)
                        ->where('menu_key', $menuKey)
                        ->first();
                    if ($source) {
                        break;
                    }
                }

                if (! $source) {
                    return;
                }

                RolePermission::query()->updateOrCreate(
                    [
                        'role_id' => $role->id,
                        'menu_key' => 'financesettings',
                    ],
                    [
                        'can_view' => (bool) $source->can_view,
                        'can_create' => false,
                        'can_edit' => (bool) $source->can_edit,
                        'can_delete' => false,
                    ],
                );
            });
    }

    public function down(): void
    {
        RolePermission::query()->where('menu_key', 'financesettings')->delete();
    }
};
