<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_matrix_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('doc_type', 30);
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('min_amount')->default(0);
            $table->unsignedBigInteger('max_amount')->nullable();
            $table->unsignedSmallInteger('level');
            $table->string('approver_type', 20);
            $table->unsignedBigInteger('approver_ref_id')->nullable();
            $table->unsignedSmallInteger('priority')->default(0);
            $table->unsignedSmallInteger('escalate_after_days')->nullable();
            $table->foreignId('escalate_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'doc_type', 'is_active'], 'approval_matrix_company_doc_active_idx');
        });

        Schema::create('approval_delegations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('delegate_user_id')->constrained('users')->cascadeOnDelete();
            $table->date('starts_at');
            $table->date('ends_at');
            $table->string('note')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'user_id', 'is_active'], 'approval_delegations_user_active_idx');
        });

        Schema::create('procurement_field_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 30);
            $table->unsignedBigInteger('document_id');
            $table->unsignedBigInteger('item_id')->nullable();
            $table->string('field', 50);
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->string('change_context', 30)->default('approval');
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'document_type', 'document_id'], 'proc_field_audit_doc_idx');
        });

        foreach (['purchase_requisition_approvals', 'purchase_order_approvals'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $unique = $tableName === 'purchase_requisition_approvals'
                    ? 'pr_approvals_pr_level_unique'
                    : 'po_approvals_po_level_unique';

                $table->dropUnique($unique);
                $table->timestamp('pending_since')->nullable()->after('status');
                $table->foreignId('delegated_from_user_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
                $table->timestamp('escalated_at')->nullable()->after('acted_at');
            });

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $prefix = $tableName === 'purchase_requisition_approvals' ? 'pr' : 'po';
                $docCol = $tableName === 'purchase_requisition_approvals'
                    ? 'purchase_requisition_id'
                    : 'purchase_order_id';

                $table->unique([$docCol, 'level', 'user_id'], "{$prefix}_approvals_doc_level_user_unique");
            });
        }
    }

    public function down(): void
    {
        foreach (['purchase_requisition_approvals', 'purchase_order_approvals'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $prefix = $tableName === 'purchase_requisition_approvals' ? 'pr' : 'po';
                $docCol = $tableName === 'purchase_requisition_approvals'
                    ? 'purchase_requisition_id'
                    : 'purchase_order_id';

                $table->dropUnique("{$prefix}_approvals_doc_level_user_unique");
                $table->dropConstrainedForeignId('delegated_from_user_id');
                $table->dropColumn(['pending_since', 'escalated_at']);
            });

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $unique = $tableName === 'purchase_requisition_approvals'
                    ? 'pr_approvals_pr_level_unique'
                    : 'po_approvals_po_level_unique';
                $docCol = $tableName === 'purchase_requisition_approvals'
                    ? 'purchase_requisition_id'
                    : 'purchase_order_id';

                $table->unique([$docCol, 'level'], $unique);
            });
        }

        Schema::dropIfExists('procurement_field_audits');
        Schema::dropIfExists('approval_delegations');
        Schema::dropIfExists('approval_matrix_rules');
    }
};
