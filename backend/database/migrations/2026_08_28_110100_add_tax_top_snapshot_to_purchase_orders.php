<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->decimal('tax_percent', 5, 2)->default(0)->after('subtotal');
            $table->string('payment_term', 80)->nullable()->after('note');
            $table->unsignedSmallInteger('payment_days')->nullable()->after('payment_term');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['tax_percent', 'payment_term', 'payment_days']);
        });
    }
};
