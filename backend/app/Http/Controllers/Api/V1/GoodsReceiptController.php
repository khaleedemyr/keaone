<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceipt;
use App\Services\PurchaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GoodsReceiptController extends Controller
{
    public function __construct(private PurchaseService $purchases) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('goodsreceipts', 'view');

        $query = GoodsReceipt::query()
            ->with(['supplier:id,name', 'warehouse:id,name', 'user:id,name', 'purchaseOrder:id,number'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($request->boolean('direct_only')) {
            $query->whereNull('purchase_order_id');
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (GoodsReceipt $gr) => $this->purchases->serializeGr($gr))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('goodsreceipts', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'supplier_id' => ['nullable', 'integer'],
            'purchase_order_id' => ['nullable', 'integer'],
            'warehouse_id' => ['nullable', 'integer'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'items.*.purchase_order_item_id' => ['nullable', 'integer'],
        ]);

        $gr = $this->purchases->createReceipt($data, $request->user());

        return $this->ok($this->purchases->serializeGr($gr), [], 201);
    }

    public function show(GoodsReceipt $goodsReceipt): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('goodsreceipts', 'view');

        return $this->ok($this->purchases->serializeGr($goodsReceipt));
    }

    public function update(Request $request, GoodsReceipt $goodsReceipt): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('goodsreceipts', 'edit');

        $data = $request->validate([
            'supplier_id' => ['nullable', 'integer'],
            'warehouse_id' => ['nullable', 'integer'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'items.*.purchase_order_item_id' => ['nullable', 'integer'],
        ]);

        $gr = $this->purchases->updateReceipt($goodsReceipt, $data);

        return $this->ok($this->purchases->serializeGr($gr));
    }

    public function confirm(GoodsReceipt $goodsReceipt): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('goodsreceipts', 'edit');

        return $this->ok($this->purchases->serializeGr($this->purchases->confirmReceipt($goodsReceipt)));
    }

    public function cancel(GoodsReceipt $goodsReceipt): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['goodsreceipts', 'edit'], ['goodsreceipts', 'delete']]);

        return $this->ok($this->purchases->serializeGr($this->purchases->cancelReceipt($goodsReceipt)));
    }
}
