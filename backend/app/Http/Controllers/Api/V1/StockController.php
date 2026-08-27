<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Warehouse;
use App\Services\InventoryService;
use App\Services\ProductUnitService;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockController extends Controller
{
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stock', 'view');

        $warehouseId = $this->resolveWarehouseId($request);
        $warehouse = Warehouse::query()->findOrFail($warehouseId);

        $rows = Product::query()
            ->where('track_stock', true)
            ->where('is_active', true)
            ->with(['productUnits.unitMaster', 'unitMaster'])
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product) => $this->serializeStockRow($product, $warehouseId, $warehouse, true));

        return $this->ok($rows);
    }

    public function low(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stock', 'view');

        $warehouseId = $this->resolveWarehouseId($request);
        $warehouse = Warehouse::query()->findOrFail($warehouseId);

        $rows = Product::query()
            ->where('track_stock', true)
            ->where('is_active', true)
            ->with(['productUnits.unitMaster', 'unitMaster'])
            ->get()
            ->map(fn (Product $product) => $this->serializeStockRow($product, $warehouseId, $warehouse, false))
            ->filter(fn (array $row) => $row['qty'] <= $row['min_stock'])
            ->values();

        return $this->ok($rows);
    }

    public function movements(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCanAny(['stock', 'stockcard']);

        $data = $request->validate([
            'product_id' => ['required', 'integer'],
            'warehouse_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $product = Product::query()
            ->with(['productUnits.unitMaster', 'unitMaster'])
            ->findOrFail($data['product_id']);
        $warehouseId = $this->resolveWarehouseId($request);
        $warehouse = Warehouse::query()->findOrFail($warehouseId);
        $units = $this->productUnits->serialize($product);
        $qty = $this->inventory->qtyAtWarehouse($warehouseId, $product->id);

        $query = StockMovement::query()
            ->with(['warehouse:id,name'])
            ->where('product_id', $product->id)
            ->where('warehouse_id', $warehouseId)
            ->orderByDesc('id');

        if (! empty($data['from'])) {
            $query->whereDate('created_at', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $query->whereDate('created_at', '<=', $data['to']);
        }

        $page = $query->paginate($this->perPage($request, 50));

        $rows = $page->getCollection()->map(fn (StockMovement $m) => [
            'id' => $m->id,
            'created_at' => $m->created_at?->toIso8601String(),
            'type' => $m->type,
            'qty_change' => $m->qty_change,
            'qty_after' => $m->qty_after,
            'qty_change_display' => $this->productUnits->formatQtyBreakdown((int) $m->qty_change, $units),
            'qty_after_display' => $this->productUnits->formatQtyBreakdown((int) $m->qty_after, $units),
            'qty_input' => $m->qty_input,
            'unit_level' => $m->unit_level,
            'unit' => $m->unit,
            'factor_to_base' => $m->factor_to_base,
            'ref_type' => $m->ref_type,
            'ref_id' => $m->ref_id,
            'note' => $m->note,
            'warehouse_id' => $m->warehouse_id,
            'warehouse_name' => $m->warehouse?->name ?? $warehouse->name,
        ]);

        return $this->ok([
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'unit' => $product->unit,
                'units' => $units,
                'min_stock' => $product->min_stock,
            ],
            'warehouse' => [
                'id' => $warehouse->id,
                'name' => $warehouse->name,
            ],
            'qty' => $qty,
            'qty_display' => $this->productUnits->formatQtyBreakdown($qty, $units),
            'movements' => $rows->values(),
        ], $this->pageMeta($page));
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeStockRow(Product $product, int $warehouseId, Warehouse $warehouse, bool $withBarcode): array
    {
        $qty = (int) StockBalance::query()
            ->where('warehouse_id', $warehouseId)
            ->where('product_id', $product->id)
            ->value('qty');
        $units = $this->productUnits->serialize($product);

        $row = [
            'product_id' => $product->id,
            'name' => $product->name,
            'sku' => $product->sku,
            'qty' => $qty,
            'qty_display' => $this->productUnits->formatQtyBreakdown($qty, $units),
            'min_stock' => $product->min_stock,
            'unit' => $product->unit,
            'units' => $units,
            'warehouse_id' => $warehouse->id,
            'warehouse_name' => $warehouse->name,
        ];

        if ($withBarcode) {
            $row['barcode'] = $product->barcode;
        }

        return $row;
    }

    private function resolveWarehouseId(Request $request): int
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        if ($request->filled('warehouse_id')) {
            $warehouse = Warehouse::query()
                ->whereKey((int) $request->integer('warehouse_id'))
                ->where('is_active', true)
                ->firstOrFail();

            return (int) $warehouse->id;
        }

        $outlet = CurrentCompany::outlet();
        abort_unless($outlet, 422, 'Outlet belum dipilih.');

        return (int) $this->inventory->resolveDefaultWarehouse((int) $company->id, (int) $outlet->id)->id;
    }
}
