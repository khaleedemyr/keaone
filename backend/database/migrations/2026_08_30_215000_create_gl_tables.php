<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('gl_accounts')) {
            Schema::create('gl_accounts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->string('code');
                $table->string('name');
                $table->string('account_type');
                $table->boolean('is_active')->default(true);
                $table->boolean('is_system')->default(false);
                $table->timestamps();

                $table->unique(['company_id', 'code']);
                $table->index(['company_id', 'account_type', 'is_active']);
            });
        }

        if (! Schema::hasTable('gl_journal_entries')) {
            Schema::create('gl_journal_entries', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->string('number');
                $table->date('entry_date');
                $table->string('source_type');
                $table->unsignedBigInteger('source_id');
                $table->string('source_number')->nullable();
                $table->string('description')->nullable();
                $table->string('status')->default('posted');
                $table->unsignedBigInteger('reversed_entry_id')->nullable();
                $table->unsignedBigInteger('total_debit')->default(0);
                $table->unsignedBigInteger('total_credit')->default(0);
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->index(['company_id', 'source_type', 'source_id']);
                $table->index(['company_id', 'entry_date']);
            });
        }

        if (! Schema::hasTable('gl_journal_lines')) {
            Schema::create('gl_journal_lines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('gl_journal_entry_id')->constrained()->cascadeOnDelete();
                $table->foreignId('gl_account_id')->constrained()->restrictOnDelete();
                $table->unsignedSmallInteger('line_no');
                $table->unsignedBigInteger('debit')->default(0);
                $table->unsignedBigInteger('credit')->default(0);
                $table->string('note')->nullable();
                $table->timestamps();

                $table->index(['gl_journal_entry_id', 'line_no']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('gl_journal_lines');
        Schema::dropIfExists('gl_journal_entries');
        Schema::dropIfExists('gl_accounts');
    }
};
