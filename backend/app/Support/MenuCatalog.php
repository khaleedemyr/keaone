<?php

namespace App\Support;

class MenuCatalog
{
    public const ACTIONS = ['view', 'create', 'edit', 'delete'];

    /**
     * @return list<array{key: string, actions: list<string>}>
     */
    public static function tenant(): array
    {
        return [
            self::menu('insight', ['view']),
            self::menu('chat', ['view', 'create']),
            self::menu('pos', ['view', 'create']),
            self::menu('products', self::ACTIONS),
            self::menu('categories', self::ACTIONS),
            self::menu('subcategories', self::ACTIONS),
            self::menu('units', self::ACTIONS),
            self::menu('itemtypes', self::ACTIONS),
            self::menu('pricechannels', self::ACTIONS),
            self::menu('discounts', self::ACTIONS),
            self::menu('promotions', self::ACTIONS),
            self::menu('customfields', self::ACTIONS),
            self::menu('choicetypes', self::ACTIONS),
            self::menu('choices', self::ACTIONS),
            self::menu('warehouses', self::ACTIONS),
            self::menu('suppliers', self::ACTIONS),
            self::menu('customers', self::ACTIONS),
            self::menu('sales', self::ACTIONS),
            self::menu('salesreportsummary', ['view']),
            self::menu('salesreportproducts', ['view']),
            self::menu('salesreportcashiers', ['view']),
            self::menu('salesreportmethods', ['view']),
            self::menu('salesreportchannels', ['view']),
            self::menu('salesreportdaily', ['view']),
            self::menu('contacts', ['view', 'create', 'edit']),
            self::menu('stock', ['view']),
            self::menu('stockcard', ['view']),
            self::menu('purchaserequisitions', self::ACTIONS),
            self::menu('purchaseorders', self::ACTIONS),
            self::menu('goodsreceipts', self::ACTIONS),
            self::menu('purchasereturns', self::ACTIONS),
            self::menu('vendoradjustmentnotes', self::ACTIONS),
            self::menu('vendorinvoices', self::ACTIONS),
            self::menu('matchexceptions', ['view', 'edit']),
            self::menu('vendorpaymentbatches', self::ACTIONS),
            self::menu('vendorprepayments', self::ACTIONS),
            self::menu('vendorwithholding', ['view', 'edit']),
            self::menu('glaccounts', self::ACTIONS),
            self::menu('gljournals', ['view']),
            self::menu('procurementbudgets', self::ACTIONS),
            self::menu('procurementcontracts', self::ACTIONS),
            self::menu('procurementplans', self::ACTIONS),
            self::menu('approvalmatrix', self::ACTIONS),
            self::menu('approvaldelegations', self::ACTIONS),
            self::menu('fixedassets', self::ACTIONS),
            self::menu('rfqs', self::ACTIONS),
            self::menu('supplierpricelists', self::ACTIONS),
            self::menu('deliveryschedules', self::ACTIONS),
            self::menu('procurementdashboard', ['view']),
            self::menu('procurementreports', ['view']),
            self::menu('purchasesettings', ['view', 'edit']),
            self::menu('approvals', ['view', 'edit']),
            self::menu('departments', self::ACTIONS),
            self::menu('positions', self::ACTIONS),
            self::menu('joblevels', self::ACTIONS),
            self::menu('users', self::ACTIONS),
            self::menu('roles', self::ACTIONS),
            self::menu('company', ['view', 'edit']),
            self::menu('outlets', self::ACTIONS),
            self::menu('modules', ['view', 'edit']),
            self::menu('ops', ['view', 'edit']),
            self::menu('possettings', ['view', 'edit']),
            self::menu('cafetables', self::ACTIONS),
            self::menu('billing', ['view', 'edit']),
            self::menu('logs', ['view']),
            self::menu('settings', ['view', 'edit']),
        ];
    }

    /**
     * @return list<array{key: string, actions: list<string>}>
     */
    public static function platform(): array
    {
        return [
            self::menu('overview', ['view']),
            self::menu('tenants', ['view', 'edit']),
            self::menu('billing', self::ACTIONS),
            self::menu('catalog', self::ACTIONS),
            self::menu('blog', self::ACTIONS),
            self::menu('livesupport', ['view', 'create']),
            self::menu('operators', self::ACTIONS),
            self::menu('roles', self::ACTIONS),
            self::menu('logs', ['view']),
            self::menu('settings', ['view', 'edit']),
        ];
    }

    /**
     * @return list<array{key: string, actions: list<string>}>
     */
    public static function for(string $scope): array
    {
        return $scope === 'platform' ? self::platform() : self::tenant();
    }

    public static function keys(string $scope): array
    {
        return array_column(self::for($scope), 'key');
    }

    public static function allows(string $scope, string $menu, string $action): bool
    {
        foreach (self::for($scope) as $item) {
            if ($item['key'] === $menu) {
                return in_array($action, $item['actions'], true);
            }
        }

        return false;
    }

    public static function salesReportMenu(string $kind): string
    {
        return match ($kind) {
            'products' => 'salesreportproducts',
            'cashiers' => 'salesreportcashiers',
            'methods' => 'salesreportmethods',
            'channels' => 'salesreportchannels',
            'daily' => 'salesreportdaily',
            default => 'salesreportsummary',
        };
    }

    /**
     * @param  list<string>  $actions
     * @return array{key: string, actions: list<string>}
     */
    private static function menu(string $key, array $actions): array
    {
        return ['key' => $key, 'actions' => $actions];
    }
}
