<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('assets')) {
            Schema::create('assets', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->string('number');
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('goods_receipt_id')->nullable();
                $table->unsignedBigInteger('goods_receipt_item_id')->nullable();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->string('name_snapshot');
                $table->unsignedBigInteger('acquisition_cost')->default(0);
                $table->string('status')->default('active');
                $table->string('serial_number')->nullable();
                $table->string('location')->nullable();
                $table->foreignId('custodian_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('acquired_at')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->index(['company_id', 'status']);
                $table->index(['goods_receipt_id']);
                $table->index(['product_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
