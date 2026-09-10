<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('company_document_sequences')) {
            Schema::create('company_document_sequences', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->string('doc_type', 40);
                $table->string('period', 16);
                $table->unsignedInteger('last_seq')->default(0);
                $table->timestamps();

                $table->unique(['company_id', 'doc_type', 'period'], 'company_doc_seq_unique');
            });
        }

        if (Schema::hasTable('gl_journal_entries')) {
            $indexExists = collect(Schema::getIndexes('gl_journal_entries'))
                ->contains(fn (array $idx) => ($idx['name'] ?? '') === 'gl_entries_source_unique');

            if (! $indexExists) {
                Schema::table('gl_journal_entries', function (Blueprint $table) {
                    $table->unique(['company_id', 'source_type', 'source_id'], 'gl_entries_source_unique');
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('gl_journal_entries')) {
            $indexExists = collect(Schema::getIndexes('gl_journal_entries'))
                ->contains(fn (array $idx) => ($idx['name'] ?? '') === 'gl_entries_source_unique');
            if ($indexExists) {
                Schema::table('gl_journal_entries', function (Blueprint $table) {
                    $table->dropUnique('gl_entries_source_unique');
                });
            }
        }
        Schema::dropIfExists('company_document_sequences');
    }
};
