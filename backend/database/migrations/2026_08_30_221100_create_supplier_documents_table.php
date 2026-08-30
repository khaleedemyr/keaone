<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('supplier_documents')) {
            Schema::create('supplier_documents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
                $table->string('doc_type', 20);
                $table->string('file_path');
                $table->string('original_name')->nullable();
                $table->date('expires_at')->nullable();
                $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['contact_id', 'doc_type']);
                $table->index(['company_id', 'expires_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_documents');
    }
};
