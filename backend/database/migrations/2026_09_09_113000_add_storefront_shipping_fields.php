<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('storefronts') && ! Schema::hasColumn('storefronts', 'shipping')) {
            Schema::table('storefronts', function (Blueprint $table) {
                $table->json('shipping')->nullable()->after('bank_accounts');
            });
        }

        if (Schema::hasTable('storefront_orders')) {
            Schema::table('storefront_orders', function (Blueprint $table) {
                if (! Schema::hasColumn('storefront_orders', 'shipping_cost')) {
                    $table->unsignedBigInteger('shipping_cost')->default(0)->after('tax');
                }
                if (! Schema::hasColumn('storefront_orders', 'shipping_snapshot')) {
                    $table->json('shipping_snapshot')->nullable()->after('bank_snapshot');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('storefronts') && Schema::hasColumn('storefronts', 'shipping')) {
            Schema::table('storefronts', function (Blueprint $table) {
                $table->dropColumn('shipping');
            });
        }

        if (Schema::hasTable('storefront_orders')) {
            Schema::table('storefront_orders', function (Blueprint $table) {
                if (Schema::hasColumn('storefront_orders', 'shipping_cost')) {
                    $table->dropColumn('shipping_cost');
                }
                if (Schema::hasColumn('storefront_orders', 'shipping_snapshot')) {
                    $table->dropColumn('shipping_snapshot');
                }
            });
        }
    }
};
