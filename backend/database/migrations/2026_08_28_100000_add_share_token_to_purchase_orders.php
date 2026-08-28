<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('share_token', 64)->nullable()->unique()->after('client_uuid');
        });

        DB::table('purchase_orders')
            ->whereNull('share_token')
            ->orderBy('id')
            ->lazyById()
            ->each(function ($row) {
                DB::table('purchase_orders')
                    ->where('id', $row->id)
                    ->update(['share_token' => Str::random(48)]);
            });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('share_token');
        });
    }
};
