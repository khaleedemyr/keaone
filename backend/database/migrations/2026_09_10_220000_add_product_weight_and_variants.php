<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'weight_gram')) {
                $table->unsignedInteger('weight_gram')->nullable()->after('reorder_qty');
            }
        });

        if (! Schema::hasTable('product_variant_attributes')) {
            Schema::create('product_variant_attributes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->unsignedInteger('sort_order')->default(0);
                $table->boolean('show_in_storefront')->default(true);
                $table->timestamps();

                $table->index(['product_id', 'sort_order']);
            });
        }

        if (! Schema::hasTable('product_variant_options')) {
            Schema::create('product_variant_options', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->foreignId('attribute_id')->constrained('product_variant_attributes')->cascadeOnDelete();
                $table->string('name');
                $table->unsignedInteger('sort_order')->default(0);
                $table->unsignedBigInteger('extra_price')->default(0);
                $table->string('image_path')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['attribute_id', 'sort_order']);
                $table->index(['product_id', 'attribute_id']);
            });
        }

        if (Schema::hasTable('storefront_order_items') && ! Schema::hasColumn('storefront_order_items', 'variant_snapshot')) {
            Schema::table('storefront_order_items', function (Blueprint $table) {
                $table->json('variant_snapshot')->nullable()->after('name_snapshot');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('storefront_order_items') && Schema::hasColumn('storefront_order_items', 'variant_snapshot')) {
            Schema::table('storefront_order_items', function (Blueprint $table) {
                $table->dropColumn('variant_snapshot');
            });
        }

        Schema::dropIfExists('product_variant_options');
        Schema::dropIfExists('product_variant_attributes');

        if (Schema::hasColumn('products', 'weight_gram')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('weight_gram');
            });
        }
    }
};
