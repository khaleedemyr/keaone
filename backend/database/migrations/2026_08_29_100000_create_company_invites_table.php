<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->foreignId('role_id')->nullable()->constrained('roles')->nullOnDelete();
            $table->string('role', 80)->default('cashier');
            $table->string('email', 150)->nullable();
            $table->string('label', 120)->nullable();
            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('use_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'revoked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_invites');
    }
};
