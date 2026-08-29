<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('employee_photo', 255)->nullable()->after('emergency_contact_phone');
            $table->string('ktp_document', 255)->nullable()->after('employee_photo');
            $table->string('kk_document', 255)->nullable()->after('ktp_document');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['employee_photo', 'ktp_document', 'kk_document']);
        });
    }
};
