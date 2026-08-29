<?php

namespace App\Support;

use Illuminate\Support\Facades\Schema;

class HighVolumePartitionInstaller
{
    /**
     * @return list<string> tables partitioned in this run
     */
    public static function apply(): array
    {
        if (! MySqlPartitions::enabled()) {
            return [];
        }

        foreach (array_keys(config('partitions.tables', [])) as $table) {
            if (Schema::hasTable($table)) {
                MySqlPartitions::dropAllForeignKeyConstraints($table);
            }
        }

        $applied = [];

        foreach ([
            'activity_logs' => fn () => self::activityLogs(),
            'user_notifications' => fn () => self::userNotifications(),
            'messages' => fn () => self::messages(),
            'stock_movements' => fn () => self::stockMovements(),
            'sale_items' => fn () => self::saleItems(),
            'sales' => fn () => self::sales(),
            'payments' => fn () => self::payments(),
        ] as $table => $callback) {
            if (! Schema::hasTable($table) || MySqlPartitions::isPartitioned($table)) {
                continue;
            }

            $callback();
            if (MySqlPartitions::isPartitioned($table)) {
                $applied[] = $table;
            }
        }

        return $applied;
    }

    private static function activityLogs(): void
    {
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

    private static function userNotifications(): void
    {
        MySqlPartitions::dropIndexIfExists('user_notifications', 'user_notif_user_read_idx');
        MySqlPartitions::dropIndexIfExists('user_notifications', 'user_notif_company_user_idx');
        MySqlPartitions::createIndexIfNotExists('user_notifications', 'user_notif_user_read_created_idx', '`user_id`, `read_at`, `created_at`');
        MySqlPartitions::createIndexIfNotExists('user_notifications', 'user_notif_company_user_created_idx', '`company_id`, `user_id`, `created_at`');
        MySqlPartitions::recomposePrimaryKey('user_notifications');
        MySqlPartitions::applyRangeByCreatedAt('user_notifications');
    }

    private static function messages(): void
    {
        MySqlPartitions::dropIndexIfExists('messages', 'messages_conversation_id_id_index');
        MySqlPartitions::dropIndexIfExists('messages', 'messages_company_id_conversation_id_index');
        MySqlPartitions::createIndexIfNotExists('messages', 'messages_company_conv_created_idx', '`company_id`, `conversation_id`, `created_at`');
        MySqlPartitions::recomposePrimaryKey('messages');
        MySqlPartitions::applyRangeByCreatedAt('messages');
    }

    private static function stockMovements(): void
    {
        MySqlPartitions::recomposePrimaryKey('stock_movements');
        MySqlPartitions::applyRangeByCreatedAt('stock_movements');
    }

    private static function sales(): void
    {
        MySqlPartitions::dropIncomingForeignKeys('sales');
        MySqlPartitions::dropIndexIfExists('sales', 'sales_company_id_client_uuid_unique');
        MySqlPartitions::dropIndexIfExists('sales', 'sales_company_id_number_unique');
        MySqlPartitions::createIndexIfNotExists('sales', 'sales_company_uuid_created_unique', '`company_id`, `client_uuid`, `created_at`', true);
        MySqlPartitions::createIndexIfNotExists('sales', 'sales_company_number_created_unique', '`company_id`, `number`, `created_at`', true);
        MySqlPartitions::recomposePrimaryKey('sales');
        MySqlPartitions::applyRangeByCreatedAt('sales');
    }

    private static function saleItems(): void
    {
        MySqlPartitions::createIndexIfNotExists('sale_items', 'sale_items_sale_created_idx', '`sale_id`, `created_at`, `id`');
        MySqlPartitions::recomposePrimaryKey('sale_items');
        MySqlPartitions::applyRangeByCreatedAt('sale_items');
    }

    private static function payments(): void
    {
        MySqlPartitions::dropIndexIfExists('payments', 'payments_company_id_client_uuid_unique');
        MySqlPartitions::dropIndexIfExists('payments', 'payments_payable_type_payable_id_index');
        MySqlPartitions::createIndexIfNotExists('payments', 'payments_company_uuid_created_unique', '`company_id`, `client_uuid`, `created_at`', true);
        MySqlPartitions::createIndexIfNotExists('payments', 'payments_payable_created_idx', '`payable_type`, `payable_id`, `created_at`');
        MySqlPartitions::recomposePrimaryKey('payments');
        MySqlPartitions::applyRangeByCreatedAt('payments');
    }
}
