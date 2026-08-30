<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('procurement_plans')) {
            Schema::create('procurement_plans', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->uuid('client_uuid');
                $table->unsignedSmallInteger('fiscal_year');
                $table->string('status')->default('draft');
                $table->text('note')->nullable();
                $table->timestamp('activated_at')->nullable();
                $table->timestamp('closed_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'client_uuid']);
                $table->index(['company_id', 'fiscal_year', 'status']);
            });
        }

        if (! Schema::hasTable('procurement_plan_lines')) {
            Schema::create('procurement_plan_lines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('procurement_plan_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->unsignedTinyInteger('period_month')->nullable();
                $table->unsignedInteger('qty_planned');
                $table->unsignedBigInteger('estimated_unit_cost')->default(0);
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index(['procurement_plan_id', 'product_id'], 'proc_plan_lines_plan_prod_idx');
            });
        }

        if (! Schema::hasTable('procurement_forecasts')) {
            Schema::create('procurement_forecasts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('warehouse_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->unsignedSmallInteger('period_year');
                $table->unsignedTinyInteger('period_month');
                $table->unsignedInteger('forecast_qty');
                $table->string('status')->default('suggested');
                $table->text('note')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'product_id', 'warehouse_id', 'period_year', 'period_month'], 'proc_forecast_unique');
            });
        }

        if (! Schema::hasTable('goods_receipt_landed_costs')) {
            Schema::create('goods_receipt_landed_costs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('goods_receipt_id');
                $table->unsignedBigInteger('freight')->default(0);
                $table->unsignedBigInteger('customs')->default(0);
                $table->unsignedBigInteger('insurance')->default(0);
                $table->unsignedBigInteger('other')->default(0);
                $table->string('allocation_method', 20)->default('value');
                $table->timestamp('applied_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'goods_receipt_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('goods_receipt_landed_costs');
        Schema::dropIfExists('procurement_forecasts');
        Schema::dropIfExists('procurement_plan_lines');
        Schema::dropIfExists('procurement_plans');
    }
};
