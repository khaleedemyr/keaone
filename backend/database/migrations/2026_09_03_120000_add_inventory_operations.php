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
        if (! Schema::hasTable('stock_transfers')) {
            Schema::create('stock_transfers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('from_warehouse_id')->constrained('warehouses')->restrictOnDelete();
                $table->foreignId('to_warehouse_id')->constrained('warehouses')->restrictOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('status')->default('draft');
                $table->text('note')->nullable();
                $table->timestamp('shipped_at')->nullable();
                $table->timestamp('received_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->unique(['company_id', 'client_uuid']);
                $table->index(['company_id', 'status']);
            });
        }

        if (! Schema::hasTable('stock_transfer_items')) {
            Schema::create('stock_transfer_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('stock_transfer_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->unsignedInteger('qty');
                $table->unsignedInteger('qty_input')->nullable();
                $table->string('unit')->nullable();
                $table->string('unit_level')->nullable();
                $table->unsignedSmallInteger('factor_to_base')->default(1);
                $table->string('name_snapshot');
                $table->unsignedBigInteger('unit_cost')->default(0);
                $table->timestamps();

                $table->index(['stock_transfer_id', 'product_id']);
            });
        }

        if (! Schema::hasTable('stock_opnames')) {
            Schema::create('stock_opnames', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('status')->default('draft');
                $table->text('note')->nullable();
                $table->timestamp('counted_at')->nullable();
                $table->timestamp('confirmed_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->unique(['company_id', 'client_uuid']);
                $table->index(['company_id', 'status']);
            });
        }

        if (! Schema::hasTable('stock_opname_items')) {
            Schema::create('stock_opname_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('stock_opname_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->integer('book_qty')->default(0);
                $table->integer('counted_qty')->default(0);
                $table->integer('variance')->default(0);
                $table->string('name_snapshot');
                $table->string('unit')->nullable();
                $table->timestamps();

                $table->index(['stock_opname_id', 'product_id']);
            });
        }

        if (! Schema::hasTable('stock_adjustments')) {
            Schema::create('stock_adjustments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('status')->default('draft');
                $table->string('reason')->default('other');
                $table->text('note')->nullable();
                $table->timestamp('confirmed_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->unique(['company_id', 'client_uuid']);
                $table->index(['company_id', 'status']);
            });
        }

        if (! Schema::hasTable('stock_adjustment_items')) {
            Schema::create('stock_adjustment_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('stock_adjustment_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->integer('qty_change');
                $table->unsignedInteger('qty_input')->nullable();
                $table->string('unit')->nullable();
                $table->string('unit_level')->nullable();
                $table->unsignedSmallInteger('factor_to_base')->default(1);
                $table->string('name_snapshot');
                $table->timestamps();

                $table->index(['stock_adjustment_id', 'product_id']);
            });
        }

        $roles = app(RoleService::class);
        Company::query()->each(fn (Company $company) => $roles->ensureTenantRoles($company));

        $newMenus = ['stocktransfers', 'stockopnames', 'stockadjustments'];

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
        Schema::dropIfExists('stock_adjustment_items');
        Schema::dropIfExists('stock_adjustments');
        Schema::dropIfExists('stock_opname_items');
        Schema::dropIfExists('stock_opnames');
        Schema::dropIfExists('stock_transfer_items');
        Schema::dropIfExists('stock_transfers');

        RolePermission::query()
            ->whereIn('menu_key', ['stocktransfers', 'stockopnames', 'stockadjustments'])
            ->delete();
    }
};
