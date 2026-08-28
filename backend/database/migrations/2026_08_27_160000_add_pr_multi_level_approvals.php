<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->unsignedSmallInteger('current_approval_level')->nullable()->after('approved_at');
        });

        Schema::create('purchase_requisition_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_requisition_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('level');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20)->default('pending'); // pending|approved|rejected|skipped
            $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acted_at')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['purchase_requisition_id', 'level'], 'pr_approvals_pr_level_unique');
            $table->index(['purchase_requisition_id', 'status'], 'pr_approvals_pr_status_idx');
            $table->index(['user_id', 'status'], 'pr_approvals_user_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_requisition_approvals');
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->dropColumn('current_approval_level');
        });
    }
};
