<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('level', 16);
            $table->foreignId('unit_id')->constrained('units')->restrictOnDelete();
            $table->unsignedInteger('factor_to_base')->default(1);
            $table->timestamps();

            $table->unique(['product_id', 'level']);
            $table->index(['company_id', 'product_id']);
        });

        foreach (['purchase_requisition_items', 'purchase_order_items', 'goods_receipt_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('unit_level', 16)->nullable()->after('unit');
                $table->unsignedInteger('factor_to_base')->default(1)->after('unit_level');
            });
        }

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->integer('qty_input')->nullable()->after('qty_change');
            $table->string('unit_level', 16)->nullable()->after('qty_input');
            $table->string('unit', 40)->nullable()->after('unit_level');
            $table->unsignedInteger('factor_to_base')->nullable()->after('unit');
        });

        $products = DB::table('products')->select('id', 'company_id', 'unit_id')->whereNotNull('unit_id')->get();
        $now = now();
        foreach ($products as $product) {
            DB::table('product_units')->insert([
                'company_id' => $product->company_id,
                'product_id' => $product->id,
                'level' => 'small',
                'unit_id' => $product->unit_id,
                'factor_to_base' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropColumn(['qty_input', 'unit_level', 'unit', 'factor_to_base']);
        });

        foreach (['purchase_requisition_items', 'purchase_order_items', 'goods_receipt_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn(['unit_level', 'factor_to_base']);
            });
        }

        Schema::dropIfExists('product_units');
    }
};
