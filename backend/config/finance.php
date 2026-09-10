<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Finance / accounting settings (companies.settings JSON whitelist + ACL)
    |--------------------------------------------------------------------------
    */

    'settings_keys' => [
        // Sales GL
        'sales_gl_posting_enabled',
        'gl_sales_cash_account_id',
        'gl_sales_bank_account_id',
        'gl_sales_ar_account_id',
        'gl_sales_revenue_account_id',
        'gl_sales_vat_output_account_id',
        'gl_sales_cogs_account_id',
        'gl_sales_inventory_account_id',

        // Procurement / AP GL
        'procurement_gl_posting_enabled',
        'procurement_budget_check_enabled',
        'procurement_fixed_asset_auto_serial_enabled',
        'gl_procurement_inventory_account_id',
        'gl_procurement_grni_account_id',
        'gl_procurement_ap_account_id',
        'gl_procurement_vat_input_account_id',
        'gl_procurement_cash_account_id',
        'gl_procurement_bank_account_id',
        'gl_procurement_wht_payable_account_id',
        'gl_procurement_expense_account_id',
        'gl_procurement_fixed_asset_account_id',
        'gl_procurement_prepayment_account_id',
    ],

];
