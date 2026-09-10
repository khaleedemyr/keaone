<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('storefront_customers')) {
            Schema::create('storefront_customers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('storefront_id')->constrained()->cascadeOnDelete();
                $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
                $table->string('name');
                $table->string('email');
                $table->string('phone')->nullable();
                $table->string('password');
                $table->text('address')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamp('last_login_at')->nullable();
                $table->timestamps();

                $table->unique(['storefront_id', 'email']);
                $table->index(['company_id', 'email']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_customers');
    }
};
