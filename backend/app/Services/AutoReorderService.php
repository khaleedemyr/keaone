<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Product;
use App\Models\PurchaseRequisition;
use App\Models\StockBalance;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AutoReorderService
{
    public function __construct(
        private PurchaseService $purchases,
        private InventoryService $inventory,
    ) {}

    public function enabled(?Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_auto_reorder_enabled', $company);
    }

    public function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'auto_reorder' => ['Auto-reorder belum diaktifkan di pengaturan procurement.'],
            ]);
        }
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function preview(?int $warehouseId = null): Collection
    {
        $this->assertEnabled();
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        if ($this->purchases->purchaseFlow($company) !== 'strict_pr_po_gr') {
            throw ValidationException::withMessages([
                'purchase_flow' => ['Auto-reorder hanya tersedia pada mode PR → PO → GR.'],
            ]);
        }

        $warehouseId ??= $this->inventory->resolveDefaultWarehouse($company->id, CurrentCompany::outlet()?->id)->id;

        return $this->lowStockCandidates($company->id, $warehouseId);
    }

    /**
     * @param  array<int, array{product_id: int, qty?: int}>|null  $selection
     */
    public function run(User $user, ?int $warehouseId = null, ?array $selection = null): PurchaseRequisition
    {
        $candidates = $this->preview($warehouseId);
        if ($candidates->isEmpty()) {
            throw ValidationException::withMessages(['items' => ['Tidak ada produk di bawah reorder point.']]);
        }

        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');
        $warehouseId ??= (int) $candidates->first()['warehouse_id'];

        $selected = $this->resolveSelection($candidates, $selection);
        if ($selected === []) {
            throw ValidationException::withMessages(['items' => ['Pilih minimal satu produk.']]);
        }

        return $this->purchases->createRequisition([
            'client_uuid' => (string) Str::uuid(),
            'warehouse_id' => $warehouseId,
            'outlet_id' => CurrentCompany::outlet()?->id,
            'note' => 'Auto-reorder '.now()->format('Y-m-d H:i'),
            'items' => $selected,
            'approvals' => [],
        ], $user);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function lowStockCandidates(int $companyId, int $warehouseId): Collection
    {
        $warehouse = Warehouse::query()->whereKey($warehouseId)->firstOrFail();

        return Product::query()
            ->where('company_id', $companyId)
            ->where('track_stock', true)
            ->where('is_active', true)
            ->where('reorder_qty', '>', 0)
            ->whereRaw('COALESCE((SELECT qty FROM stock_balances WHERE stock_balances.product_id = products.id AND stock_balances.warehouse_id = ? LIMIT 1), 0) <= products.min_stock', [$warehouseId])
            ->orderBy('name')
            ->get()
            ->map(function (Product $product) use ($warehouseId, $warehouse) {
                $stockQty = (int) StockBalance::query()
                    ->where('warehouse_id', $warehouseId)
                    ->where('product_id', $product->id)
                    ->value('qty');

                return [
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'stock_qty' => $stockQty,
                    'min_stock' => (int) $product->min_stock,
                    'reorder_qty' => (int) $product->reorder_qty,
                    'suggested_qty' => (int) $product->reorder_qty,
                    'warehouse_id' => $warehouseId,
                    'warehouse_name' => $warehouse->name,
                ];
            });
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $candidates
     * @param  array<int, array{product_id: int, qty?: int}>|null  $selection
     * @return array<int, array{product_id: int, qty: int}>
     */
    private function resolveSelection(Collection $candidates, ?array $selection): array
    {
        if ($selection === null || $selection === []) {
            return $candidates->map(fn (array $row) => [
                'product_id' => (int) $row['product_id'],
                'qty' => (int) $row['suggested_qty'],
            ])->all();
        }

        $byProduct = $candidates->keyBy('product_id');
        $items = [];

        foreach ($selection as $row) {
            $productId = (int) ($row['product_id'] ?? 0);
            if (! $byProduct->has($productId)) {
                continue;
            }
            $qty = (int) ($row['qty'] ?? $byProduct[$productId]['suggested_qty']);
            if ($qty < 1) {
                continue;
            }
            $items[] = ['product_id' => $productId, 'qty' => $qty];
        }

        return $items;
    }
}
