<?php

namespace App\Services;

use App\Models\Company;
use App\Models\GlAccount;
use App\Support\ProcurementSettings;

class GlAccountService
{
    /**
     * @return array<string, array{code: string, name: string, type: string, setting: string}>
     */
    public static function defaultCatalog(): array
    {
        return [
            'inventory' => ['code' => '1-1100', 'name' => 'Persediaan Barang', 'type' => 'asset', 'setting' => 'gl_procurement_inventory_account_id'],
            'fixed_asset' => ['code' => '1-1500', 'name' => 'Aset Tetap', 'type' => 'asset', 'setting' => 'gl_procurement_fixed_asset_account_id'],
            'vat_input' => ['code' => '1-1400', 'name' => 'PPN Masukan', 'type' => 'asset', 'setting' => 'gl_procurement_vat_input_account_id'],
            'cash' => ['code' => '1-1000', 'name' => 'Kas', 'type' => 'asset', 'setting' => 'gl_procurement_cash_account_id'],
            'bank' => ['code' => '1-1200', 'name' => 'Bank', 'type' => 'asset', 'setting' => 'gl_procurement_bank_account_id'],
            'ar' => ['code' => '1-1300', 'name' => 'Piutang Usaha', 'type' => 'asset', 'setting' => 'gl_sales_ar_account_id'],
            'grni' => ['code' => '2-1100', 'name' => 'Utang GRNI', 'type' => 'liability', 'setting' => 'gl_procurement_grni_account_id'],
            'ap' => ['code' => '2-1200', 'name' => 'Utang Usaha', 'type' => 'liability', 'setting' => 'gl_procurement_ap_account_id'],
            'wht_payable' => ['code' => '2-1300', 'name' => 'Utang PPh', 'type' => 'liability', 'setting' => 'gl_procurement_wht_payable_account_id'],
            'vat_output' => ['code' => '2-1400', 'name' => 'PPN Keluaran', 'type' => 'liability', 'setting' => 'gl_sales_vat_output_account_id'],
            'revenue' => ['code' => '4-1000', 'name' => 'Pendapatan Penjualan', 'type' => 'revenue', 'setting' => 'gl_sales_revenue_account_id'],
            'cogs' => ['code' => '5-1000', 'name' => 'Harga Pokok Penjualan', 'type' => 'expense', 'setting' => 'gl_sales_cogs_account_id'],
            'expense' => ['code' => '5-1100', 'name' => 'Beban Pembelian', 'type' => 'expense', 'setting' => 'gl_procurement_expense_account_id'],
        ];
    }

    /**
     * @return array<string, int>
     */
    public function ensureDefaults(Company $company): array
    {
        $map = [];

        foreach (self::defaultCatalog() as $key => $row) {
            $account = GlAccount::query()->firstOrCreate(
                [
                    'company_id' => $company->id,
                    'code' => $row['code'],
                ],
                [
                    'name' => $row['name'],
                    'account_type' => $row['type'],
                    'is_active' => true,
                    'is_system' => true,
                ],
            );

            $map[$key] = (int) $account->id;
        }

        $settings = $company->settings ?? [];
        $changed = false;

        foreach (self::defaultCatalog() as $key => $row) {
            if (empty($settings[$row['setting']])) {
                $settings[$row['setting']] = $map[$key];
                $changed = true;
            }
        }

        // Sales cash/bank/inventory default to the shared procurement accounts when unset.
        $salesFallbacks = [
            'gl_sales_cash_account_id' => $map['cash'] ?? null,
            'gl_sales_bank_account_id' => $map['bank'] ?? null,
            'gl_sales_inventory_account_id' => $map['inventory'] ?? null,
        ];
        foreach ($salesFallbacks as $setting => $accountId) {
            if ($accountId && empty($settings[$setting])) {
                $settings[$setting] = $accountId;
                $changed = true;
            }
        }

        if ($changed) {
            $company->update(['settings' => $settings]);
        }

        return $map;
    }

    public function serialize(GlAccount $account): array
    {
        return [
            'id' => $account->id,
            'code' => $account->code,
            'name' => $account->name,
            'account_type' => $account->account_type,
            'is_active' => $account->is_active,
            'is_system' => $account->is_system,
        ];
    }

    public function accountOptions(?Company $company = null): array
    {
        $company ??= \App\Support\CurrentCompany::company();
        if (! $company) {
            return [];
        }

        return GlAccount::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('code')
            ->get()
            ->map(fn (GlAccount $row) => $this->serialize($row))
            ->values()
            ->all();
    }
}
