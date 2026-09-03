<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_productions')) {
            Schema::table('stock_productions', function (Blueprint $table) {
                if (! Schema::hasColumn('stock_productions', 'lot_code')) {
                    $table->string('lot_code', 64)->nullable()->after('note');
                }
                if (! Schema::hasColumn('stock_productions', 'scrap_qty')) {
                    $table->unsignedInteger('scrap_qty')->default(0)->after('qty');
                }
            });
        }

        if (Schema::hasTable('stock_production_items') && ! Schema::hasColumn('stock_production_items', 'qty_actual')) {
            Schema::table('stock_production_items', function (Blueprint $table) {
                $table->unsignedInteger('qty_actual')->nullable()->after('qty_planned');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('stock_productions')) {
            Schema::table('stock_productions', function (Blueprint $table) {
                if (Schema::hasColumn('stock_productions', 'lot_code')) {
                    $table->dropColumn('lot_code');
                }
                if (Schema::hasColumn('stock_productions', 'scrap_qty')) {
                    $table->dropColumn('scrap_qty');
                }
            });
        }

        if (Schema::hasTable('stock_production_items') && Schema::hasColumn('stock_production_items', 'qty_actual')) {
            Schema::table('stock_production_items', function (Blueprint $table) {
                $table->dropColumn('qty_actual');
            });
        }
    }
};
