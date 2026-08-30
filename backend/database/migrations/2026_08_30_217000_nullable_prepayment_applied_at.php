<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('vendor_prepayment_applications') && Schema::hasColumn('vendor_prepayment_applications', 'applied_at')) {
            Schema::table('vendor_prepayment_applications', function (Blueprint $table) {
                $table->timestamp('applied_at')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('vendor_prepayment_applications') && Schema::hasColumn('vendor_prepayment_applications', 'applied_at')) {
            Schema::table('vendor_prepayment_applications', function (Blueprint $table) {
                $table->timestamp('applied_at')->nullable(false)->change();
            });
        }
    }
};
