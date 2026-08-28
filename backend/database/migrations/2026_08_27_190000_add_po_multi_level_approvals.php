<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->foreignId('approved_by')->nullable()->after('note')->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            $table->unsignedSmallInteger('current_approval_level')->nullable()->after('approved_at');
        });

        Schema::create('purchase_order_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('level');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20)->default('pending'); // pending|approved|rejected|skipped
            $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acted_at')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['purchase_order_id', 'level'], 'po_approvals_po_level_unique');
            $table->index(['purchase_order_id', 'status'], 'po_approvals_po_status_idx');
            $table->index(['user_id', 'status'], 'po_approvals_user_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_order_approvals');
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn(['approved_at', 'current_approval_level']);
        });
    }
};
