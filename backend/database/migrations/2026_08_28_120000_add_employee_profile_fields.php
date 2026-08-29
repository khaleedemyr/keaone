<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('national_id', 16)->nullable()->after('phone');
            $table->string('tax_id', 25)->nullable()->after('national_id');
            $table->date('birth_date')->nullable()->after('tax_id');
            $table->string('birth_place', 120)->nullable()->after('birth_date');
            $table->string('gender', 10)->nullable()->after('birth_place');
            $table->string('marital_status', 20)->nullable()->after('gender');
            $table->text('address')->nullable()->after('marital_status');
            $table->string('emergency_contact_name', 120)->nullable()->after('address');
            $table->string('emergency_contact_phone', 30)->nullable()->after('emergency_contact_name');
        });

        Schema::table('company_user', function (Blueprint $table) {
            $table->string('contract_type', 20)->nullable()->after('employment_status');
            $table->date('contract_end_at')->nullable()->after('contract_type');
            $table->date('terminated_at')->nullable()->after('contract_end_at');
        });
    }

    public function down(): void
    {
        Schema::table('company_user', function (Blueprint $table) {
            $table->dropColumn(['contract_type', 'contract_end_at', 'terminated_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'national_id',
                'tax_id',
                'birth_date',
                'birth_place',
                'gender',
                'marital_status',
                'address',
                'emergency_contact_name',
                'emergency_contact_phone',
            ]);
        });
    }
};
