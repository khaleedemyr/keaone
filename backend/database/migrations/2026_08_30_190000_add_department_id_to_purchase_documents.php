<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->after('outlet_id')->constrained('departments')->nullOnDelete();
            $table->index(['company_id', 'department_id', 'created_at'], 'pr_dept_created_idx');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->after('outlet_id')->constrained('departments')->nullOnDelete();
            $table->index(['company_id', 'department_id', 'created_at'], 'po_dept_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropIndex('po_dept_created_idx');
            $table->dropColumn('department_id');
        });

        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropIndex('pr_dept_created_idx');
            $table->dropColumn('department_id');
        });
    }
};
