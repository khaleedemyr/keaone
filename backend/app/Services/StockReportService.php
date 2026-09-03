<?php

namespace App\Services;

use App\Models\Product;
use App\Models\PurchaseRequisition;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockReportService
{
    public function __construct(
        private InventoryService $inventory,
        private PurchaseService $purchases,
    ) {}

    /**
     * @return array{rows: list<array<string, mixed>>, totals: array{qty: int, cost_value: int}, method: string}
     */
    public function valuation(?int $warehouseId = null, ?int $categoryId = null): array
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        $query = StockBalance::query()
            ->withoutGlobalScopes()
            ->where('stock_balances.company_id', $company->id)
            ->join('products', 'products.id', '=', 'stock_balances.product_id')
            ->join('warehouses', 'warehouses.id', '=', 'stock_balances.warehouse_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->whereNull('products.deleted_at')
            ->where('products.track_stock', true)
            ->where('products.is_active', true)
            ->where('warehouses.is_active', true)
            ->select([
                'stock_balances.warehouse_id',
                'warehouses.name as warehouse_name',
                'stock_balances.product_id',
                'products.name as product_name',
                'products.sku',
                'products.unit',
                'products.category_id',
                'categories.name as category_name',
                'stock_balances.qty',
                'stock_balances.avg_cost',
                'stock_balances.cost_value',
                'products.cost_price',
            ])
            ->orderBy('warehouses.name')
            ->orderBy('products.name');

        if ($warehouseId) {
            $query->where('stock_balances.warehouse_id', $warehouseId);
        }
        if ($categoryId) {
            $query->where('products.category_id', $categoryId);
        }

        $rows = $query->get()->map(function ($row) {
            $qty = (int) $row->qty;
            $unitCost = (int) ($row->avg_cost ?: $row->cost_price ?: 0);
            $costValue = (int) ($row->cost_value ?: ($qty * $unitCost));

            return [
                'warehouse_id' => (int) $row->warehouse_id,
                'warehouse_name' => (string) $row->warehouse_name,
                'product_id' => (int) $row->product_id,
                'product_name' => (string) $row->product_name,
                'sku' => $row->sku,
                'unit' => (string) $row->unit,
                'category_id' => $row->category_id ? (int) $row->category_id : null,
                'category_name' => $row->category_name,
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'cost_value' => $costValue,
            ];
        })->values()->all();

        $totals = [
            'qty' => array_sum(array_column($rows, 'qty')),
            'cost_value' => array_sum(array_column($rows, 'cost_value')),
        ];

        return [
            'rows' => $rows,
            'totals' => $totals,
            'method' => \App\Support\InventorySettings::method($company),
        ];
    }

    /**
     * @return array{rows: list<array<string, mixed>>, totals: array{qty_in: int, qty_out: int, cost_in: int, cost_out: int}}
     */
    public function mutations(?int $warehouseId, ?string $from, ?string $to): array
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        $query = StockMovement::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->selectRaw('type, SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END) as qty_in')
            ->selectRaw('SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END) as qty_out')
            ->selectRaw('SUM(CASE WHEN qty_change > 0 THEN cost_amount ELSE 0 END) as cost_in')
            ->selectRaw('SUM(CASE WHEN qty_change < 0 THEN cost_amount ELSE 0 END) as cost_out')
            ->groupBy('type')
            ->orderBy('type');

        if ($warehouseId) {
            $query->where('warehouse_id', $warehouseId);
        }
        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }

        $rows = $query->get()->map(fn ($row) => [
            'type' => (string) $row->type,
            'qty_in' => (int) $row->qty_in,
            'qty_out' => (int) $row->qty_out,
            'cost_in' => (int) $row->cost_in,
            'cost_out' => (int) $row->cost_out,
        ])->values()->all();

        return [
            'rows' => $rows,
            'totals' => [
                'qty_in' => array_sum(array_column($rows, 'qty_in')),
                'qty_out' => array_sum(array_column($rows, 'qty_out')),
                'cost_in' => array_sum(array_column($rows, 'cost_in')),
                'cost_out' => array_sum(array_column($rows, 'cost_out')),
            ],
        ];
    }

    /**
     * Low-stock suggestions for inventory UI (does not require procurement auto-reorder flag).
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function reorderSuggestions(?int $warehouseId = null): Collection
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        if (! $warehouseId) {
            $outletId = CurrentCompany::outlet()?->id;
            if ($outletId) {
                $warehouseId = $this->inventory->resolveDefaultWarehouse($company->id, (int) $outletId)->id;
            } else {
                $warehouseId = (int) Warehouse::query()
                    ->withoutGlobalScopes()
                    ->where('company_id', $company->id)
                    ->where('is_active', true)
                    ->orderByDesc('is_default')
                    ->orderBy('id')
                    ->value('id');
            }
        }
        abort_unless($warehouseId, 422, 'Gudang belum tersedia.');

        $warehouse = Warehouse::query()->withoutGlobalScopes()->whereKey($warehouseId)->firstOrFail();

        return Product::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('track_stock', true)
            ->where('is_active', true)
            ->whereRaw(
                'COALESCE((SELECT qty FROM stock_balances WHERE stock_balances.product_id = products.id AND stock_balances.warehouse_id = ? LIMIT 1), 0) <= products.min_stock',
                [$warehouseId],
            )
            ->orderBy('name')
            ->get()
            ->map(function (Product $product) use ($warehouseId, $warehouse) {
                $stockQty = (int) StockBalance::query()
                    ->withoutGlobalScopes()
                    ->where('warehouse_id', $warehouseId)
                    ->where('product_id', $product->id)
                    ->value('qty');
                $min = (int) $product->min_stock;
                $reorder = (int) ($product->reorder_qty ?? 0);
                $gap = max(0, $min - $stockQty);
                $suggested = $reorder > 0 ? $reorder : max(1, $gap);

                return [
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'stock_qty' => $stockQty,
                    'min_stock' => $min,
                    'max_stock' => (int) ($product->max_stock ?? 0),
                    'reorder_qty' => $reorder,
                    'suggested_qty' => $suggested,
                    'warehouse_id' => $warehouseId,
                    'warehouse_name' => $warehouse->name,
                ];
            });
    }

    /**
     * @param  array<int, array{product_id: int, qty?: int}>|null  $selection
     */
    public function createReorderPr(User $user, ?int $warehouseId = null, ?array $selection = null): PurchaseRequisition
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        if (! CurrentCompany::hasModule('purchase')) {
            throw ValidationException::withMessages([
                'purchase' => ['Modul pengadaan belum aktif.'],
            ]);
        }

        $candidates = $this->reorderSuggestions($warehouseId);
        if ($candidates->isEmpty()) {
            throw ValidationException::withMessages(['items' => ['Tidak ada produk di bawah stok minimum.']]);
        }

        $warehouseId ??= (int) $candidates->first()['warehouse_id'];
        $items = $this->resolveSelection($candidates, $selection);
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Pilih minimal satu produk.']]);
        }

        return $this->purchases->createRequisition([
            'client_uuid' => (string) Str::uuid(),
            'warehouse_id' => $warehouseId,
            'outlet_id' => CurrentCompany::outlet()?->id,
            'note' => 'Saran beli dari Persediaan '.now()->format('Y-m-d H:i'),
            'items' => $items,
            'approvals' => [],
        ], $user);
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $candidates
     * @param  array<int, array{product_id: int, qty?: int}>|null  $selection
     * @return array<int, array{product_id: int, qty: int}>
     */
    private function resolveSelection(Collection $candidates, ?array $selection): array
    {
        if ($selection === null) {
            return $candidates->map(fn (array $row) => [
                'product_id' => (int) $row['product_id'],
                'qty' => (int) $row['suggested_qty'],
            ])->values()->all();
        }

        $byId = $candidates->keyBy('product_id');
        $out = [];
        foreach ($selection as $row) {
            $id = (int) ($row['product_id'] ?? 0);
            $candidate = $byId->get($id);
            if (! $candidate) {
                continue;
            }
            $qty = (int) ($row['qty'] ?? $candidate['suggested_qty']);
            if ($qty < 1) {
                continue;
            }
            $out[] = ['product_id' => $id, 'qty' => $qty];
        }

        return $out;
    }
}
