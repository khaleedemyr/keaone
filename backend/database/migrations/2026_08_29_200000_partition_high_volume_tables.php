<?php

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

        foreach (array_keys(config('partitions.tables', [])) as $table) {
            if (Schema::hasTable($table)) {
                MySqlPartitions::dropAllForeignKeyConstraints($table);
            }
        }

        $this->partitionActivityLogs();
        $this->partitionUserNotifications();
        $this->partitionMessages();
        $this->partitionStockMovements();
        $this->partitionSaleItems();
        $this->partitionSales();
        $this->partitionPayments();
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

    private function partitionActivityLogs(): void
    {
        if (! Schema::hasTable('activity_logs') || MySqlPartitions::isPartitioned('activity_logs')) {
            return;
        }

        MySqlPartitions::dropForeignKeys('activity_logs');
        foreach ([
            'activity_logs_company_id_id_index',
            'activity_logs_user_id_id_index',
            'activity_logs_scope_id_index',
            'activity_logs_menu_key_id_index',
        ] as $index) {
            MySqlPartitions::dropIndexIfExists('activity_logs', $index);
        }

        MySqlPartitions::createIndexIfNotExists('activity_logs', 'activity_logs_company_created_idx', '`company_id`, `created_at`, `id`');
        MySqlPartitions::createIndexIfNotExists('activity_logs', 'activity_logs_user_created_idx', '`user_id`, `created_at`, `id`');

        MySqlPartitions::recomposePrimaryKey('activity_logs');
        MySqlPartitions::applyRangeByCreatedAt('activity_logs');
    }

    private function partitionUserNotifications(): void
    {
        if (! Schema::hasTable('user_notifications') || MySqlPartitions::isPartitioned('user_notifications')) {
            return;
        }

        MySqlPartitions::dropForeignKeys('user_notifications');
        MySqlPartitions::dropIndexIfExists('user_notifications', 'user_notif_user_read_idx');
        MySqlPartitions::dropIndexIfExists('user_notifications', 'user_notif_company_user_idx');

        MySqlPartitions::createIndexIfNotExists('user_notifications', 'user_notif_user_read_created_idx', '`user_id`, `read_at`, `created_at`');
        MySqlPartitions::createIndexIfNotExists('user_notifications', 'user_notif_company_user_created_idx', '`company_id`, `user_id`, `created_at`');

        MySqlPartitions::recomposePrimaryKey('user_notifications');
        MySqlPartitions::applyRangeByCreatedAt('user_notifications');
    }

    private function partitionMessages(): void
    {
        if (! Schema::hasTable('messages') || MySqlPartitions::isPartitioned('messages')) {
            return;
        }

        MySqlPartitions::dropForeignKeys('messages');
        MySqlPartitions::dropIndexIfExists('messages', 'messages_conversation_id_id_index');
        MySqlPartitions::dropIndexIfExists('messages', 'messages_company_id_conversation_id_index');

        MySqlPartitions::createIndexIfNotExists('messages', 'messages_company_conv_created_idx', '`company_id`, `conversation_id`, `created_at`');

        MySqlPartitions::recomposePrimaryKey('messages');
        MySqlPartitions::applyRangeByCreatedAt('messages');
    }

    private function partitionStockMovements(): void
    {
        if (! Schema::hasTable('stock_movements') || MySqlPartitions::isPartitioned('stock_movements')) {
            return;
        }

        MySqlPartitions::dropForeignKeys('stock_movements');

        MySqlPartitions::recomposePrimaryKey('stock_movements');
        MySqlPartitions::applyRangeByCreatedAt('stock_movements');
    }

    private function partitionSales(): void
    {
        if (! Schema::hasTable('sales') || MySqlPartitions::isPartitioned('sales')) {
            return;
        }

        MySqlPartitions::dropIncomingForeignKeys('sales');
        MySqlPartitions::dropForeignKeys('sales');
        MySqlPartitions::dropIndexIfExists('sales', 'sales_company_id_client_uuid_unique');
        MySqlPartitions::dropIndexIfExists('sales', 'sales_company_id_number_unique');

        MySqlPartitions::createIndexIfNotExists('sales', 'sales_company_uuid_created_unique', '`company_id`, `client_uuid`, `created_at`', true);
        MySqlPartitions::createIndexIfNotExists('sales', 'sales_company_number_created_unique', '`company_id`, `number`, `created_at`', true);

        MySqlPartitions::recomposePrimaryKey('sales');
        MySqlPartitions::applyRangeByCreatedAt('sales');
    }

    private function partitionSaleItems(): void
    {
        if (! Schema::hasTable('sale_items') || MySqlPartitions::isPartitioned('sale_items')) {
            return;
        }

        MySqlPartitions::dropForeignKeys('sale_items');
        MySqlPartitions::createIndexIfNotExists('sale_items', 'sale_items_sale_created_idx', '`sale_id`, `created_at`, `id`');

        MySqlPartitions::recomposePrimaryKey('sale_items');
        MySqlPartitions::applyRangeByCreatedAt('sale_items');
    }

    private function partitionPayments(): void
    {
        if (! Schema::hasTable('payments') || MySqlPartitions::isPartitioned('payments')) {
            return;
        }

        MySqlPartitions::dropForeignKeys('payments');
        MySqlPartitions::dropIndexIfExists('payments', 'payments_company_id_client_uuid_unique');
        MySqlPartitions::dropIndexIfExists('payments', 'payments_payable_type_payable_id_index');

        MySqlPartitions::createIndexIfNotExists('payments', 'payments_company_uuid_created_unique', '`company_id`, `client_uuid`, `created_at`', true);
        MySqlPartitions::createIndexIfNotExists('payments', 'payments_payable_created_idx', '`payable_type`, `payable_id`, `created_at`');

        MySqlPartitions::recomposePrimaryKey('payments');
        MySqlPartitions::applyRangeByCreatedAt('payments');
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
