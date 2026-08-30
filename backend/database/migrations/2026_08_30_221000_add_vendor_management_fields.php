<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            if (! Schema::hasColumn('contacts', 'vendor_tier')) {
                $table->string('vendor_tier', 20)->nullable()->after('is_active');
            }
            if (! Schema::hasColumn('contacts', 'onboarding_status')) {
                $table->string('onboarding_status', 20)->default('approved')->after('vendor_tier');
            }
            if (! Schema::hasColumn('contacts', 'vendor_status')) {
                $table->string('vendor_status', 20)->default('active')->after('onboarding_status');
            }
            if (! Schema::hasColumn('contacts', 'portal_token')) {
                $table->string('portal_token', 64)->nullable()->unique()->after('vendor_status');
            }
            if (! Schema::hasColumn('contacts', 'vendor_block_reason')) {
                $table->text('vendor_block_reason')->nullable()->after('portal_token');
            }
            if (! Schema::hasColumn('contacts', 'vendor_approved_at')) {
                $table->timestamp('vendor_approved_at')->nullable()->after('vendor_block_reason');
            }
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('purchase_orders', 'vendor_confirmed_at')) {
                $table->timestamp('vendor_confirmed_at')->nullable()->after('approved_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_orders', 'vendor_confirmed_at')) {
                $table->dropColumn('vendor_confirmed_at');
            }
        });

        Schema::table('contacts', function (Blueprint $table) {
            foreach (['vendor_tier', 'onboarding_status', 'vendor_status', 'portal_token', 'vendor_block_reason', 'vendor_approved_at'] as $col) {
                if (Schema::hasColumn('contacts', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
