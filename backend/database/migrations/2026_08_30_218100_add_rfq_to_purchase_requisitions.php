<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            if (! Schema::hasColumn('purchase_requisitions', 'rfq_id')) {
                $table->unsignedBigInteger('rfq_id')->nullable()->after('warehouse_id');
                $table->index('rfq_id');
            }
            if (! Schema::hasColumn('purchase_requisitions', 'vendor_quote_id')) {
                $table->unsignedBigInteger('vendor_quote_id')->nullable()->after('rfq_id');
                $table->index('vendor_quote_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_requisitions', 'vendor_quote_id')) {
                $table->dropIndex(['vendor_quote_id']);
                $table->dropColumn('vendor_quote_id');
            }
            if (Schema::hasColumn('purchase_requisitions', 'rfq_id')) {
                $table->dropIndex(['rfq_id']);
                $table->dropColumn('rfq_id');
            }
        });
    }
};
