<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_user', function (Blueprint $table) {
            $table->string('employee_code', 40)->nullable()->after('role_id');
            $table->foreignId('department_id')->nullable()->after('employee_code')->constrained('departments')->nullOnDelete();
            $table->foreignId('position_id')->nullable()->after('department_id')->constrained('positions')->nullOnDelete();
            $table->foreignId('job_level_id')->nullable()->after('position_id')->constrained('job_levels')->nullOnDelete();
            $table->foreignId('manager_id')->nullable()->after('job_level_id')->constrained('company_user')->nullOnDelete();
            $table->date('hired_at')->nullable()->after('manager_id');
            $table->string('employment_status', 20)->default('active')->after('hired_at');

            $table->unique(['company_id', 'employee_code']);
        });
    }

    public function down(): void
    {
        Schema::table('company_user', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'employee_code']);
            $table->dropConstrainedForeignId('manager_id');
            $table->dropConstrainedForeignId('job_level_id');
            $table->dropConstrainedForeignId('position_id');
            $table->dropConstrainedForeignId('department_id');
            $table->dropColumn(['employee_code', 'hired_at', 'employment_status']);
        });
    }
};
