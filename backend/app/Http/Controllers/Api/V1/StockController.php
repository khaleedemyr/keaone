<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Warehouse;
use App\Services\InventoryService;
use App\Services\ProductUnitService;
use App\Services\StockReportService;
use App\Support\CurrentCompany;
use App\Support\InventorySettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockController extends Controller
{
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
        private StockReportService $reports,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->paginatedStock($request, false);
    }

    public function low(Request $request): JsonResponse
    {
        return $this->paginatedStock($request, true);
    }

    public function over(Request $request): JsonResponse
    {
        return $this->paginatedStock($request, false, true);
    }

    public function valuation(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockvaluation', 'view');

        $data = $request->validate([
            'warehouse_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
        ]);

        return $this->ok($this->reports->valuation(
            isset($data['warehouse_id']) ? (int) $data['warehouse_id'] : null,
            isset($data['category_id']) ? (int) $data['category_id'] : null,
        ));
    }

    public function mutations(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockvaluation', 'view');

        $data = $request->validate([
            'warehouse_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return $this->ok($this->reports->mutations(
            isset($data['warehouse_id']) ? (int) $data['warehouse_id'] : null,
            $data['from'] ?? null,
            $data['to'] ?? null,
        ));
    }

    public function reorderSuggestions(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stock', 'view');

        $data = $request->validate([
            'warehouse_id' => ['nullable', 'integer'],
        ]);

        return $this->ok($this->reports->reorderSuggestions(
            isset($data['warehouse_id']) ? (int) $data['warehouse_id'] : null,
        )->values());
    }

    public function createReorderPr(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stock', 'view');
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'warehouse_id' => ['nullable', 'integer'],
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['nullable', 'integer', 'min:1'],
        ]);

        $pr = $this->reports->createReorderPr(
            $request->user(),
            isset($data['warehouse_id']) ? (int) $data['warehouse_id'] : null,
            $data['items'] ?? null,
        );

        return $this->ok([
            'id' => $pr->id,
            'number' => $pr->number,
            'status' => $pr->status,
        ], [], 201);
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
        $balance = StockBalance::query()
            ->where('warehouse_id', $warehouseId)
            ->where('product_id', $product->id)
            ->first();
        $company = CurrentCompany::company();
        $method = InventorySettings::method($company);
        $unitCost = (int) ($balance?->avg_cost ?: $product->cost_price);
        $costValue = (int) ($balance?->cost_value ?? ($qty * $unitCost));

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
            'unit_cost' => (int) $m->unit_cost,
            'cost_amount' => (int) $m->cost_amount,
            'costing_method' => $m->costing_method,
        ]);

        return $this->ok([
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'barcode' => $product->barcode,
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
            'unit_cost' => $unitCost,
            'cost_value' => $costValue,
            'costing_method' => $method,
            'movements' => $rows->values(),
        ], $this->pageMeta($page));
    }

    private function paginatedStock(Request $request, bool $lowOnly, bool $overOnly = false): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stock', 'view');

        $warehouseId = $this->resolveWarehouseId($request);
        $warehouse = Warehouse::query()->findOrFail($warehouseId);

        $query = $this->stockProductQuery($request, $warehouseId, $lowOnly, $overOnly);
        $page = $query
            ->with(['productUnits.unitMaster', 'unitMaster'])
            ->paginate($this->perPage($request, 50));

        $rows = $page->getCollection()->map(function (Product $product) use ($warehouseId, $warehouse) {
            $qty = (int) ($product->stock_qty ?? 0);

            return $this->serializeStockRow($product, $warehouseId, $warehouse, true, $qty);
        });

        return $this->ok($rows->values(), $this->pageMeta($page));
    }

    /**
     * @return Builder<Product>
     */
    private function stockProductQuery(Request $request, int $warehouseId, bool $lowOnly, bool $overOnly = false): Builder
    {
        $query = Product::query()
            ->where('products.track_stock', true)
            ->where('products.is_active', true)
            ->leftJoin('stock_balances', function ($join) use ($warehouseId) {
                $join->on('products.id', '=', 'stock_balances.product_id')
                    ->where('stock_balances.warehouse_id', '=', $warehouseId);
            })
            ->select(
                'products.*',
                DB::raw('COALESCE(stock_balances.qty, 0) as stock_qty'),
                DB::raw('COALESCE(stock_balances.avg_cost, products.cost_price, 0) as stock_avg_cost'),
                DB::raw('COALESCE(stock_balances.cost_value, 0) as stock_cost_value'),
            );

        if ($lowOnly) {
            $query->whereRaw('COALESCE(stock_balances.qty, 0) <= products.min_stock');
        }
        if ($overOnly) {
            $query->where('products.max_stock', '>', 0)
                ->whereRaw('COALESCE(stock_balances.qty, 0) > products.max_stock');
        }

        if ($search = trim($request->string('search')->toString())) {
            $query->where(function ($q) use ($search) {
                $q->where('products.name', 'like', "%{$search}%")
                    ->orWhere('products.sku', 'like', "%{$search}%")
                    ->orWhere('products.barcode', 'like', "%{$search}%");
            });
        }

        return $query->orderBy('products.name');
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeStockRow(Product $product, int $warehouseId, Warehouse $warehouse, bool $withBarcode, ?int $qty = null): array
    {
        $qty ??= (int) StockBalance::query()
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
            'max_stock' => (int) ($product->max_stock ?? 0),
            'reorder_qty' => (int) ($product->reorder_qty ?? 0),
            'unit' => $product->unit,
            'units' => $units,
            'warehouse_id' => $warehouse->id,
            'warehouse_name' => $warehouse->name,
            'unit_cost' => (int) ($product->stock_avg_cost ?? $product->cost_price ?? 0),
            'cost_value' => (int) ($product->stock_cost_value ?? 0),
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
