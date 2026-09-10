<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storefront_products', function (Blueprint $table) {
            $table->boolean('is_deal')->default(false)->after('override_price');
            $table->boolean('is_new_arrival')->default(false)->after('is_deal');
            $table->boolean('is_bestseller')->default(false)->after('is_new_arrival');
            $table->unsignedInteger('units_sold')->default(0)->after('is_bestseller');
            $table->decimal('avg_rating', 3, 2)->default(0)->after('units_sold');
            $table->unsignedInteger('review_count')->default(0)->after('avg_rating');
        });

        Schema::table('storefront_orders', function (Blueprint $table) {
            $table->timestamp('shipped_at')->nullable()->after('paid_at');
            $table->timestamp('delivered_at')->nullable()->after('shipped_at');
        });

        Schema::create('storefront_product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('storefront_id')->constrained()->cascadeOnDelete();
            $table->foreignId('storefront_product_id')->constrained('storefront_products')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('storefront_order_id')->constrained('storefront_orders')->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name', 120);
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->boolean('is_published')->default(true);
            $table->timestamps();

            $table->unique(['storefront_order_id', 'product_id'], 'sf_review_order_product_unique');
            $table->index(['storefront_id', 'product_id', 'is_published'], 'sf_review_product_pub_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_product_reviews');

        Schema::table('storefront_orders', function (Blueprint $table) {
            $table->dropColumn(['shipped_at', 'delivered_at']);
        });

        Schema::table('storefront_products', function (Blueprint $table) {
            $table->dropColumn([
                'is_deal',
                'is_new_arrival',
                'is_bestseller',
                'units_sold',
                'avg_rating',
                'review_count',
            ]);
        });
    }
};
