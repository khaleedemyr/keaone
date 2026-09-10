<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use App\Support\InventoryOps;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockOpnameService
{
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
        private DocumentSequenceService $documentSequences,
    ) {}

    public function create(array $payload, User $user): StockOpname
    {
        $existing = StockOpname::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->load($existing);
        }

        try {
            return DB::transaction(fn () => $this->write($payload, $user));
        } catch (UniqueConstraintViolationException) {
            return $this->load(StockOpname::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail());
        }
    }

    public function update(StockOpname $opname, array $payload): StockOpname
    {
        return DB::transaction(function () use ($opname, $payload) {
            $opname = StockOpname::query()->withoutGlobalScopes()->whereKey($opname->id)->lockForUpdate()->firstOrFail();
            $this->assertDraft($opname);

            $warehouseId = (int) ($payload['warehouse_id'] ?? $opname->warehouse_id);
            $warehouse = $this->assertWarehouse((int) $opname->company_id, $warehouseId);

            $opname->update([
                'warehouse_id' => $warehouseId,
                'outlet_id' => $warehouse->outlet_id,
                'note' => array_key_exists('note', $payload) ? $payload['note'] : $opname->note,
                'counted_at' => array_key_exists('counted_at', $payload) ? $payload['counted_at'] : $opname->counted_at,
            ]);

            if (isset($payload['items'])) {
                $opname->items()->delete();
                $this->attachItems($opname, $payload['items']);
            }

            return $this->load($opname->fresh());
        });
    }

    public function confirm(StockOpname $opname): StockOpname
    {
        if ($opname->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
        }
        if ($opname->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Opname belum punya item.']]);
        }

        return DB::transaction(function () use ($opname) {
            $opname = StockOpname::query()->withoutGlobalScopes()->whereKey($opname->id)->lockForUpdate()->firstOrFail();
            if ($opname->status !== 'draft') {
                throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
            }

            foreach ($opname->items as $item) {
                // Set stock to counted qty relative to current balance (not a stale book snapshot).
                $currentQty = $this->inventory->qtyAtWarehouse((int) $opname->warehouse_id, (int) $item->product_id);
                $countedQty = (int) $item->counted_qty;
                $variance = $countedQty - $currentQty;

                $item->update([
                    'book_qty' => $currentQty,
                    'variance' => $variance,
                ]);

                if ($variance === 0) {
                    continue;
                }

                $unitCost = null;
                if ($variance > 0) {
                    $balance = StockBalance::query()
                        ->withoutGlobalScopes()
                        ->where('company_id', $opname->company_id)
                        ->where('warehouse_id', $opname->warehouse_id)
                        ->where('product_id', $item->product_id)
                        ->first();
                    $product = Product::query()->withoutGlobalScopes()->find($item->product_id);
                    $unitCost = (int) ($balance?->avg_cost ?: $product?->cost_price ?: 0);
                }

                $this->inventory->adjust(
                    (int) $opname->company_id,
                    (int) $opname->warehouse_id,
                    (int) $item->product_id,
                    $variance,
                    InventoryOps::TYPE_OPNAME,
                    InventoryOps::OPNAME_REF,
                    (int) $opname->id,
                    $opname->number,
                    $opname->outlet_id ? (int) $opname->outlet_id : null,
                    null,
                    $unitCost,
                );
            }

            $updated = StockOpname::query()
                ->withoutGlobalScopes()
                ->whereKey($opname->id)
                ->where('status', 'draft')
                ->update([
                    'status' => 'confirmed',
                    'confirmed_at' => now(),
                    'counted_at' => $opname->counted_at ?? now(),
                ]);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
            }

            return $this->load($opname->fresh());
        });
    }

    public function cancel(StockOpname $opname): StockOpname
    {
        return DB::transaction(function () use ($opname) {
            $opname = StockOpname::query()->withoutGlobalScopes()->whereKey($opname->id)->lockForUpdate()->firstOrFail();
            $this->assertDraft($opname);

            $updated = StockOpname::query()
                ->withoutGlobalScopes()
                ->whereKey($opname->id)
                ->where('status', 'draft')
                ->update(['status' => 'cancelled']);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Dokumen hanya bisa diubah saat draft.']]);
            }

            return $this->load($opname->fresh());
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(StockOpname $opname): array
    {
        $opname = $this->load($opname);

        return [
            'id' => $opname->id,
            'number' => $opname->number,
            'client_uuid' => $opname->client_uuid,
            'status' => $opname->status,
            'note' => $opname->note,
            'warehouse_id' => $opname->warehouse_id,
            'warehouse' => $opname->warehouse?->only(['id', 'name']),
            'outlet_id' => $opname->outlet_id,
            'counted_at' => $opname->counted_at?->toIso8601String(),
            'confirmed_at' => $opname->confirmed_at?->toIso8601String(),
            'created_at' => $opname->created_at?->toIso8601String(),
            'user' => $opname->user?->only(['id', 'name']),
            'items' => $opname->items->map(fn (StockOpnameItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'name_snapshot' => $item->name_snapshot,
                'book_qty' => (int) $item->book_qty,
                'counted_qty' => (int) $item->counted_qty,
                'counted_qty_input' => $item->counted_qty_input !== null
                    ? (int) $item->counted_qty_input
                    : (int) $item->counted_qty,
                'variance' => (int) $item->variance,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level ?: 'small',
                'factor_to_base' => max(1, (int) $item->factor_to_base),
                'base_unit' => $item->product?->unit,
            ])->values()->all(),
        ];
    }

    private function write(array $payload, User $user): StockOpname
    {
        $company = CurrentCompany::company();
        if (! $company) {
            throw ValidationException::withMessages(['company' => ['Perusahaan tidak aktif.']]);
        }
        $warehouse = $this->assertWarehouse($company->id, (int) $payload['warehouse_id']);

        $opname = StockOpname::query()->create([
            'company_id' => $company->id,
            'warehouse_id' => $warehouse->id,
            'outlet_id' => $warehouse->outlet_id,
            'user_id' => $user->id,
            'number' => $this->documentSequences->next($company->id, 'stock_opname', 'OPN', 4),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'note' => $payload['note'] ?? null,
            'counted_at' => $payload['counted_at'] ?? now(),
        ]);

        $this->attachItems($opname, $payload['items']);

        return $this->load($opname);
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function attachItems(StockOpname $opname, array $items): void
    {
        $seen = [];
        foreach ($items as $row) {
            $productId = (int) $row['product_id'];
            if (isset($seen[$productId])) {
                throw ValidationException::withMessages(['items' => ['Produk tidak boleh dobel dalam satu opname.']]);
            }
            $seen[$productId] = true;

            $product = $this->assertTrackableProduct((int) $opname->company_id, $productId);
            // Always take book qty from live stock — never trust client baseline.
            $bookQty = $this->inventory->qtyAtWarehouse((int) $opname->warehouse_id, $product->id);
            $hasCounted = array_key_exists('counted_qty', $row);
            $resolved = $this->productUnits->resolveInventoryLine(
                $product,
                $hasCounted ? (int) $row['counted_qty'] : $bookQty,
                $hasCounted && isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );
            $countedQty = $resolved['qty_base'];

            StockOpnameItem::query()->create([
                'company_id' => $opname->company_id,
                'stock_opname_id' => $opname->id,
                'product_id' => $product->id,
                'book_qty' => $bookQty,
                'counted_qty' => $countedQty,
                'counted_qty_input' => $resolved['qty_input'],
                'variance' => $countedQty - $bookQty,
                'name_snapshot' => $product->name,
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
            ]);
        }
    }

    private function assertDraft(StockOpname $opname): void
    {
        if ($opname->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Dokumen hanya bisa diubah saat draft.']]);
        }
    }

    private function assertWarehouse(int $companyId, int $warehouseId): Warehouse
    {
        $warehouse = Warehouse::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($warehouseId)
            ->where('is_active', true)
            ->first();

        if (! $warehouse) {
            throw ValidationException::withMessages(['warehouse_id' => ['Gudang tidak valid.']]);
        }

        return $warehouse;
    }

    private function assertTrackableProduct(int $companyId, int $productId): Product
    {
        $product = Product::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($productId)
            ->first();

        if (! $product || ! $product->track_stock || ! $product->is_active) {
            throw ValidationException::withMessages(['items' => ['Produk harus aktif dan dilacak stoknya.']]);
        }

        return $product;
    }

    private function load(StockOpname $opname): StockOpname
    {
        return $opname->load(['items.product:id,unit', 'warehouse:id,name', 'user:id,name']);
    }
}
