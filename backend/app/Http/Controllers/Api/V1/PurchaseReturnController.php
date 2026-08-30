<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseReturn;
use App\Services\ProcurementReturnService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseReturnController extends Controller
{
    public function __construct(private ProcurementReturnService $returns) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchasereturns', 'view');

        $query = PurchaseReturn::query()
            ->with(['supplier:id,name', 'warehouse:id,name', 'user:id,name'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (PurchaseReturn $row) => $this->returns->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchasereturns', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'supplier_id' => ['required', 'integer'],
            'warehouse_id' => ['required', 'integer'],
            'goods_receipt_id' => ['nullable', 'integer'],
            'reason' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'items.*.goods_receipt_item_id' => ['nullable', 'integer'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $row = $this->returns->create($data, $request->user());

        return $this->ok($this->returns->serialize($row), [], 201);
    }

    public function show(PurchaseReturn $purchaseReturn): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchasereturns', 'view');

        return $this->ok($this->returns->serialize($purchaseReturn));
    }

    public function update(Request $request, PurchaseReturn $purchaseReturn): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchasereturns', 'edit');

        $data = $request->validate([
            'supplier_id' => ['sometimes', 'integer'],
            'warehouse_id' => ['sometimes', 'integer'],
            'goods_receipt_id' => ['nullable', 'integer'],
            'reason' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $row = $this->returns->update($purchaseReturn, $data);

        return $this->ok($this->returns->serialize($row));
    }

    public function submit(PurchaseReturn $purchaseReturn): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchasereturns', 'edit');

        return $this->ok($this->returns->serialize($this->returns->submit($purchaseReturn)));
    }

    public function approve(PurchaseReturn $purchaseReturn): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchasereturns', 'edit');

        return $this->ok($this->returns->serialize($this->returns->approve($purchaseReturn, request()->user())));
    }

    public function reject(Request $request, PurchaseReturn $purchaseReturn): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchasereturns', 'edit');

        $data = $request->validate(['note' => ['nullable', 'string']]);

        return $this->ok($this->returns->serialize(
            $this->returns->reject($purchaseReturn, $request->user(), $data['note'] ?? null),
        ));
    }

    public function confirm(PurchaseReturn $purchaseReturn): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchasereturns', 'edit');

        return $this->ok($this->returns->serialize($this->returns->confirm($purchaseReturn)));
    }

    public function cancel(PurchaseReturn $purchaseReturn): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['purchasereturns', 'edit'], ['purchasereturns', 'delete']]);

        return $this->ok($this->returns->serialize($this->returns->cancel($purchaseReturn)));
    }
}
