<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_productions')) {
            Schema::table('stock_productions', function (Blueprint $table) {
                if (! Schema::hasColumn('stock_productions', 'voided_at')) {
                    $table->timestamp('voided_at')->nullable()->after('confirmed_at');
                }
                if (! Schema::hasColumn('stock_productions', 'voided_by')) {
                    $table->foreignId('voided_by')->nullable()->after('voided_at')->constrained('users')->nullOnDelete();
                }
                if (! Schema::hasColumn('stock_productions', 'void_reason')) {
                    $table->text('void_reason')->nullable()->after('voided_by');
                }
                if (! Schema::hasColumn('stock_productions', 'track_serial')) {
                    $table->boolean('track_serial')->default(false)->after('lot_code');
                }
            });
        }

        if (! Schema::hasTable('stock_lots')) {
            Schema::create('stock_lots', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->string('lot_code', 64);
                $table->integer('qty')->default(0);
                $table->unsignedBigInteger('unit_cost')->default(0);
                $table->string('status')->default('open'); // open|closed|voided
                $table->string('source_ref_type')->nullable();
                $table->unsignedBigInteger('source_ref_id')->nullable();
                $table->timestamp('produced_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'warehouse_id', 'product_id', 'lot_code'], 'stock_lots_unique_code');
                $table->index(['company_id', 'product_id', 'status']);
                $table->index(['source_ref_type', 'source_ref_id']);
            });
        }

        if (! Schema::hasTable('stock_lot_movements')) {
            Schema::create('stock_lot_movements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('stock_lot_id')->constrained('stock_lots')->cascadeOnDelete();
                $table->integer('qty_change');
                $table->integer('qty_after');
                $table->string('type'); // receipt|issue|void_receipt|void_issue|adjust
                $table->string('ref_type')->nullable();
                $table->unsignedBigInteger('ref_id')->nullable();
                $table->string('note')->nullable();
                $table->timestamps();

                $table->index(['stock_lot_id', 'created_at']);
                $table->index(['ref_type', 'ref_id']);
            });
        }

        if (! Schema::hasTable('stock_serials')) {
            Schema::create('stock_serials', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->string('serial_number', 120);
                $table->string('lot_code', 64)->nullable();
                $table->string('status')->default('available'); // available|voided|sold
                $table->unsignedBigInteger('stock_production_id')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'product_id', 'serial_number'], 'stock_serials_unique');
                $table->index(['company_id', 'warehouse_id', 'status']);
                $table->index(['stock_production_id']);
            });
        }

        if (! Schema::hasTable('stock_production_steps')) {
            Schema::create('stock_production_steps', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('stock_production_id')->constrained()->cascadeOnDelete();
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->string('name');
                $table->string('status')->default('pending'); // pending|done
                $table->timestamp('done_at')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index(['stock_production_id', 'sort_order']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_production_steps');
        Schema::dropIfExists('stock_serials');
        Schema::dropIfExists('stock_lot_movements');
        Schema::dropIfExists('stock_lots');

        if (Schema::hasTable('stock_productions')) {
            Schema::table('stock_productions', function (Blueprint $table) {
                foreach (['void_reason', 'voided_by', 'voided_at', 'track_serial'] as $col) {
                    if (Schema::hasColumn('stock_productions', $col)) {
                        if ($col === 'voided_by') {
                            $table->dropConstrainedForeignId('voided_by');
                        } else {
                            $table->dropColumn($col);
                        }
                    }
                }
            });
        }
    }
};
