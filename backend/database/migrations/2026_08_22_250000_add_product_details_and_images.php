<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->text('description')->nullable()->after('name');
            $table->foreignId('sub_category_id')->nullable()->after('category_id')->constrained('sub_categories')->nullOnDelete();
            $table->foreignId('unit_id')->nullable()->after('unit')->constrained('units')->nullOnDelete();
        });

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('product_outlet_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('sell_price')->default(0);
            $table->timestamps();

            $table->unique(['product_id', 'outlet_id']);
        });

        $units = DB::table('units')->get()->groupBy('company_id');
        foreach (DB::table('products')->whereNull('unit_id')->cursor() as $product) {
            $match = collect($units[$product->company_id] ?? [])->first(function ($unit) use ($product) {
                $symbol = strtolower((string) ($unit->symbol ?? ''));
                $name = strtolower((string) $unit->name);
                $current = strtolower((string) $product->unit);

                return ($symbol !== '' && $symbol === $current) || $name === $current;
            });

            if ($match) {
                DB::table('products')->where('id', $product->id)->update(['unit_id' => $match->id]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_outlet_prices');
        Schema::dropIfExists('product_images');

        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sub_category_id');
            $table->dropConstrainedForeignId('unit_id');
            $table->dropColumn('description');
        });
    }
};
