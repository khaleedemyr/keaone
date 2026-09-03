<?php

use App\Models\Company;
use App\Models\Role;
use App\Models\RolePermission;
use App\Services\RoleService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'max_stock')) {
            Schema::table('products', function (Blueprint $table) {
                $table->unsignedInteger('max_stock')->default(0)->after('min_stock');
            });
        }

        $roles = app(RoleService::class);
        Company::query()->each(fn (Company $company) => $roles->ensureTenantRoles($company));

        Role::query()
            ->where('scope', 'tenant')
            ->each(function (Role $role) {
                $source = RolePermission::query()
                    ->where('role_id', $role->id)
                    ->where('menu_key', 'stock')
                    ->first();
                if (! $source) {
                    return;
                }

                RolePermission::query()->updateOrCreate(
                    [
                        'role_id' => $role->id,
                        'menu_key' => 'stockvaluation',
                    ],
                    [
                        'can_view' => (bool) $source->can_view,
                        'can_create' => false,
                        'can_edit' => false,
                        'can_delete' => false,
                    ],
                );
            });
    }

    public function down(): void
    {
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'max_stock')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('max_stock');
            });
        }

        RolePermission::query()->where('menu_key', 'stockvaluation')->delete();
    }
};
