<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_transfer_items') && ! Schema::hasColumn('stock_transfer_items', 'cost_amount')) {
            Schema::table('stock_transfer_items', function (Blueprint $table) {
                $table->unsignedBigInteger('cost_amount')->default(0)->after('unit_cost');
            });
        }

        if (Schema::hasTable('stock_transfers')) {
            Schema::table('stock_transfers', function (Blueprint $table) {
                if (! Schema::hasColumn('stock_transfers', 'voided_at')) {
                    $table->timestamp('voided_at')->nullable()->after('received_at');
                }
                if (! Schema::hasColumn('stock_transfers', 'voided_by')) {
                    $table->foreignId('voided_by')->nullable()->after('voided_at')->constrained('users')->nullOnDelete();
                }
                if (! Schema::hasColumn('stock_transfers', 'void_reason')) {
                    $table->string('void_reason', 500)->nullable()->after('voided_by');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('stock_transfers')) {
            Schema::table('stock_transfers', function (Blueprint $table) {
                if (Schema::hasColumn('stock_transfers', 'voided_by')) {
                    $table->dropConstrainedForeignId('voided_by');
                }
                foreach (['void_reason', 'voided_at'] as $col) {
                    if (Schema::hasColumn('stock_transfers', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('stock_transfer_items') && Schema::hasColumn('stock_transfer_items', 'cost_amount')) {
            Schema::table('stock_transfer_items', function (Blueprint $table) {
                $table->dropColumn('cost_amount');
            });
        }
    }
};
