<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vendor_adjustment_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->constrained('contacts')->restrictOnDelete();
            // No FK — goods_receipts is partitioned (MySQL error 1506).
            $table->unsignedBigInteger('goods_receipt_id')->nullable();
            $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); // debit | credit
            $table->string('number');
            $table->uuid('client_uuid');
            $table->string('status')->default('draft');
            $table->string('reason')->nullable();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('total')->default(0);
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'number']);
            $table->unique(['company_id', 'client_uuid']);
            $table->index(['company_id', 'type', 'status']);
            $table->index(['goods_receipt_id', 'created_at'], 'vendor_adj_notes_gr_created_idx');
        });

        Schema::create('vendor_adjustment_note_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_adjustment_note_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            // No FK — goods_receipt_items is partitioned.
            $table->unsignedBigInteger('goods_receipt_item_id')->nullable();
            $table->unsignedInteger('qty')->default(1);
            $table->unsignedBigInteger('unit_cost_before')->default(0);
            $table->unsignedBigInteger('unit_cost_after')->default(0);
            $table->unsignedBigInteger('adjustment_amount')->default(0);
            $table->string('name_snapshot');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['goods_receipt_item_id', 'created_at'], 'vendor_adj_items_gri_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_adjustment_note_items');
        Schema::dropIfExists('vendor_adjustment_notes');
    }
};
