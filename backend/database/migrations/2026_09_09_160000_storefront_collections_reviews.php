<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('storefront_products')) {
            Schema::table('storefront_products', function (Blueprint $table) {
                if (! Schema::hasColumn('storefront_products', 'is_deal')) {
                    $table->boolean('is_deal')->default(false)->after('override_price');
                }
                if (! Schema::hasColumn('storefront_products', 'is_new_arrival')) {
                    $table->boolean('is_new_arrival')->default(false);
                }
                if (! Schema::hasColumn('storefront_products', 'is_bestseller')) {
                    $table->boolean('is_bestseller')->default(false);
                }
                if (! Schema::hasColumn('storefront_products', 'units_sold')) {
                    $table->unsignedInteger('units_sold')->default(0);
                }
                if (! Schema::hasColumn('storefront_products', 'avg_rating')) {
                    $table->decimal('avg_rating', 3, 2)->default(0);
                }
                if (! Schema::hasColumn('storefront_products', 'review_count')) {
                    $table->unsignedInteger('review_count')->default(0);
                }
            });
        }

        if (Schema::hasTable('storefront_orders')) {
            Schema::table('storefront_orders', function (Blueprint $table) {
                if (! Schema::hasColumn('storefront_orders', 'shipped_at')) {
                    $table->timestamp('shipped_at')->nullable()->after('paid_at');
                }
                if (! Schema::hasColumn('storefront_orders', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable();
                }
            });
        }

        if (! Schema::hasTable('storefront_product_reviews')) {
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
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_product_reviews');

        if (Schema::hasTable('storefront_orders')) {
            Schema::table('storefront_orders', function (Blueprint $table) {
                $drop = [];
                if (Schema::hasColumn('storefront_orders', 'shipped_at')) {
                    $drop[] = 'shipped_at';
                }
                if (Schema::hasColumn('storefront_orders', 'delivered_at')) {
                    $drop[] = 'delivered_at';
                }
                if ($drop !== []) {
                    $table->dropColumn($drop);
                }
            });
        }

        if (Schema::hasTable('storefront_products')) {
            Schema::table('storefront_products', function (Blueprint $table) {
                $drop = [];
                foreach (['is_deal', 'is_new_arrival', 'is_bestseller', 'units_sold', 'avg_rating', 'review_count'] as $col) {
                    if (Schema::hasColumn('storefront_products', $col)) {
                        $drop[] = $col;
                    }
                }
                if ($drop !== []) {
                    $table->dropColumn($drop);
                }
            });
        }
    }
};
