<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('budgets')) {
            Schema::create('budgets', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->unsignedSmallInteger('fiscal_year');
                $table->date('period_start');
                $table->date('period_end');
                $table->string('status')->default('draft');
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'status', 'period_start', 'period_end']);
            });
        }

        if (! Schema::hasTable('budget_lines')) {
            Schema::create('budget_lines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('budget_id')->constrained()->cascadeOnDelete();
                $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->unsignedBigInteger('amount')->default(0);
                $table->string('note')->nullable();
                $table->timestamps();

                $table->index(['budget_id', 'department_id', 'outlet_id']);
            });
        }

        if (! Schema::hasTable('budget_commitments')) {
            Schema::create('budget_commitments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('budget_id')->constrained()->cascadeOnDelete();
                $table->foreignId('budget_line_id')->constrained()->cascadeOnDelete();
                $table->string('source_type');
                $table->unsignedBigInteger('source_id');
                $table->string('source_number')->nullable();
                $table->unsignedBigInteger('amount')->default(0);
                $table->string('status')->default('active');
                $table->timestamp('committed_at')->nullable();
                $table->timestamp('released_at')->nullable();
                $table->timestamps();

                $table->index(['source_type', 'source_id']);
                $table->index(['budget_line_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_commitments');
        Schema::dropIfExists('budget_lines');
        Schema::dropIfExists('budgets');
    }
};
