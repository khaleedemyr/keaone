<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StockAdjustment;
use App\Services\StockAdjustmentService;
use App\Support\InventoryOps;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StockAdjustmentController extends Controller
{
    public function __construct(private StockAdjustmentService $adjustments) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('stock');

        $wasteOnly = $request->boolean('waste_only') || $request->string('reason_group')->toString() === 'waste';
        if ($wasteOnly) {
            $this->ensureCanAny([['stockwaste', 'view'], ['stockadjustments', 'view']]);
        } else {
            $this->ensureCan('stockadjustments', 'view');
        }

        $query = StockAdjustment::query()
            ->with(['warehouse:id,name', 'user:id,name'])
            ->orderByDesc('id');

        if ($wasteOnly) {
            $query->whereIn('reason', InventoryOps::wasteReasons());
        }

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('reason', 'like', "%{$search}%");
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (StockAdjustment $row) => $this->adjustments->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'warehouse_id' => ['required', 'integer'],
            'reason' => ['required', Rule::in(InventoryOps::adjustmentReasons())],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty_change' => ['required', 'integer', 'not_in:0'],
            'items.*.qty_input' => ['nullable', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.unit_level' => ['nullable', 'string', 'max:20'],
            'items.*.factor_to_base' => ['nullable', 'integer', 'min:1'],
        ]);

        if (InventoryOps::isWasteReason((string) $data['reason'])) {
            $this->ensureCanAny([['stockwaste', 'create'], ['stockadjustments', 'create']]);
        } else {
            $this->ensureCan('stockadjustments', 'create');
        }

        $row = $this->adjustments->create($data, $request->user());

        return $this->ok($this->adjustments->serialize($row), [], 201);
    }

    public function show(StockAdjustment $stockAdjustment): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureAdjustmentAccess($stockAdjustment, 'view');

        return $this->ok($this->adjustments->serialize($stockAdjustment));
    }

    public function update(Request $request, StockAdjustment $stockAdjustment): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureAdjustmentAccess($stockAdjustment, 'edit');

        $data = $request->validate([
            'warehouse_id' => ['sometimes', 'integer'],
            'reason' => ['sometimes', Rule::in(InventoryOps::adjustmentReasons())],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty_change' => ['required_with:items', 'integer', 'not_in:0'],
            'items.*.qty_input' => ['nullable', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.unit_level' => ['nullable', 'string', 'max:20'],
            'items.*.factor_to_base' => ['nullable', 'integer', 'min:1'],
        ]);

        if (isset($data['reason']) && InventoryOps::isWasteReason((string) $data['reason'])) {
            $this->ensureCanAny([['stockwaste', 'edit'], ['stockadjustments', 'edit']]);
        }

        return $this->ok($this->adjustments->serialize($this->adjustments->update($stockAdjustment, $data)));
    }

    public function confirm(StockAdjustment $stockAdjustment): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureAdjustmentAccess($stockAdjustment, 'edit');

        return $this->ok($this->adjustments->serialize($this->adjustments->confirm($stockAdjustment)));
    }

    public function cancel(StockAdjustment $stockAdjustment): JsonResponse
    {
        $this->ensureModule('stock');
        if (InventoryOps::isWasteReason((string) $stockAdjustment->reason)) {
            $this->ensureCanAny([
                ['stockwaste', 'edit'],
                ['stockwaste', 'delete'],
                ['stockadjustments', 'edit'],
                ['stockadjustments', 'delete'],
            ]);
        } else {
            $this->ensureCanAny([['stockadjustments', 'edit'], ['stockadjustments', 'delete']]);
        }

        return $this->ok($this->adjustments->serialize($this->adjustments->cancel($stockAdjustment)));
    }

    private function ensureAdjustmentAccess(StockAdjustment $adjustment, string $action): void
    {
        if (InventoryOps::isWasteReason((string) $adjustment->reason)) {
            $this->ensureCanAny([['stockwaste', $action], ['stockadjustments', $action]]);

            return;
        }

        $this->ensureCan('stockadjustments', $action);
    }
}
