<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('vendor_payment_batches', 'current_approval_level')) {
            Schema::table('vendor_payment_batches', function (Blueprint $table) {
                $table->unsignedTinyInteger('current_approval_level')->nullable()->after('status');
                $table->foreignId('approved_by')->nullable()->after('current_approval_level')->constrained('users')->nullOnDelete();
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            });
        }

        if (! Schema::hasTable('vendor_payment_batch_approvals')) {
            Schema::create('vendor_payment_batch_approvals', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('vendor_payment_batch_id')->constrained()->cascadeOnDelete();
                $table->unsignedTinyInteger('level');
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->string('status')->default('pending');
                $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('acted_at')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->unique(['vendor_payment_batch_id', 'level'], 'vpba_batch_level_unique');
                $table->unique(['vendor_payment_batch_id', 'user_id'], 'vpba_batch_user_unique');
            });
        }

        if (! Schema::hasColumn('vendor_prepayments', 'current_approval_level')) {
            Schema::table('vendor_prepayments', function (Blueprint $table) {
                $table->unsignedTinyInteger('current_approval_level')->nullable()->after('status');
                $table->foreignId('approved_by')->nullable()->after('current_approval_level')->constrained('users')->nullOnDelete();
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            });
        }

        if (! Schema::hasTable('vendor_prepayment_approvals')) {
            Schema::create('vendor_prepayment_approvals', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('vendor_prepayment_id')->constrained()->cascadeOnDelete();
                $table->unsignedTinyInteger('level');
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->string('status')->default('pending');
                $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('acted_at')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->unique(['vendor_prepayment_id', 'level'], 'vppa_prepay_level_unique');
                $table->unique(['vendor_prepayment_id', 'user_id'], 'vppa_prepay_user_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_prepayment_approvals');
        Schema::dropIfExists('vendor_payment_batch_approvals');

        if (Schema::hasColumn('vendor_prepayments', 'current_approval_level')) {
            Schema::table('vendor_prepayments', function (Blueprint $table) {
                $table->dropConstrainedForeignId('approved_by');
                $table->dropColumn(['current_approval_level', 'approved_at']);
            });
        }

        if (Schema::hasColumn('vendor_payment_batches', 'current_approval_level')) {
            Schema::table('vendor_payment_batches', function (Blueprint $table) {
                $table->dropConstrainedForeignId('approved_by');
                $table->dropColumn(['current_approval_level', 'approved_at']);
            });
        }
    }
};
