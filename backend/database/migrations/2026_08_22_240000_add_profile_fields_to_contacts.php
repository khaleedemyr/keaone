<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('city')->nullable()->after('address');
            $table->string('province')->nullable()->after('city');
            $table->string('postal_code', 20)->nullable()->after('province');
            $table->string('npwp', 40)->nullable()->after('postal_code');
            $table->string('bank_name')->nullable()->after('npwp');
            $table->string('bank_account', 40)->nullable()->after('bank_name');
            $table->string('bank_account_name')->nullable()->after('bank_account');
            $table->string('payment_term')->nullable()->after('bank_account_name');
            $table->unsignedSmallInteger('payment_days')->nullable()->after('payment_term');
        });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn([
                'city',
                'province',
                'postal_code',
                'npwp',
                'bank_name',
                'bank_account',
                'bank_account_name',
                'payment_term',
                'payment_days',
            ]);
        });
    }
};
