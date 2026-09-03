<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StockProduction;
use App\Services\StockProductionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockProductionController extends Controller
{
    public function __construct(private StockProductionService $productions) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockproduction', 'view');

        $query = StockProduction::query()
            ->with(['warehouse:id,name', 'user:id,name', 'product:id,name,sku'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('product_name_snapshot', 'like', "%{$search}%")
                    ->orWhere('lot_code', 'like', "%{$search}%");
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (StockProduction $row) => $this->productions->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function preview(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCanAny([['stockproduction', 'view'], ['stockproduction', 'create']]);

        $data = $request->validate([
            'product_id' => ['required', 'integer'],
            'qty' => ['required', 'integer', 'min:1'],
        ]);

        return $this->ok($this->productions->preview((int) $data['product_id'], (int) $data['qty']));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockproduction', 'create');
        $this->ensureBilling();

        $rules = [
            'client_uuid' => ['required', 'uuid'],
            'warehouse_id' => ['required', 'integer'],
            'product_id' => ['required', 'integer'],
            'qty' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string'],
        ];

        if ($this->productions->manufacturingEnabled()) {
            $rules['scrap_qty'] = ['nullable', 'integer', 'min:0'];
            $rules['lot_code'] = ['nullable', 'string', 'max:64'];
            $rules['track_serial'] = ['nullable', 'boolean'];
            $rules['items'] = ['nullable', 'array'];
            $rules['items.*.product_id'] = ['required_with:items', 'integer'];
            $rules['items.*.qty_actual'] = ['nullable', 'integer', 'min:0'];
            $rules['steps'] = ['nullable', 'array'];
            $rules['steps.*.name'] = ['required_with:steps', 'string', 'max:120'];
            $rules['steps.*.sort_order'] = ['nullable', 'integer', 'min:0'];
            $rules['steps.*.status'] = ['nullable', 'in:pending,done'];
        }

        $data = $request->validate($rules);
        $row = $this->productions->create($data, $request->user());

        return $this->ok($this->productions->serialize($row), [], 201);
    }

    public function show(StockProduction $stockProduction): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockproduction', 'view');

        return $this->ok($this->productions->serialize($stockProduction));
    }

    public function update(Request $request, StockProduction $stockProduction): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockproduction', 'edit');

        $rules = [
            'warehouse_id' => ['sometimes', 'integer'],
            'product_id' => ['sometimes', 'integer'],
            'qty' => ['sometimes', 'integer', 'min:1'],
            'note' => ['nullable', 'string'],
        ];

        if ($this->productions->manufacturingEnabled()) {
            $rules['scrap_qty'] = ['nullable', 'integer', 'min:0'];
            $rules['lot_code'] = ['nullable', 'string', 'max:64'];
            $rules['track_serial'] = ['nullable', 'boolean'];
            $rules['items'] = ['nullable', 'array'];
            $rules['items.*.product_id'] = ['required_with:items', 'integer'];
            $rules['items.*.qty_actual'] = ['nullable', 'integer', 'min:0'];
            $rules['steps'] = ['nullable', 'array'];
            $rules['steps.*.name'] = ['required_with:steps', 'string', 'max:120'];
            $rules['steps.*.sort_order'] = ['nullable', 'integer', 'min:0'];
            $rules['steps.*.status'] = ['nullable', 'in:pending,done'];
        }

        $data = $request->validate($rules);

        return $this->ok($this->productions->serialize($this->productions->update($stockProduction, $data)));
    }

    public function confirm(Request $request, StockProduction $stockProduction): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockproduction', 'edit');

        $data = $request->validate([
            'serials' => ['nullable', 'array'],
            'serials.*' => ['required', 'string', 'max:120'],
        ]);

        return $this->ok($this->productions->serialize($this->productions->confirm($stockProduction, $data)));
    }

    public function completeStep(Request $request, StockProduction $stockProduction, int $step): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockproduction', 'edit');

        $data = $request->validate([
            'note' => ['nullable', 'string'],
        ]);

        return $this->ok($this->productions->serialize(
            $this->productions->completeStep($stockProduction, $step, $data['note'] ?? null),
        ));
    }

    public function void(Request $request, StockProduction $stockProduction): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockproduction', 'edit');
        $this->ensureBilling();

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        return $this->ok($this->productions->serialize(
            $this->productions->void($stockProduction, $request->user(), $data['reason'] ?? null),
        ));
    }

    public function cancel(StockProduction $stockProduction): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCanAny([['stockproduction', 'edit'], ['stockproduction', 'delete']]);

        return $this->ok($this->productions->serialize($this->productions->cancel($stockProduction)));
    }
}
