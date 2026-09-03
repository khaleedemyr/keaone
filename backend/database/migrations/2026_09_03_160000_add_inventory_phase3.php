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
        if (Schema::hasTable('warehouses') && ! Schema::hasColumn('warehouses', 'location_type')) {
            Schema::table('warehouses', function (Blueprint $table) {
                $table->string('location_type', 32)->default('general')->after('address');
            });
        }

        if (! Schema::hasTable('stock_productions')) {
            Schema::create('stock_productions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('status')->default('draft');
                $table->unsignedInteger('qty');
                $table->string('product_name_snapshot');
                $table->text('note')->nullable();
                $table->timestamp('confirmed_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->unique(['company_id', 'client_uuid']);
                $table->index(['company_id', 'status']);
            });
        }

        if (! Schema::hasTable('stock_production_items')) {
            Schema::create('stock_production_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('stock_production_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->unsignedInteger('qty_planned');
                $table->string('unit')->nullable();
                $table->string('name_snapshot');
                $table->timestamps();

                $table->index(['stock_production_id', 'product_id']);
            });
        }

        $roles = app(RoleService::class);
        Company::query()->each(fn (Company $company) => $roles->ensureTenantRoles($company));

        $newMenus = ['stockwaste', 'stockproduction'];

        Role::query()
            ->where('scope', 'tenant')
            ->each(function (Role $role) use ($newMenus) {
                $source = RolePermission::query()
                    ->where('role_id', $role->id)
                    ->where('menu_key', 'stock')
                    ->first();

                if (! $source) {
                    return;
                }

                foreach ($newMenus as $menu) {
                    RolePermission::query()->updateOrCreate(
                        [
                            'role_id' => $role->id,
                            'menu_key' => $menu,
                        ],
                        [
                            'can_view' => (bool) $source->can_view,
                            'can_create' => (bool) $source->can_view,
                            'can_edit' => (bool) $source->can_view,
                            'can_delete' => (bool) $source->can_view,
                        ],
                    );
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_production_items');
        Schema::dropIfExists('stock_productions');

        if (Schema::hasTable('warehouses') && Schema::hasColumn('warehouses', 'location_type')) {
            Schema::table('warehouses', function (Blueprint $table) {
                $table->dropColumn('location_type');
            });
        }

        RolePermission::query()
            ->whereIn('menu_key', ['stockwaste', 'stockproduction'])
            ->delete();
    }
};
