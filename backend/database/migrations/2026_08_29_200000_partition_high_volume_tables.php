<?php

use App\Support\HighVolumePartitionInstaller;
use App\Support\MySqlPartitions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addReportingIndexes();

        if (! MySqlPartitions::enabled()) {
            return;
        }

        HighVolumePartitionInstaller::apply();
    }

    public function down(): void
    {
        // Removing partitions on live data is risky — handled manually if needed.
    }

    private function addReportingIndexes(): void
    {
        if (Schema::hasTable('sales') && ! $this->indexExists('sales', 'sales_company_sold_id_idx')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->index(['company_id', 'sold_at', 'id'], 'sales_company_sold_id_idx');
            });
        }

        if (Schema::hasTable('sale_items') && ! $this->indexExists('sale_items', 'sale_items_company_sale_created_idx')) {
            Schema::table('sale_items', function (Blueprint $table) {
                $table->index(['company_id', 'sale_id', 'created_at'], 'sale_items_company_sale_created_idx');
            });
        }

        if (Schema::hasTable('payments') && ! $this->indexExists('payments', 'payments_company_paid_id_idx')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->index(['company_id', 'paid_at', 'id'], 'payments_company_paid_id_idx');
            });
        }

        if (Schema::hasTable('user_notifications') && ! $this->indexExists('user_notifications', 'user_notif_user_created_idx')) {
            Schema::table('user_notifications', function (Blueprint $table) {
                $table->index(['user_id', 'created_at'], 'user_notif_user_created_idx');
            });
        }

        if (Schema::hasTable('stock_movements') && ! $this->indexExists('stock_movements', 'stock_mv_company_created_idx')) {
            Schema::table('stock_movements', function (Blueprint $table) {
                $table->index(['company_id', 'created_at', 'id'], 'stock_mv_company_created_idx');
            });
        }

        if (Schema::hasTable('messages') && ! $this->indexExists('messages', 'messages_conv_created_idx')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->index(['conversation_id', 'created_at', 'id'], 'messages_conv_created_idx');
            });
        }
    }

    private function indexExists(string $table, string $name): bool
    {
        $db = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $name)
            ->exists();
    }
};
