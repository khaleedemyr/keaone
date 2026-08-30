<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Procurement module settings (stored in companies.settings JSON)
    |--------------------------------------------------------------------------
    |
    | Keys here are merged into Company::defaultSettings().
    | Legacy keys purchase_* are kept for backward compatibility.
    |
    */

    'defaults' => [
        // Flow
        'purchase_flow' => 'direct',
        'purchase_update_cost' => true,
        'po_auto_close_on_full_receive' => true,

        // Approvals
        'pr_need_approval' => false,
        'po_need_approval' => false,
        'return_need_approval' => false,
        'vendor_invoice_need_approval' => false,
        'vendor_payment_batch_need_approval' => false,
        'vendor_prepayment_need_approval' => false,

        // Feature toggles
        'return_enabled' => true,
        'gr_reversal_enabled' => false,
        'vendor_adjustment_enabled' => true,
        'delivery_schedule_enabled' => true,
        'procurement_attachments_enabled' => true,
        'procurement_cost_center_enabled' => true,
        'vendor_invoice_enabled' => false,
        'vendor_payment_batch_enabled' => false,
        'vendor_prepayment_enabled' => false,
        'procurement_withholding_tax_enabled' => false,
        'procurement_gl_posting_enabled' => false,
        'procurement_budget_check_enabled' => false,
        'procurement_rfq_enabled' => false,
        'procurement_vendor_price_list_enabled' => false,
        'procurement_match_enabled' => false,
        'procurement_two_way_match_enabled' => false,
        'procurement_contract_enabled' => false,
        'procurement_auto_reorder_enabled' => false,
        'procurement_demand_planning_enabled' => false,
        'procurement_annual_plan_enabled' => false,
        'procurement_landed_cost_enabled' => false,

        // Approval governance (Phase 6)
        'procurement_approval_mode' => 'manual',
        'procurement_approval_parallel_enabled' => false,
        'procurement_approval_delegation_enabled' => false,
        'procurement_approval_escalation_enabled' => false,
        'procurement_approval_sla_days' => 3,
        'procurement_sod_creator_approver' => true,
        'procurement_sod_approver_receiver' => false,
        'procurement_field_audit_enabled' => true,

        // 3-way match tolerance (percent, 0 = exact)
        'procurement_match_qty_tolerance' => 0,
        'procurement_match_price_tolerance' => 0,

        // GL COA mapping (account IDs)
        'gl_procurement_inventory_account_id' => null,
        'gl_procurement_grni_account_id' => null,
        'gl_procurement_ap_account_id' => null,
        'gl_procurement_vat_input_account_id' => null,
        'gl_procurement_cash_account_id' => null,
        'gl_procurement_bank_account_id' => null,
        'gl_procurement_wht_payable_account_id' => null,
        'gl_procurement_expense_account_id' => null,
        'gl_procurement_fixed_asset_account_id' => null,
    ],

    /*
    | Keys editable via purchasesettings / procurement settings UI.
    */
    'settings_keys' => [
        'purchase_flow',
        'purchase_update_cost',
        'po_auto_close_on_full_receive',
        'pr_need_approval',
        'po_need_approval',
        'return_need_approval',
        'vendor_invoice_need_approval',
        'vendor_payment_batch_need_approval',
        'vendor_prepayment_need_approval',
        'return_enabled',
        'gr_reversal_enabled',
        'vendor_adjustment_enabled',
        'delivery_schedule_enabled',
        'procurement_attachments_enabled',
        'procurement_cost_center_enabled',
        'vendor_invoice_enabled',
        'vendor_payment_batch_enabled',
        'vendor_prepayment_enabled',
        'procurement_withholding_tax_enabled',
        'procurement_gl_posting_enabled',
        'procurement_budget_check_enabled',
        'procurement_rfq_enabled',
        'procurement_vendor_price_list_enabled',
        'procurement_match_enabled',
        'procurement_two_way_match_enabled',
        'procurement_contract_enabled',
        'procurement_auto_reorder_enabled',
        'procurement_demand_planning_enabled',
        'procurement_annual_plan_enabled',
        'procurement_landed_cost_enabled',
        'procurement_approval_mode',
        'procurement_approval_parallel_enabled',
        'procurement_approval_delegation_enabled',
        'procurement_approval_escalation_enabled',
        'procurement_approval_sla_days',
        'procurement_sod_creator_approver',
        'procurement_sod_approver_receiver',
        'procurement_field_audit_enabled',
        'procurement_match_qty_tolerance',
        'procurement_match_price_tolerance',
        'gl_procurement_inventory_account_id',
        'gl_procurement_grni_account_id',
        'gl_procurement_ap_account_id',
        'gl_procurement_vat_input_account_id',
        'gl_procurement_cash_account_id',
        'gl_procurement_bank_account_id',
        'gl_procurement_wht_payable_account_id',
        'gl_procurement_expense_account_id',
        'gl_procurement_fixed_asset_account_id',
    ],

];
