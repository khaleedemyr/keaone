<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('vendor_prepayments')) {
            Schema::create('vendor_prepayments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('supplier_id')->constrained('contacts')->cascadeOnDelete();
                $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('status')->default('draft');
                $table->unsignedBigInteger('amount')->default(0);
                $table->unsignedBigInteger('amount_applied')->default(0);
                $table->string('payment_method')->nullable();
                $table->text('note')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'client_uuid']);
                $table->unique(['company_id', 'number']);
                $table->index(['company_id', 'status', 'created_at']);
                $table->index(['company_id', 'supplier_id', 'status']);
            });
        }

        if (! Schema::hasTable('vendor_prepayment_applications')) {
            Schema::create('vendor_prepayment_applications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('vendor_prepayment_id')->constrained()->cascadeOnDelete();
                // No FK — vendor_invoices is partitioned (MySQL error 1506).
                $table->unsignedBigInteger('vendor_invoice_id');
                $table->unsignedBigInteger('amount');
                $table->timestamp('applied_at');
                $table->timestamps();

                $table->index(['vendor_invoice_id', 'created_at'], 'vpa_invoice_created_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_prepayment_applications');
        Schema::dropIfExists('vendor_prepayments');
    }
};
