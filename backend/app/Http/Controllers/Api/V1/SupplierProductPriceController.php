<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SupplierProductPrice;
use App\Services\SupplierProductPriceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierProductPriceController extends Controller
{
    public function __construct(private SupplierProductPriceService $prices) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('supplierpricelists', 'view');
        $this->prices->assertEnabled();

        $query = SupplierProductPrice::query()
            ->with(['supplier:id,name', 'product:id,name,sku'])
            ->orderByDesc('id');

        if ($supplierId = $request->integer('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($productId = $request->integer('product_id')) {
            $query->where('product_id', $productId);
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        } else {
            $query->where('is_active', true);
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%"))
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (SupplierProductPrice $row) => $this->prices->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('supplierpricelists', 'create');
        $this->prices->assertEnabled();

        $data = $request->validate([
            'supplier_id' => ['required', 'integer'],
            'product_id' => ['required', 'integer'],
            'unit_cost' => ['required', 'integer', 'min:0'],
            'unit' => ['nullable', 'string', 'max:40'],
            'unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'min_qty' => ['nullable', 'integer', 'min:1'],
            'valid_from' => ['nullable', 'date'],
            'valid_to' => ['nullable', 'date', 'after_or_equal:valid_from'],
            'note' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = $this->prices->create($data);

        return $this->ok($this->prices->serialize($row), [], 201);
    }

    public function show(SupplierProductPrice $supplierProductPrice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('supplierpricelists', 'view');
        $this->prices->assertEnabled();

        return $this->ok($this->prices->serialize($supplierProductPrice));
    }

    public function update(Request $request, SupplierProductPrice $supplierProductPrice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('supplierpricelists', 'edit');
        $this->prices->assertEnabled();

        $data = $request->validate([
            'supplier_id' => ['sometimes', 'integer'],
            'product_id' => ['sometimes', 'integer'],
            'unit_cost' => ['sometimes', 'integer', 'min:0'],
            'unit' => ['nullable', 'string', 'max:40'],
            'unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'min_qty' => ['nullable', 'integer', 'min:1'],
            'valid_from' => ['nullable', 'date'],
            'valid_to' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = $this->prices->update($supplierProductPrice, $data);

        return $this->ok($this->prices->serialize($row));
    }

    public function destroy(SupplierProductPrice $supplierProductPrice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('supplierpricelists', 'delete');
        $this->prices->assertEnabled();

        $this->prices->delete($supplierProductPrice);

        return $this->ok(['deleted' => true]);
    }

    public function lookup(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([
            ['supplierpricelists', 'view'],
            ['purchaseorders', 'create'],
            ['purchaseorders', 'edit'],
        ]);

        $data = $request->validate([
            'supplier_id' => ['required', 'integer'],
            'product_id' => ['required', 'integer'],
            'unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'unit' => ['nullable', 'string', 'max:40'],
        ]);

        $unitCost = $this->prices->resolveUnitCost(
            (int) $data['supplier_id'],
            (int) $data['product_id'],
            $data['unit_level'] ?? null,
            $data['unit'] ?? null,
        );

        return $this->ok([
            'unit_cost' => $unitCost,
            'from_price_list' => $unitCost !== null,
        ]);
    }
}
