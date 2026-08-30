<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\VendorAdjustmentNote;
use App\Services\VendorAdjustmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorAdjustmentNoteController extends Controller
{
    public function __construct(private VendorAdjustmentService $adjustments) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendoradjustmentnotes', 'view');

        $query = VendorAdjustmentNote::query()
            ->with(['supplier:id,name', 'user:id,name', 'goodsReceipt:id,number'])
            ->orderByDesc('id');

        if ($type = $request->string('type')->toString()) {
            if (in_array($type, ['debit', 'credit'], true)) {
                $query->where('type', $type);
            }
        }
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
            $page->getCollection()->map(fn (VendorAdjustmentNote $row) => $this->adjustments->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendoradjustmentnotes', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'type' => ['required', 'in:debit,credit'],
            'supplier_id' => ['required', 'integer'],
            'goods_receipt_id' => ['nullable', 'integer'],
            'purchase_order_id' => ['nullable', 'integer'],
            'reason' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['nullable', 'integer', 'min:1'],
            'items.*.unit_cost_before' => ['nullable', 'integer', 'min:0'],
            'items.*.unit_cost_after' => ['nullable', 'integer', 'min:0'],
            'items.*.adjustment_amount' => ['nullable', 'integer', 'min:1'],
            'items.*.goods_receipt_item_id' => ['nullable', 'integer'],
            'items.*.note' => ['nullable', 'string'],
        ]);

        $row = $this->adjustments->create($data, $request->user());

        return $this->ok($this->adjustments->serialize($row), [], 201);
    }

    public function show(VendorAdjustmentNote $vendorAdjustmentNote): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendoradjustmentnotes', 'view');

        return $this->ok($this->adjustments->serialize($vendorAdjustmentNote));
    }

    public function update(Request $request, VendorAdjustmentNote $vendorAdjustmentNote): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendoradjustmentnotes', 'edit');

        $data = $request->validate([
            'type' => ['sometimes', 'in:debit,credit'],
            'supplier_id' => ['sometimes', 'integer'],
            'goods_receipt_id' => ['nullable', 'integer'],
            'purchase_order_id' => ['nullable', 'integer'],
            'reason' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['nullable', 'integer', 'min:1'],
            'items.*.unit_cost_before' => ['nullable', 'integer', 'min:0'],
            'items.*.unit_cost_after' => ['nullable', 'integer', 'min:0'],
            'items.*.adjustment_amount' => ['nullable', 'integer', 'min:1'],
            'items.*.goods_receipt_item_id' => ['nullable', 'integer'],
            'items.*.note' => ['nullable', 'string'],
        ]);

        $row = $this->adjustments->update($vendorAdjustmentNote, $data);

        return $this->ok($this->adjustments->serialize($row));
    }

    public function confirm(VendorAdjustmentNote $vendorAdjustmentNote): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendoradjustmentnotes', 'edit');

        return $this->ok($this->adjustments->serialize($this->adjustments->confirm($vendorAdjustmentNote)));
    }

    public function cancel(VendorAdjustmentNote $vendorAdjustmentNote): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['vendoradjustmentnotes', 'edit'], ['vendoradjustmentnotes', 'delete']]);

        return $this->ok($this->adjustments->serialize($this->adjustments->cancel($vendorAdjustmentNote)));
    }
}
