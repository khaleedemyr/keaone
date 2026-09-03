<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StockTransfer;
use App\Services\StockTransferService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockTransferController extends Controller
{
    public function __construct(private StockTransferService $transfers) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stocktransfers', 'view');

        $query = StockTransfer::query()
            ->with(['fromWarehouse:id,name', 'toWarehouse:id,name', 'user:id,name'])
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
            $page->getCollection()->map(fn (StockTransfer $row) => $this->transfers->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stocktransfers', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'from_warehouse_id' => ['required', 'integer'],
            'to_warehouse_id' => ['required', 'integer'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.qty_input' => ['nullable', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.unit_level' => ['nullable', 'string', 'max:20'],
            'items.*.factor_to_base' => ['nullable', 'integer', 'min:1'],
        ]);

        $row = $this->transfers->create($data, $request->user());

        return $this->ok($this->transfers->serialize($row), [], 201);
    }

    public function show(StockTransfer $stockTransfer): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stocktransfers', 'view');

        return $this->ok($this->transfers->serialize($stockTransfer));
    }

    public function update(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stocktransfers', 'edit');

        $data = $request->validate([
            'from_warehouse_id' => ['sometimes', 'integer'],
            'to_warehouse_id' => ['sometimes', 'integer'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.qty_input' => ['nullable', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.unit_level' => ['nullable', 'string', 'max:20'],
            'items.*.factor_to_base' => ['nullable', 'integer', 'min:1'],
        ]);

        return $this->ok($this->transfers->serialize($this->transfers->update($stockTransfer, $data)));
    }

    public function ship(StockTransfer $stockTransfer): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stocktransfers', 'edit');

        return $this->ok($this->transfers->serialize($this->transfers->ship($stockTransfer)));
    }

    public function receive(StockTransfer $stockTransfer): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stocktransfers', 'edit');

        return $this->ok($this->transfers->serialize($this->transfers->receive($stockTransfer)));
    }

    public function cancel(StockTransfer $stockTransfer): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCanAny([['stocktransfers', 'edit'], ['stocktransfers', 'delete']]);

        return $this->ok($this->transfers->serialize($this->transfers->cancel($stockTransfer)));
    }
}
