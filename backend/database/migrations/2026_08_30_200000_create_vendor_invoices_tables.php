<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Retry-safe: failed first run may have created header table without FK/items.
        Schema::dropIfExists('match_exceptions');
        Schema::dropIfExists('vendor_invoice_approvals');
        Schema::dropIfExists('vendor_invoice_items');
        Schema::dropIfExists('vendor_invoices');

        Schema::create('vendor_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->constrained('contacts')->restrictOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
            // No FK — goods_receipts is partitioned (MySQL error 1506).
            $table->unsignedBigInteger('goods_receipt_id')->nullable();
            $table->string('vendor_ref')->nullable();
            $table->string('number');
            $table->uuid('client_uuid');
            $table->string('status')->default('draft');
            $table->string('match_status')->nullable();
            $table->date('invoice_date')->nullable();
            $table->date('due_date')->nullable();
            $table->unsignedBigInteger('subtotal')->default(0);
            $table->decimal('tax_percent', 5, 2)->default(0);
            $table->unsignedBigInteger('tax')->default(0);
            $table->unsignedBigInteger('total')->default(0);
            $table->text('note')->nullable();
            $table->unsignedTinyInteger('current_approval_level')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'number']);
            $table->unique(['company_id', 'client_uuid']);
            $table->index(['company_id', 'status']);
            $table->index(['goods_receipt_id', 'created_at'], 'vendor_invoices_gr_created_idx');
        });

        Schema::create('vendor_invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_order_item_id')->nullable()->constrained()->nullOnDelete();
            // No FK — goods_receipt_items is partitioned.
            $table->unsignedBigInteger('goods_receipt_item_id')->nullable();
            $table->unsignedInteger('qty');
            $table->unsignedSmallInteger('factor_to_base')->default(1);
            $table->string('unit')->nullable();
            $table->string('unit_level')->nullable();
            $table->string('name_snapshot');
            $table->unsignedBigInteger('unit_cost')->default(0);
            $table->unsignedBigInteger('discount')->default(0);
            $table->unsignedBigInteger('total')->default(0);
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['goods_receipt_item_id', 'created_at'], 'vendor_invoice_items_gri_created_idx');
        });

        Schema::create('vendor_invoice_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_invoice_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('level');
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('pending');
            $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acted_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique(['vendor_invoice_id', 'level']);
            $table->unique(['vendor_invoice_id', 'user_id']);
        });

        Schema::create('match_exceptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_invoice_item_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_item_id')->nullable()->constrained()->nullOnDelete();
            // No FK — goods_receipt_items is partitioned.
            $table->unsignedBigInteger('goods_receipt_item_id')->nullable();
            $table->string('exception_type');
            $table->string('field_name')->nullable();
            $table->string('expected_value')->nullable();
            $table->string('actual_value')->nullable();
            $table->decimal('variance_percent', 8, 2)->nullable();
            $table->text('message')->nullable();
            $table->string('status')->default('open');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_exceptions');
        Schema::dropIfExists('vendor_invoice_approvals');
        Schema::dropIfExists('vendor_invoice_items');
        Schema::dropIfExists('vendor_invoices');
    }
};
