<?php

return [

    /*
    |--------------------------------------------------------------------------
    | MySQL range partitions (monthly)
    |--------------------------------------------------------------------------
    |
    | Only applied when DB driver is mysql. SQLite/local dev skips partitioning.
    | Partition key is always created_at (or sold_at coalesced to created_at on sales).
    |
    */

    'months_back' => (int) env('PARTITION_MONTHS_BACK', 3),

    'months_ahead' => (int) env('PARTITION_MONTHS_AHEAD', 15),

    'retention_days' => [
        'activity_logs' => (int) env('ACTIVITY_LOG_RETENTION_DAYS', 90),
        'user_notifications' => (int) env('NOTIFICATION_RETENTION_DAYS', 90),
        'messages' => (int) env('CHAT_MESSAGE_RETENTION_DAYS', 365),
    ],

    /*
    | Partitioned tables: monthly RANGE(created_at).
    | "retention" = old partitions may be DROP PARTITION by prune commands.
    | "archive"   = never auto-drop (business/audit data).
    */
    'tables' => [
        'activity_logs' => ['retention' => true, 'column' => 'created_at'],
        'user_notifications' => ['retention' => true, 'column' => 'created_at'],
        'messages' => ['retention' => true, 'column' => 'created_at'],
        'stock_movements' => ['retention' => false, 'column' => 'created_at'],
        'sales' => ['retention' => false, 'column' => 'created_at'],
        'sale_items' => ['retention' => false, 'column' => 'created_at'],
        'payments' => ['retention' => false, 'column' => 'created_at'],
        'goods_receipts' => ['retention' => false, 'column' => 'created_at'],
        'goods_receipt_items' => ['retention' => false, 'column' => 'created_at'],
        'purchase_returns' => ['retention' => false, 'column' => 'created_at'],
        'purchase_return_items' => ['retention' => false, 'column' => 'created_at'],
        'purchase_return_approvals' => ['retention' => false, 'column' => 'created_at'],
        'vendor_adjustment_notes' => ['retention' => false, 'column' => 'created_at'],
        'vendor_adjustment_note_items' => ['retention' => false, 'column' => 'created_at'],
        'vendor_invoices' => ['retention' => false, 'column' => 'created_at'],
        'vendor_invoice_items' => ['retention' => false, 'column' => 'created_at'],
        'match_exceptions' => ['retention' => false, 'column' => 'created_at'],
        'purchase_order_delivery_schedules' => ['retention' => false, 'column' => 'created_at'],
        'procurement_attachments' => ['retention' => false, 'column' => 'created_at'],
    ],

];
