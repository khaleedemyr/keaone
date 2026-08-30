<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AutoReorderService;
use App\Services\DemandPlanningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcurementPlanningController extends Controller
{
    public function __construct(
        private AutoReorderService $autoReorder,
        private DemandPlanningService $demandPlanning,
    ) {}

    public function autoReorderPreview(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('procurementdashboard', 'view');

        $rows = $this->autoReorder->preview(
            $request->filled('warehouse_id') ? $request->integer('warehouse_id') : null,
        );

        return $this->ok($rows->values());
    }

    public function autoReorderRun(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'create');

        $data = $request->validate([
            'warehouse_id' => ['nullable', 'integer'],
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['nullable', 'integer', 'min:1'],
        ]);

        $pr = $this->autoReorder->run(
            $request->user(),
            $data['warehouse_id'] ?? null,
            $data['items'] ?? null,
        );

        return $this->ok([
            'purchase_requisition_id' => $pr->id,
            'number' => $pr->number,
        ], [], 201);
    }

    public function demandForecasts(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('procurementdashboard', 'view');

        $rows = $this->demandPlanning->listForecasts(
            $request->filled('warehouse_id') ? $request->integer('warehouse_id') : null,
        );

        return $this->ok($rows->values());
    }

    public function demandGenerate(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'create');

        $data = $request->validate([
            'warehouse_id' => ['nullable', 'integer'],
            'months_ahead' => ['nullable', 'integer', 'min:1', 'max:6'],
        ]);

        $rows = $this->demandPlanning->generate(
            $data['warehouse_id'] ?? null,
            $data['months_ahead'] ?? null,
        );

        return $this->ok($rows->map(fn ($row) => [
            'id' => $row->id,
            'product_id' => $row->product_id,
            'warehouse_id' => $row->warehouse_id,
            'period_year' => $row->period_year,
            'period_month' => $row->period_month,
            'forecast_qty' => $row->forecast_qty,
        ])->values(), [], 201);
    }

    public function demandSuggestPr(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'create');

        $data = $request->validate([
            'warehouse_id' => ['nullable', 'integer'],
            'forecast_ids' => ['nullable', 'array'],
            'forecast_ids.*' => ['integer'],
        ]);

        $pr = $this->demandPlanning->suggestPr(
            $request->user(),
            $data['warehouse_id'] ?? null,
            $data['forecast_ids'] ?? null,
        );

        return $this->ok([
            'purchase_requisition_id' => $pr->id,
            'number' => $pr->number,
        ], [], 201);
    }
}
