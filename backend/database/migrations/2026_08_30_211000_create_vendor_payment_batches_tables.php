<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('vendor_invoices', 'amount_paid')) {
            Schema::table('vendor_invoices', function (Blueprint $table) {
                $table->unsignedBigInteger('amount_paid')->default(0)->after('total');
            });
        }

        if (! Schema::hasTable('vendor_payment_batches')) {
            Schema::create('vendor_payment_batches', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('status')->default('draft');
                $table->string('payment_method')->nullable();
                $table->unsignedBigInteger('total')->default(0);
                $table->text('note')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'client_uuid']);
                $table->unique(['company_id', 'number']);
                $table->index(['company_id', 'status', 'created_at']);
            });
        }

        if (! Schema::hasTable('vendor_payment_batch_items')) {
            Schema::create('vendor_payment_batch_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('vendor_payment_batch_id')->constrained()->cascadeOnDelete();
                // No FK — vendor_invoices is partitioned (MySQL error 1506).
                $table->unsignedBigInteger('vendor_invoice_id');
                $table->unsignedBigInteger('amount');
                $table->timestamps();

                $table->unique(['vendor_payment_batch_id', 'vendor_invoice_id'], 'vpbi_batch_invoice_unique');
                $table->index(['vendor_invoice_id', 'created_at'], 'vpbi_invoice_created_idx');
            });
        } elseif (! $this->indexExists('vendor_payment_batch_items', 'vpbi_batch_invoice_unique')) {
            // Recover partial run: table created before unique index failed (MySQL 1059).
            Schema::table('vendor_payment_batch_items', function (Blueprint $table) {
                $table->unique(['vendor_payment_batch_id', 'vendor_invoice_id'], 'vpbi_batch_invoice_unique');
            });
        }
    }

    private function indexExists(string $table, string $index): bool
    {
        $rows = DB::select('SHOW INDEX FROM `'.$table.'` WHERE Key_name = ?', [$index]);

        return count($rows) > 0;
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_payment_batch_items');
        Schema::dropIfExists('vendor_payment_batches');

        if (Schema::hasColumn('vendor_invoices', 'amount_paid')) {
            Schema::table('vendor_invoices', function (Blueprint $table) {
                $table->dropColumn('amount_paid');
            });
        }
    }
};
