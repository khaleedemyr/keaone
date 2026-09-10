<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_opname_items')) {
            Schema::table('stock_opname_items', function (Blueprint $table) {
                if (! Schema::hasColumn('stock_opname_items', 'counted_qty_input')) {
                    $table->unsignedInteger('counted_qty_input')->nullable()->after('counted_qty');
                }
                if (! Schema::hasColumn('stock_opname_items', 'unit_level')) {
                    $table->string('unit_level')->nullable()->after('unit');
                }
                if (! Schema::hasColumn('stock_opname_items', 'factor_to_base')) {
                    $table->unsignedInteger('factor_to_base')->default(1)->after('unit_level');
                }
            });
        }

        if (Schema::hasTable('stock_productions')) {
            Schema::table('stock_productions', function (Blueprint $table) {
                if (! Schema::hasColumn('stock_productions', 'qty_input')) {
                    $table->unsignedInteger('qty_input')->nullable()->after('qty');
                }
                if (! Schema::hasColumn('stock_productions', 'unit')) {
                    $table->string('unit')->nullable()->after('qty_input');
                }
                if (! Schema::hasColumn('stock_productions', 'unit_level')) {
                    $table->string('unit_level')->nullable()->after('unit');
                }
                if (! Schema::hasColumn('stock_productions', 'factor_to_base')) {
                    $table->unsignedInteger('factor_to_base')->default(1)->after('unit_level');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('stock_opname_items')) {
            Schema::table('stock_opname_items', function (Blueprint $table) {
                foreach (['counted_qty_input', 'unit_level', 'factor_to_base'] as $column) {
                    if (Schema::hasColumn('stock_opname_items', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('stock_productions')) {
            Schema::table('stock_productions', function (Blueprint $table) {
                foreach (['qty_input', 'unit', 'unit_level', 'factor_to_base'] as $column) {
                    if (Schema::hasColumn('stock_productions', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
