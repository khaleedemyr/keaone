<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goods_receipts', function (Blueprint $table) {
            if (! Schema::hasColumn('goods_receipts', 'voided_by')) {
                // No FK — goods_receipts is partitioned (MySQL error 1506).
                $table->unsignedBigInteger('voided_by')->nullable()->after('received_at');
            }
            if (! Schema::hasColumn('goods_receipts', 'voided_at')) {
                $table->timestamp('voided_at')->nullable()->after('voided_by');
            }
            if (! Schema::hasColumn('goods_receipts', 'void_reason')) {
                $table->string('void_reason')->nullable()->after('voided_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('goods_receipts', function (Blueprint $table) {
            if (Schema::hasColumn('goods_receipts', 'voided_by')) {
                $table->dropColumn('voided_by');
            }
            if (Schema::hasColumn('goods_receipts', 'voided_at')) {
                $table->dropColumn('voided_at');
            }
            if (Schema::hasColumn('goods_receipts', 'void_reason')) {
                $table->dropColumn('void_reason');
            }
        });
    }
};
