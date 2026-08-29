<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_user', function (Blueprint $table) {
            $table->string('onboarding_status', 20)->default('complete')->after('employment_status');
            $table->timestamp('onboarding_submitted_at')->nullable()->after('onboarding_status');
            $table->timestamp('onboarding_approved_at')->nullable()->after('onboarding_submitted_at');
            $table->foreignId('onboarding_approved_by')->nullable()->after('onboarding_approved_at')->constrained('users')->nullOnDelete();
            $table->foreignId('invite_id')->nullable()->after('onboarding_approved_by')->constrained('company_invites')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('company_user', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invite_id');
            $table->dropConstrainedForeignId('onboarding_approved_by');
            $table->dropColumn([
                'onboarding_status',
                'onboarding_submitted_at',
                'onboarding_approved_at',
            ]);
        });
    }
};
