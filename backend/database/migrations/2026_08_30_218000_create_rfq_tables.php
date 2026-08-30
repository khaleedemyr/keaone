<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('rfqs')) {
            Schema::create('rfqs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('warehouse_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('title');
                $table->string('status')->default('draft');
                $table->date('due_at')->nullable();
                $table->text('note')->nullable();
                $table->unsignedBigInteger('winner_vendor_quote_id')->nullable();
                $table->timestamp('closed_at')->nullable();
                $table->timestamp('awarded_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->index(['company_id', 'status', 'created_at']);
            });
        }

        if (! Schema::hasTable('rfq_items')) {
            Schema::create('rfq_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('rfq_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->unsignedInteger('qty');
                $table->string('unit', 40)->nullable();
                $table->string('unit_level', 20)->nullable();
                $table->unsignedInteger('factor_to_base')->default(1);
                $table->string('name_snapshot');
                $table->text('spec_note')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index(['rfq_id', 'product_id']);
            });
        }

        if (! Schema::hasTable('rfq_suppliers')) {
            Schema::create('rfq_suppliers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('rfq_id')->constrained()->cascadeOnDelete();
                $table->foreignId('supplier_id')->constrained('contacts')->cascadeOnDelete();
                $table->timestamp('invited_at')->nullable();
                $table->timestamps();

                $table->unique(['rfq_id', 'supplier_id']);
            });
        }

        if (! Schema::hasTable('vendor_quotes')) {
            Schema::create('vendor_quotes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('rfq_id')->constrained()->cascadeOnDelete();
                $table->foreignId('supplier_id')->constrained('contacts')->cascadeOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('status')->default('draft');
                $table->unsignedBigInteger('subtotal')->default(0);
                $table->unsignedBigInteger('tax')->default(0);
                $table->unsignedBigInteger('total')->default(0);
                $table->text('note')->nullable();
                $table->unsignedSmallInteger('lead_days')->nullable();
                $table->timestamp('quoted_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->unique(['rfq_id', 'supplier_id']);
                $table->index(['rfq_id', 'status']);
            });
        }

        if (! Schema::hasTable('vendor_quote_items')) {
            Schema::create('vendor_quote_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('vendor_quote_id')->constrained()->cascadeOnDelete();
                $table->foreignId('rfq_item_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('unit_cost')->default(0);
                $table->unsignedInteger('qty');
                $table->unsignedBigInteger('total')->default(0);
                $table->unsignedSmallInteger('lead_days')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->unique(['vendor_quote_id', 'rfq_item_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_quote_items');
        Schema::dropIfExists('vendor_quotes');
        Schema::dropIfExists('rfq_suppliers');
        Schema::dropIfExists('rfq_items');
        Schema::dropIfExists('rfqs');
    }
};
