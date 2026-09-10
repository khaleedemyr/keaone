<?php

use App\Models\Company;
use App\Models\GlAccount;
use App\Services\GlAccountService;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$svc = app(GlAccountService::class);

foreach (Company::query()->get() as $company) {
    $map = $svc->ensureDefaults($company);
    $settings = $company->fresh()->settings ?? [];
    $settings['sales_gl_posting_enabled'] = true;

    $fallbacks = [
        'gl_sales_cash_account_id' => $map['cash'] ?? null,
        'gl_sales_bank_account_id' => $map['bank'] ?? null,
        'gl_sales_inventory_account_id' => $map['inventory'] ?? null,
        'gl_sales_ar_account_id' => $map['ar'] ?? null,
        'gl_sales_revenue_account_id' => $map['revenue'] ?? null,
        'gl_sales_vat_output_account_id' => $map['vat_output'] ?? null,
        'gl_sales_cogs_account_id' => $map['cogs'] ?? null,
    ];

    foreach ($fallbacks as $key => $accountId) {
        if ($accountId && empty($settings[$key])) {
            $settings[$key] = $accountId;
        }
    }

    $company->update(['settings' => $settings]);
    echo sprintf(
        "company#%d %s sales_gl=on accounts=%d map=%s\n",
        $company->id,
        $company->name,
        count($map),
        json_encode($map),
    );
}

echo 'total_gl_accounts='.GlAccount::query()->count().PHP_EOL;
