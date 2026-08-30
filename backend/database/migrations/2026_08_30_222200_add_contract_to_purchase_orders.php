<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('purchase_orders', 'procurement_contract_id')) {
                $table->foreignId('procurement_contract_id')->nullable()->after('purchase_requisition_id')->constrained()->nullOnDelete();
            }
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            if (! Schema::hasColumn('purchase_order_items', 'procurement_contract_item_id')) {
                $table->foreignId('procurement_contract_item_id')->nullable()->after('purchase_requisition_item_id')->constrained('procurement_contract_items')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_order_items', 'procurement_contract_item_id')) {
                $table->dropConstrainedForeignId('procurement_contract_item_id');
            }
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_orders', 'procurement_contract_id')) {
                $table->dropConstrainedForeignId('procurement_contract_id');
            }
        });
    }
};
