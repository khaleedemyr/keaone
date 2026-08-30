<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Retry-safe: migration may have created the table before index creation failed.
        if (Schema::hasTable('supplier_product_prices')) {
            Schema::drop('supplier_product_prices');
        }

        Schema::create('supplier_product_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('contacts')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('unit_cost')->default(0);
            $table->string('unit', 40)->nullable();
            $table->string('unit_level', 20)->nullable();
            $table->unsignedInteger('factor_to_base')->default(1);
            $table->unsignedInteger('min_qty')->nullable();
            $table->date('valid_from')->nullable();
            $table->date('valid_to')->nullable();
            $table->text('note')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'supplier_id', 'product_id', 'is_active'], 'spp_lookup_idx');
            $table->index(['product_id', 'is_active'], 'spp_product_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_product_prices');
    }
};
