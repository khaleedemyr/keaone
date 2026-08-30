<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('procurement_contracts')) {
            Schema::create('procurement_contracts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('warehouse_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->foreignId('supplier_id')->constrained('contacts')->restrictOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('title');
                $table->string('status')->default('draft');
                $table->date('period_start')->nullable();
                $table->date('period_end')->nullable();
                $table->unsignedBigInteger('total_value')->default(0);
                $table->text('note')->nullable();
                $table->timestamp('activated_at')->nullable();
                $table->timestamp('closed_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->unique(['company_id', 'client_uuid']);
                $table->index(['company_id', 'status', 'created_at']);
            });
        }

        if (! Schema::hasTable('procurement_contract_items')) {
            Schema::create('procurement_contract_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('procurement_contract_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->unsignedInteger('qty_contracted');
                $table->unsignedInteger('qty_released')->default(0);
                $table->unsignedBigInteger('unit_cost')->default(0);
                $table->string('unit', 40)->nullable();
                $table->string('unit_level', 20)->nullable();
                $table->unsignedInteger('factor_to_base')->default(1);
                $table->string('name_snapshot');
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index(['procurement_contract_id', 'product_id'], 'proc_ctr_items_ctr_prod_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_contract_items');
        Schema::dropIfExists('procurement_contracts');
    }
};
