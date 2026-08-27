<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Warehouse;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function resolveDefaultWarehouse(int $companyId, int $outletId): Warehouse
    {
        $warehouse = Warehouse::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('outlet_id', $outletId)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->first();

        if ($warehouse) {
            if (! $warehouse->is_default) {
                $this->makeOutletDefault($warehouse);
            }

            return $warehouse->fresh() ?? $warehouse;
        }

        $outlet = Outlet::query()->withoutGlobalScopes()->find($outletId);
        $name = $outlet?->name ? 'Gudang '.$outlet->name : 'Gudang Utama';

        $warehouse = Warehouse::query()->withoutGlobalScopes()->create([
            'company_id' => $companyId,
            'outlet_id' => $outletId,
            'name' => $name,
            'is_default' => true,
            'is_active' => true,
        ]);

        return $warehouse;
    }

    public function ensureOutletDefaultWarehouse(int $companyId, int $outletId): Warehouse
    {
        return $this->resolveDefaultWarehouse($companyId, $outletId);
    }

    public function makeOutletDefault(Warehouse $warehouse): void
    {
        $query = Warehouse::query()
            ->withoutGlobalScopes()
            ->where('company_id', $warehouse->company_id)
            ->whereKeyNot($warehouse->id);

        if ($warehouse->outlet_id) {
            $query->where('outlet_id', $warehouse->outlet_id);
        } else {
            $query->whereNull('outlet_id');
        }

        $query->update(['is_default' => false]);
        $warehouse->forceFill(['is_default' => true, 'is_active' => true])->save();
    }

    /**
     * Adjust warehouse stock (always in base/small unit) and write a movement.
     * Optional $unitMeta stores the document qty/unit for audit/display.
     *
     * @param  array{qty_input?: int, unit_level?: string|null, unit?: string|null, factor_to_base?: int|null}|null  $unitMeta
     */
    public function adjust(
        int $companyId,
        int $warehouseId,
        int $productId,
        int $qtyChange,
        string $type,
        string $refType,
        ?int $refId,
        ?string $note = null,
        ?int $outletId = null,
        ?array $unitMeta = null,
    ): int {
        $warehouse = Warehouse::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($warehouseId)
            ->firstOrFail();

        $resolvedOutletId = $outletId ?? $warehouse->outlet_id;
        if (! $resolvedOutletId) {
            $resolvedOutletId = Outlet::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->orderByDesc('is_default')
                ->orderBy('id')
                ->value('id');
        }

        if (! $resolvedOutletId) {
            throw ValidationException::withMessages([
                'warehouse_id' => ['Outlet belum tersedia untuk gudang ini.'],
            ]);
        }

        $product = Product::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($productId)
            ->firstOrFail();

        $balance = StockBalance::query()->firstOrCreate(
            [
                'company_id' => $companyId,
                'warehouse_id' => $warehouseId,
                'product_id' => $productId,
            ],
            [
                'outlet_id' => $resolvedOutletId,
                'qty' => 0,
            ],
        );

        $balance = StockBalance::query()
            ->whereKey($balance->id)
            ->lockForUpdate()
            ->firstOrFail();

        if ((int) $balance->outlet_id !== (int) $resolvedOutletId) {
            $balance->outlet_id = $resolvedOutletId;
        }

        $nextQty = (int) $balance->qty + $qtyChange;

        if ($qtyChange < 0 && $nextQty < 0) {
            throw ValidationException::withMessages([
                'items' => ["Stok {$product->name} tidak cukup (tersedia {$balance->qty})."],
            ]);
        }

        $balance->qty = $nextQty;
        $balance->save();

        StockMovement::query()->create([
            'company_id' => $companyId,
            'outlet_id' => $resolvedOutletId,
            'warehouse_id' => $warehouseId,
            'product_id' => $productId,
            'type' => $type,
            'qty_change' => $qtyChange,
            'qty_after' => $nextQty,
            'qty_input' => $unitMeta['qty_input'] ?? null,
            'unit_level' => $unitMeta['unit_level'] ?? null,
            'unit' => $unitMeta['unit'] ?? null,
            'factor_to_base' => isset($unitMeta['factor_to_base']) ? (int) $unitMeta['factor_to_base'] : null,
            'ref_type' => $refType,
            'ref_id' => $refId,
            'note' => $note,
        ]);

        return $nextQty;
    }

    public function qtyAtWarehouse(int $warehouseId, int $productId): int
    {
        return (int) StockBalance::query()
            ->where('warehouse_id', $warehouseId)
            ->where('product_id', $productId)
            ->value('qty');
    }

    public function qtyAtOutletDefault(int $companyId, int $outletId, int $productId): int
    {
        $warehouse = $this->resolveDefaultWarehouse($companyId, $outletId);

        return $this->qtyAtWarehouse($warehouse->id, $productId);
    }
}
