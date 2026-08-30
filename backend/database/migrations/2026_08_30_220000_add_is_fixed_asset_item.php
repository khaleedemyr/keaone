<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'is_fixed_asset_item')) {
                $table->boolean('is_fixed_asset_item')->default(false)->after('is_procurement_item');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'is_fixed_asset_item')) {
                $table->dropColumn('is_fixed_asset_item');
            }
        });
    }
};
