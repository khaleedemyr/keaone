<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Plan;
use App\Services\BillingService;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BillingController extends Controller
{
    public function __construct(private BillingService $billing) {}

    public function show(): JsonResponse
    {
        $this->ensureCan('billing', 'view');

        $company = CurrentCompany::company();
        $subscription = $company?->subscription;
        if ($subscription) {
            $this->billing->refresh($subscription);
        }

        $invoices = Invoice::query()
            ->where('company_id', $company?->id)
            ->with('plan')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (Invoice $invoice) => $this->billing->serializeInvoice($invoice));

        return $this->ok([
            'billing' => $this->billing->snapshot($company),
            'invoices' => $invoices,
            'plans' => Plan::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get()
                ->map(fn (Plan $plan) => $this->billing->serializePlan($plan)),
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $this->ensureCan('billing', 'edit');

        $data = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            'billing_cycle' => ['required', Rule::in(['monthly', 'yearly'])],
        ]);

        $plan = Plan::query()->where('is_active', true)->findOrFail($data['plan_id']);
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Tidak terhubung ke perusahaan.');

        $this->billing->subscribe($company, $plan, $data['billing_cycle']);

        return $this->ok($this->billing->snapshot($company->fresh()));
    }
}
