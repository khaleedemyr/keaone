<?php

use App\Models\Company;
use App\Services\RoleService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_balances', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_balances', 'avg_cost')) {
                $table->unsignedBigInteger('avg_cost')->default(0)->after('qty');
            }
            if (! Schema::hasColumn('stock_balances', 'cost_value')) {
                $table->unsignedBigInteger('cost_value')->default(0)->after('avg_cost');
            }
            if (! Schema::hasColumn('stock_balances', 'period_year')) {
                $table->unsignedSmallInteger('period_year')->nullable()->after('cost_value');
            }
            if (! Schema::hasColumn('stock_balances', 'period_month')) {
                $table->unsignedTinyInteger('period_month')->nullable()->after('period_year');
            }
            if (! Schema::hasColumn('stock_balances', 'period_opening_qty')) {
                $table->integer('period_opening_qty')->default(0)->after('period_month');
            }
            if (! Schema::hasColumn('stock_balances', 'period_opening_value')) {
                $table->unsignedBigInteger('period_opening_value')->default(0)->after('period_opening_qty');
            }
            if (! Schema::hasColumn('stock_balances', 'period_receipt_qty')) {
                $table->integer('period_receipt_qty')->default(0)->after('period_opening_value');
            }
            if (! Schema::hasColumn('stock_balances', 'period_receipt_value')) {
                $table->unsignedBigInteger('period_receipt_value')->default(0)->after('period_receipt_qty');
            }
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_movements', 'unit_cost')) {
                $table->unsignedBigInteger('unit_cost')->default(0)->after('qty_after');
            }
            if (! Schema::hasColumn('stock_movements', 'cost_amount')) {
                $table->unsignedBigInteger('cost_amount')->default(0)->after('unit_cost');
            }
            if (! Schema::hasColumn('stock_movements', 'costing_method')) {
                $table->string('costing_method', 32)->nullable()->after('cost_amount');
            }
        });

        if (! Schema::hasTable('stock_cost_layers')) {
            Schema::create('stock_cost_layers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->integer('qty_original')->default(0);
                $table->integer('qty_remaining')->default(0);
                $table->unsignedBigInteger('unit_cost')->default(0);
                $table->timestamp('received_at')->nullable();
                $table->string('ref_type')->nullable();
                $table->unsignedBigInteger('ref_id')->nullable();
                $table->timestamps();

                $table->index(['warehouse_id', 'product_id', 'received_at', 'id'], 'stock_cost_layers_wh_product_received_index');
                $table->index(['ref_type', 'ref_id']);
            });
        }

        if (! Schema::hasTable('stock_cost_consumptions')) {
            Schema::create('stock_cost_consumptions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                // No FK — stock_movements is partitioned (MySQL error 1506).
                $table->unsignedBigInteger('stock_movement_id');
                $table->foreignId('stock_cost_layer_id')->constrained('stock_cost_layers')->restrictOnDelete();
                $table->integer('qty')->default(0);
                $table->unsignedBigInteger('unit_cost')->default(0);
                $table->unsignedBigInteger('cost_amount')->default(0);
                $table->timestamps();

                $table->index(['stock_movement_id']);
                $table->index(['stock_cost_layer_id']);
            });
        }

        if (Schema::hasColumn('stock_balances', 'avg_cost') && Schema::hasColumn('products', 'cost_price')) {
            DB::statement('
                UPDATE stock_balances
                SET avg_cost = COALESCE((SELECT cost_price FROM products WHERE products.id = stock_balances.product_id), 0),
                    cost_value = qty * COALESCE((SELECT cost_price FROM products WHERE products.id = stock_balances.product_id), 0)
                WHERE qty > 0 AND avg_cost = 0
            ');
        }

        app(RoleService::class);
        Company::query()->each(fn (Company $company) => app(RoleService::class)->ensureTenantRoles($company));
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_cost_consumptions');
        Schema::dropIfExists('stock_cost_layers');

        Schema::table('stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('stock_movements', 'costing_method')) {
                $table->dropColumn(['unit_cost', 'cost_amount', 'costing_method']);
            }
        });

        Schema::table('stock_balances', function (Blueprint $table) {
            $cols = [
                'avg_cost',
                'cost_value',
                'period_year',
                'period_month',
                'period_opening_qty',
                'period_opening_value',
                'period_receipt_qty',
                'period_receipt_value',
            ];
            $drop = array_values(array_filter($cols, fn (string $col) => Schema::hasColumn('stock_balances', $col)));
            if ($drop !== []) {
                $table->dropColumn($drop);
            }
        });
    }
};
