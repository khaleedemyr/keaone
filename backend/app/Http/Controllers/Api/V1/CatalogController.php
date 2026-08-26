<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BusinessType;
use App\Models\Plan;
use App\Services\BillingService;
use Illuminate\Http\JsonResponse;

class CatalogController extends Controller
{
    public function __construct(private BillingService $billing) {}

    public function show(): JsonResponse
    {
        $types = BusinessType::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['slug', 'name']);

        $plans = Plan::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('price_monthly')
            ->get()
            ->map(fn (Plan $plan) => $this->billing->serializePlan($plan));

        return $this->ok([
            'business_types' => $types,
            'plans' => $plans,
        ]);
    }
}
