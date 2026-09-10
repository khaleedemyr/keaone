<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ProductUnit;
use App\Models\StockOpname;
use App\Services\StockOpnameService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StockOpnameController extends Controller
{
    public function __construct(private StockOpnameService $opnames) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockopnames', 'view');

        $query = StockOpname::query()
            ->with(['warehouse:id,name', 'user:id,name'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($search = $request->string('search')->toString()) {
            $query->where('number', 'like', "%{$search}%");
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (StockOpname $row) => $this->opnames->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockopnames', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'warehouse_id' => ['required', 'integer'],
            'note' => ['nullable', 'string'],
            'counted_at' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.counted_qty' => ['required', 'integer', 'min:0'],
            'items.*.unit_level' => ['nullable', Rule::in(ProductUnit::LEVELS)],
        ]);

        $row = $this->opnames->create($data, $request->user());

        return $this->ok($this->opnames->serialize($row), [], 201);
    }

    public function show(StockOpname $stockOpname): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockopnames', 'view');

        return $this->ok($this->opnames->serialize($stockOpname));
    }

    public function update(Request $request, StockOpname $stockOpname): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockopnames', 'edit');

        $data = $request->validate([
            'warehouse_id' => ['sometimes', 'integer'],
            'note' => ['nullable', 'string'],
            'counted_at' => ['nullable', 'date'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.counted_qty' => ['required_with:items', 'integer', 'min:0'],
            'items.*.unit_level' => ['nullable', Rule::in(ProductUnit::LEVELS)],
        ]);

        return $this->ok($this->opnames->serialize($this->opnames->update($stockOpname, $data)));
    }

    public function confirm(StockOpname $stockOpname): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockopnames', 'edit');

        return $this->ok($this->opnames->serialize($this->opnames->confirm($stockOpname)));
    }

    public function cancel(StockOpname $stockOpname): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCanAny([['stockopnames', 'edit'], ['stockopnames', 'delete']]);

        return $this->ok($this->opnames->serialize($this->opnames->cancel($stockOpname)));
    }
}
