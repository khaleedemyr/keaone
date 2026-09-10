<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Sales / POS module settings (stored in companies.settings JSON)
    |--------------------------------------------------------------------------
    */

    'defaults' => [
        'sales_gl_posting_enabled' => false,

        // Prefer dedicated sales COA; cash/bank/inventory may fall back to procurement mapping.
        'gl_sales_cash_account_id' => null,
        'gl_sales_bank_account_id' => null,
        'gl_sales_ar_account_id' => null,
        'gl_sales_revenue_account_id' => null,
        'gl_sales_vat_output_account_id' => null,
        'gl_sales_cogs_account_id' => null,
        'gl_sales_inventory_account_id' => null,
    ],

    'settings_keys' => [
        'sales_gl_posting_enabled',
        'gl_sales_cash_account_id',
        'gl_sales_bank_account_id',
        'gl_sales_ar_account_id',
        'gl_sales_revenue_account_id',
        'gl_sales_vat_output_account_id',
        'gl_sales_cogs_account_id',
        'gl_sales_inventory_account_id',
    ],

];
