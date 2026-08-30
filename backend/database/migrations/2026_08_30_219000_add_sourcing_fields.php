<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'is_procurement_item')) {
                $table->boolean('is_procurement_item')->default(false)->after('track_stock');
            }
            if (! Schema::hasColumn('products', 'preferred_supplier_id')) {
                $table->unsignedBigInteger('preferred_supplier_id')->nullable()->after('is_procurement_item');
                $table->index('preferred_supplier_id');
            }
        });

        Schema::table('categories', function (Blueprint $table) {
            if (! Schema::hasColumn('categories', 'preferred_supplier_id')) {
                $table->unsignedBigInteger('preferred_supplier_id')->nullable()->after('procurement_match_mode');
                $table->index('preferred_supplier_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (Schema::hasColumn('categories', 'preferred_supplier_id')) {
                $table->dropIndex(['preferred_supplier_id']);
                $table->dropColumn('preferred_supplier_id');
            }
        });

        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'preferred_supplier_id')) {
                $table->dropIndex(['preferred_supplier_id']);
                $table->dropColumn('preferred_supplier_id');
            }
            if (Schema::hasColumn('products', 'is_procurement_item')) {
                $table->dropColumn('is_procurement_item');
            }
        });
    }
};
