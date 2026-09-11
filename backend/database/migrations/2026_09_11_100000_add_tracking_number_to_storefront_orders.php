<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('storefront_orders')) {
            return;
        }

        Schema::table('storefront_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('storefront_orders', 'tracking_number')) {
                $table->string('tracking_number', 120)->nullable()->after('shipping_snapshot');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('storefront_orders')) {
            return;
        }

        Schema::table('storefront_orders', function (Blueprint $table) {
            if (Schema::hasColumn('storefront_orders', 'tracking_number')) {
                $table->dropColumn('tracking_number');
            }
        });
    }
};
