<?php

namespace App\Support;

use App\Models\Company;

class ProcurementSettings
{
    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return config('procurement.defaults', []);
    }

    /**
     * @return array<string, mixed>
     */
    public static function merged(?Company $company = null): array
    {
        $company ??= CurrentCompany::company();

        if (! $company) {
            return self::defaults();
        }

        return array_merge($company->defaultSettings(), $company->settings ?? []);
    }

    public static function get(string $key, mixed $default = null, ?Company $company = null): mixed
    {
        $settings = self::merged($company);

        return $settings[$key] ?? $default ?? self::defaults()[$key] ?? null;
    }

    public static function bool(string $key, ?Company $company = null): bool
    {
        return (bool) self::get($key, false, $company);
    }

    public static function flow(?Company $company = null): string
    {
        return (string) self::get('purchase_flow', 'direct', $company);
    }

    public static function returnEnabled(?Company $company = null): bool
    {
        return self::bool('return_enabled', $company);
    }

    public static function returnNeedApproval(?Company $company = null): bool
    {
        return self::bool('return_need_approval', $company);
    }

    public static function prNeedApproval(?Company $company = null): bool
    {
        return self::bool('pr_need_approval', $company);
    }

    public static function poNeedApproval(?Company $company = null): bool
    {
        return self::bool('po_need_approval', $company);
    }

    public static function vendorInvoiceEnabled(?Company $company = null): bool
    {
        return self::bool('vendor_invoice_enabled', $company);
    }

    public static function vendorInvoiceNeedApproval(?Company $company = null): bool
    {
        return self::bool('vendor_invoice_need_approval', $company);
    }

    public static function grReversalEnabled(?Company $company = null): bool
    {
        return self::bool('gr_reversal_enabled', $company);
    }

    public static function vendorAdjustmentEnabled(?Company $company = null): bool
    {
        return self::bool('vendor_adjustment_enabled', $company);
    }

    public static function deliveryScheduleEnabled(?Company $company = null): bool
    {
        return self::bool('delivery_schedule_enabled', $company);
    }

    public static function attachmentsEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_attachments_enabled', $company);
    }

    public static function costCenterEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_cost_center_enabled', $company);
    }

    public static function matchEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_match_enabled', $company);
    }

    public static function twoWayMatchEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_two_way_match_enabled', $company);
    }

    public static function vendorPaymentBatchEnabled(?Company $company = null): bool
    {
        return self::bool('vendor_payment_batch_enabled', $company);
    }

    public static function vendorPaymentBatchNeedApproval(?Company $company = null): bool
    {
        return self::bool('vendor_payment_batch_need_approval', $company);
    }

    public static function vendorPrepaymentEnabled(?Company $company = null): bool
    {
        return self::bool('vendor_prepayment_enabled', $company);
    }

    public static function vendorPrepaymentNeedApproval(?Company $company = null): bool
    {
        return self::bool('vendor_prepayment_need_approval', $company);
    }

    public static function withholdingTaxEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_withholding_tax_enabled', $company);
    }

    public static function glPostingEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_gl_posting_enabled', $company);
    }

    public static function budgetCheckEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_budget_check_enabled', $company);
    }

    public static function rfqEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_rfq_enabled', $company);
    }

    public static function vendorPriceListEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_vendor_price_list_enabled', $company);
    }

    public static function contractEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_contract_enabled', $company);
    }

    public static function autoReorderEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_auto_reorder_enabled', $company);
    }

    public static function demandPlanningEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_demand_planning_enabled', $company);
    }

    public static function annualPlanEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_annual_plan_enabled', $company);
    }

    public static function landedCostEnabled(?Company $company = null): bool
    {
        return self::bool('procurement_landed_cost_enabled', $company);
    }

    public static function getInt(string $key, ?Company $company = null): ?int
    {
        $val = self::get($key, null, $company);

        if ($val === null || $val === '') {
            return null;
        }

        return (int) $val;
    }

    public static function matchQtyTolerance(?Company $company = null): float
    {
        return (float) self::get('procurement_match_qty_tolerance', 0, $company);
    }

    public static function matchPriceTolerance(?Company $company = null): float
    {
        return (float) self::get('procurement_match_price_tolerance', 0, $company);
    }
}
