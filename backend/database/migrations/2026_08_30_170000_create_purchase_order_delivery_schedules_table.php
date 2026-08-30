<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('purchase_order_delivery_schedules');

        Schema::create('purchase_order_delivery_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->date('delivery_date');
            $table->unsignedInteger('qty')->nullable();
            $table->string('status', 20)->default('planned');
            $table->string('note', 255)->nullable();
            $table->timestamp('fulfilled_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'delivery_date', 'status'], 'po_del_sched_co_date_status_idx');
            $table->index(['purchase_order_id', 'delivery_date'], 'po_del_sched_po_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_order_delivery_schedules');
    }
};
