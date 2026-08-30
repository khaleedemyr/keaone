<?php

namespace App\Support;

use Illuminate\Support\Facades\Schema;

class HighVolumePartitionInstaller
{
    /**
     * @param  callable(string, string): void|null  $log
     * @return list<string> tables partitioned in this run
     */
    public static function apply(?callable $log = null): array
    {
        if (! MySqlPartitions::enabled()) {
            $log?->__invoke('_', 'partitioning disabled (not mysql/mariadb)');

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
            'goods_receipts' => fn () => self::goodsReceipts(),
            'goods_receipt_items' => fn () => self::goodsReceiptItems(),
            'purchase_returns' => fn () => self::purchaseReturns(),
            'purchase_return_items' => fn () => self::purchaseReturnItems(),
            'purchase_return_approvals' => fn () => self::purchaseReturnApprovals(),
            'vendor_adjustment_notes' => fn () => self::vendorAdjustmentNotes(),
            'vendor_adjustment_note_items' => fn () => self::vendorAdjustmentNoteItems(),
            'vendor_invoices' => fn () => self::vendorInvoices(),
            'vendor_invoice_items' => fn () => self::vendorInvoiceItems(),
            'match_exceptions' => fn () => self::matchExceptions(),
            'purchase_order_delivery_schedules' => fn () => self::purchaseOrderDeliverySchedules(),
            'procurement_attachments' => fn () => self::procurementAttachments(),
        ] as $table => $callback) {
            if (! Schema::hasTable($table)) {
                $log?->__invoke($table, 'skip (table missing)');

                continue;
            }

            if (MySqlPartitions::isPartitioned($table)) {
                $log?->__invoke($table, 'skip (already partitioned)');

                continue;
            }

            $log?->__invoke($table, 'applying...');
            $callback();

            if (MySqlPartitions::isPartitioned($table)) {
                $applied[] = $table;
                $log?->__invoke($table, 'done');
            } else {
                $log?->__invoke($table, 'failed (ALTER did not partition — check MySQL error log)');
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

    private static function goodsReceipts(): void
    {
        MySqlPartitions::dropIncomingForeignKeys('goods_receipts');
        MySqlPartitions::dropIndexIfExists('goods_receipts', 'goods_receipts_company_id_number_unique');
        MySqlPartitions::dropIndexIfExists('goods_receipts', 'goods_receipts_company_id_client_uuid_unique');
        MySqlPartitions::createIndexIfNotExists('goods_receipts', 'goods_receipts_company_number_created_unique', '`company_id`, `number`, `created_at`', true);
        MySqlPartitions::createIndexIfNotExists('goods_receipts', 'goods_receipts_company_uuid_created_unique', '`company_id`, `client_uuid`, `created_at`', true);
        MySqlPartitions::recomposePrimaryKey('goods_receipts');
        MySqlPartitions::applyRangeByCreatedAt('goods_receipts');
    }

    private static function goodsReceiptItems(): void
    {
        MySqlPartitions::createIndexIfNotExists('goods_receipt_items', 'goods_receipt_items_gr_created_idx', '`goods_receipt_id`, `created_at`, `id`');
        MySqlPartitions::recomposePrimaryKey('goods_receipt_items');
        MySqlPartitions::applyRangeByCreatedAt('goods_receipt_items');
    }

    private static function purchaseReturns(): void
    {
        MySqlPartitions::dropIncomingForeignKeys('purchase_returns');
        MySqlPartitions::dropIndexIfExists('purchase_returns', 'purchase_returns_company_id_number_unique');
        MySqlPartitions::dropIndexIfExists('purchase_returns', 'purchase_returns_company_id_client_uuid_unique');
        MySqlPartitions::createIndexIfNotExists('purchase_returns', 'purchase_returns_company_number_created_unique', '`company_id`, `number`, `created_at`', true);
        MySqlPartitions::createIndexIfNotExists('purchase_returns', 'purchase_returns_company_uuid_created_unique', '`company_id`, `client_uuid`, `created_at`', true);
        MySqlPartitions::recomposePrimaryKey('purchase_returns');
        MySqlPartitions::applyRangeByCreatedAt('purchase_returns');
    }

    private static function purchaseReturnItems(): void
    {
        MySqlPartitions::createIndexIfNotExists('purchase_return_items', 'purchase_return_items_return_created_idx', '`purchase_return_id`, `created_at`, `id`');
        MySqlPartitions::recomposePrimaryKey('purchase_return_items');
        MySqlPartitions::applyRangeByCreatedAt('purchase_return_items');
    }

    private static function purchaseReturnApprovals(): void
    {
        MySqlPartitions::dropIndexIfExists('purchase_return_approvals', 'purchase_return_approvals_purchase_return_id_level_unique');
        MySqlPartitions::dropIndexIfExists('purchase_return_approvals', 'purchase_return_approvals_purchase_return_id_user_id_unique');
        MySqlPartitions::createIndexIfNotExists('purchase_return_approvals', 'purchase_return_approvals_return_level_created_unique', '`purchase_return_id`, `level`, `created_at`', true);
        MySqlPartitions::createIndexIfNotExists('purchase_return_approvals', 'purchase_return_approvals_return_user_created_unique', '`purchase_return_id`, `user_id`, `created_at`', true);
        MySqlPartitions::recomposePrimaryKey('purchase_return_approvals');
        MySqlPartitions::applyRangeByCreatedAt('purchase_return_approvals');
    }

    private static function vendorAdjustmentNotes(): void
    {
        MySqlPartitions::dropIncomingForeignKeys('vendor_adjustment_notes');
        MySqlPartitions::dropIndexIfExists('vendor_adjustment_notes', 'vendor_adjustment_notes_company_id_number_unique');
        MySqlPartitions::dropIndexIfExists('vendor_adjustment_notes', 'vendor_adjustment_notes_company_id_client_uuid_unique');
        MySqlPartitions::createIndexIfNotExists('vendor_adjustment_notes', 'vendor_adj_notes_company_number_created_unique', '`company_id`, `number`, `created_at`', true);
        MySqlPartitions::createIndexIfNotExists('vendor_adjustment_notes', 'vendor_adj_notes_company_uuid_created_unique', '`company_id`, `client_uuid`, `created_at`', true);
        MySqlPartitions::recomposePrimaryKey('vendor_adjustment_notes');
        MySqlPartitions::applyRangeByCreatedAt('vendor_adjustment_notes');
    }

    private static function vendorAdjustmentNoteItems(): void
    {
        MySqlPartitions::createIndexIfNotExists('vendor_adjustment_note_items', 'vendor_adj_items_note_created_idx', '`vendor_adjustment_note_id`, `created_at`, `id`');
        MySqlPartitions::recomposePrimaryKey('vendor_adjustment_note_items');
        MySqlPartitions::applyRangeByCreatedAt('vendor_adjustment_note_items');
    }

    private static function vendorInvoices(): void
    {
        MySqlPartitions::dropIncomingForeignKeys('vendor_invoices');
        MySqlPartitions::dropIndexIfExists('vendor_invoices', 'vendor_invoices_company_id_number_unique');
        MySqlPartitions::dropIndexIfExists('vendor_invoices', 'vendor_invoices_company_id_client_uuid_unique');
        MySqlPartitions::createIndexIfNotExists('vendor_invoices', 'vendor_invoices_company_number_created_unique', '`company_id`, `number`, `created_at`', true);
        MySqlPartitions::createIndexIfNotExists('vendor_invoices', 'vendor_invoices_company_uuid_created_unique', '`company_id`, `client_uuid`, `created_at`', true);
        MySqlPartitions::recomposePrimaryKey('vendor_invoices');
        MySqlPartitions::applyRangeByCreatedAt('vendor_invoices');
    }

    private static function vendorInvoiceItems(): void
    {
        MySqlPartitions::createIndexIfNotExists('vendor_invoice_items', 'vendor_invoice_items_invoice_created_idx', '`vendor_invoice_id`, `created_at`, `id`');
        MySqlPartitions::recomposePrimaryKey('vendor_invoice_items');
        MySqlPartitions::applyRangeByCreatedAt('vendor_invoice_items');
    }

    private static function matchExceptions(): void
    {
        MySqlPartitions::createIndexIfNotExists('match_exceptions', 'match_exceptions_invoice_created_idx', '`vendor_invoice_id`, `created_at`, `id`');
        MySqlPartitions::recomposePrimaryKey('match_exceptions');
        MySqlPartitions::applyRangeByCreatedAt('match_exceptions');
    }

    private static function purchaseOrderDeliverySchedules(): void
    {
        MySqlPartitions::dropIncomingForeignKeys('purchase_order_delivery_schedules');
        MySqlPartitions::createIndexIfNotExists(
            'purchase_order_delivery_schedules',
            'po_delivery_schedules_po_date_idx',
            '`purchase_order_id`, `delivery_date`, `created_at`, `id`',
        );
        MySqlPartitions::recomposePrimaryKey('purchase_order_delivery_schedules');
        MySqlPartitions::applyRangeByCreatedAt('purchase_order_delivery_schedules');
    }

    private static function procurementAttachments(): void
    {
        MySqlPartitions::createIndexIfNotExists(
            'procurement_attachments',
            'proc_attachments_doc_created_idx',
            '`document_type`, `document_id`, `created_at`, `id`',
        );
        MySqlPartitions::recomposePrimaryKey('procurement_attachments');
        MySqlPartitions::applyRangeByCreatedAt('procurement_attachments');
    }
}
