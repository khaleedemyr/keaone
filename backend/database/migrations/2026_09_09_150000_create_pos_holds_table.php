<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_holds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('uuid')->unique();
            $table->string('label', 160);
            $table->json('payload');
            $table->timestamps();

            $table->index(['company_id', 'outlet_id', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_holds');
    }
};
