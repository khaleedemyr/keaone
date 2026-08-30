<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('contacts', 'withholding_tax_enabled')) {
            Schema::table('contacts', function (Blueprint $table) {
                $table->boolean('withholding_tax_enabled')->default(false)->after('tax_percent');
                $table->string('withholding_tax_type')->nullable()->after('withholding_tax_enabled');
                $table->decimal('withholding_tax_rate', 5, 2)->nullable()->after('withholding_tax_type');
                $table->string('withholding_tax_base')->default('subtotal')->after('withholding_tax_rate');
            });
        }

        if (! Schema::hasColumn('vendor_invoices', 'withholding_tax')) {
            Schema::table('vendor_invoices', function (Blueprint $table) {
                $table->string('withholding_tax_type')->nullable()->after('total');
                $table->decimal('withholding_tax_rate', 5, 2)->default(0)->after('withholding_tax_type');
                $table->string('withholding_tax_base')->nullable()->after('withholding_tax_rate');
                $table->unsignedBigInteger('withholding_tax')->default(0)->after('withholding_tax_base');
                $table->unsignedBigInteger('amount_payable')->default(0)->after('withholding_tax');
            });
        }

        if (! Schema::hasTable('vendor_withholding_records')) {
            Schema::create('vendor_withholding_records', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('supplier_id')->constrained('contacts')->restrictOnDelete();
                // No FK — vendor_invoices is partitioned (MySQL error 1506).
                $table->unsignedBigInteger('vendor_invoice_id');
                $table->unsignedBigInteger('vendor_payment_batch_id')->nullable();
                $table->string('invoice_number');
                $table->string('withholding_tax_type');
                $table->decimal('withholding_tax_rate', 5, 2);
                $table->string('withholding_tax_base');
                $table->unsignedBigInteger('base_amount');
                $table->unsignedBigInteger('withholding_amount');
                $table->unsignedBigInteger('payment_amount');
                $table->string('status')->default('withheld');
                $table->timestamp('withheld_at');
                $table->timestamp('remitted_at')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'status', 'withheld_at']);
                $table->index(['vendor_invoice_id', 'created_at'], 'vwr_invoice_created_idx');
                $table->index(['supplier_id', 'withheld_at']);
            });
        }

        if (Schema::hasColumn('vendor_invoices', 'amount_payable')) {
            DB::table('vendor_invoices')->where('amount_payable', 0)->update([
                'amount_payable' => DB::raw('total'),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_withholding_records');

        if (Schema::hasColumn('vendor_invoices', 'withholding_tax')) {
            Schema::table('vendor_invoices', function (Blueprint $table) {
                $table->dropColumn([
                    'withholding_tax_type',
                    'withholding_tax_rate',
                    'withholding_tax_base',
                    'withholding_tax',
                    'amount_payable',
                ]);
            });
        }

        if (Schema::hasColumn('contacts', 'withholding_tax_enabled')) {
            Schema::table('contacts', function (Blueprint $table) {
                $table->dropColumn([
                    'withholding_tax_enabled',
                    'withholding_tax_type',
                    'withholding_tax_rate',
                    'withholding_tax_base',
                ]);
            });
        }
    }
};
