<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_images', function (Blueprint $table) {
            $table->boolean('is_primary')->default(false)->after('sort_order');
        });

        $productIds = DB::table('product_images')->distinct()->pluck('product_id');
        foreach ($productIds as $productId) {
            $id = DB::table('product_images')
                ->where('product_id', $productId)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->value('id');

            if ($id) {
                DB::table('product_images')->where('id', $id)->update(['is_primary' => true]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('product_images', function (Blueprint $table) {
            $table->dropColumn('is_primary');
        });
    }
};
