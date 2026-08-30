<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 40);
            $table->unsignedBigInteger('document_id');
            $table->string('category', 30)->default('other');
            $table->string('original_name');
            $table->string('stored_path');
            $table->string('mime_type', 120);
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->string('note', 255)->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'document_type', 'document_id', 'created_at'], 'proc_attachments_doc_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_attachments');
    }
};
