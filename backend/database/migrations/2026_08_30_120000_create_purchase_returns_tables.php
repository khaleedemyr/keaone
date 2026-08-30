<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Retry-safe: failed first run may have created header table without FK/items.
        Schema::dropIfExists('purchase_return_approvals');
        Schema::dropIfExists('purchase_return_items');
        Schema::dropIfExists('purchase_returns');

        Schema::create('purchase_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->constrained('contacts')->restrictOnDelete();
            // No FK — goods_receipts is partitioned (MySQL error 1506).
            $table->unsignedBigInteger('goods_receipt_id')->nullable();
            $table->string('number');
            $table->uuid('client_uuid');
            $table->string('status')->default('draft');
            $table->string('reason')->nullable();
            $table->text('note')->nullable();
            $table->unsignedTinyInteger('current_approval_level')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('returned_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'number']);
            $table->unique(['company_id', 'client_uuid']);
            $table->index(['company_id', 'status']);
            $table->index(['goods_receipt_id', 'created_at'], 'purchase_returns_gr_created_idx');
        });

        Schema::create('purchase_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_return_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            // No FK — goods_receipt_items is partitioned.
            $table->unsignedBigInteger('goods_receipt_item_id')->nullable();
            $table->unsignedInteger('qty');
            $table->unsignedSmallInteger('factor_to_base')->default(1);
            $table->string('unit')->nullable();
            $table->string('unit_level')->nullable();
            $table->string('name_snapshot');
            $table->unsignedBigInteger('unit_cost')->default(0);
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['goods_receipt_item_id', 'created_at'], 'purchase_return_items_gri_created_idx');
        });

        Schema::create('purchase_return_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_return_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('level');
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('pending');
            $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acted_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique(['purchase_return_id', 'level']);
            $table->unique(['purchase_return_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_return_approvals');
        Schema::dropIfExists('purchase_return_items');
        Schema::dropIfExists('purchase_returns');
    }
};
