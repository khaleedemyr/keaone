<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StockAdjustment;
use App\Models\StockAdjustmentItem;
use App\Models\StockBalance;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use App\Support\InventoryOps;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockAdjustmentService
{
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
        private DocumentSequenceService $documentSequences,
    ) {}

    public function create(array $payload, User $user): StockAdjustment
    {
        $existing = StockAdjustment::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->load($existing);
        }

        try {
            return DB::transaction(fn () => $this->write($payload, $user));
        } catch (UniqueConstraintViolationException) {
            return $this->load(StockAdjustment::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail());
        }
    }

    public function update(StockAdjustment $adjustment, array $payload): StockAdjustment
    {
        return DB::transaction(function () use ($adjustment, $payload) {
            $adjustment = StockAdjustment::query()->withoutGlobalScopes()->whereKey($adjustment->id)->lockForUpdate()->firstOrFail();
            $this->assertDraft($adjustment);

            $warehouseId = (int) ($payload['warehouse_id'] ?? $adjustment->warehouse_id);
            $warehouse = $this->assertWarehouse((int) $adjustment->company_id, $warehouseId);
            $reason = (string) ($payload['reason'] ?? $adjustment->reason);
            $this->assertReason($reason);

            $adjustment->update([
                'warehouse_id' => $warehouseId,
                'outlet_id' => $warehouse->outlet_id,
                'reason' => $reason,
                'note' => array_key_exists('note', $payload) ? $payload['note'] : $adjustment->note,
            ]);

            if (isset($payload['items'])) {
                $adjustment->items()->delete();
                $this->attachItems($adjustment, $payload['items'], $reason);
            } elseif (InventoryOps::isWasteReason($reason)) {
                $this->assertWasteItemsNegative($adjustment);
            }

            return $this->load($adjustment->fresh());
        });
    }

    public function confirm(StockAdjustment $adjustment): StockAdjustment
    {
        if ($adjustment->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
        }
        if ($adjustment->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Adjustment belum punya item.']]);
        }

        return DB::transaction(function () use ($adjustment) {
            $adjustment = StockAdjustment::query()->withoutGlobalScopes()->whereKey($adjustment->id)->lockForUpdate()->firstOrFail();
            if ($adjustment->status !== 'draft') {
                throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
            }

            if (InventoryOps::isWasteReason((string) $adjustment->reason)) {
                $this->assertWasteItemsNegative($adjustment);
            }

            foreach ($adjustment->items as $item) {
                $qtyChange = (int) $item->qty_change;
                if ($qtyChange === 0) {
                    continue;
                }

                $unitCost = null;
                if ($qtyChange > 0) {
                    $balance = StockBalance::query()
                        ->withoutGlobalScopes()
                        ->where('company_id', $adjustment->company_id)
                        ->where('warehouse_id', $adjustment->warehouse_id)
                        ->where('product_id', $item->product_id)
                        ->first();
                    $product = Product::query()->withoutGlobalScopes()->find($item->product_id);
                    $unitCost = (int) ($balance?->avg_cost ?: $product?->cost_price ?: 0);
                }

                $this->inventory->adjust(
                    (int) $adjustment->company_id,
                    (int) $adjustment->warehouse_id,
                    (int) $item->product_id,
                    $qtyChange,
                    InventoryOps::TYPE_ADJUSTMENT,
                    InventoryOps::ADJUSTMENT_REF,
                    (int) $adjustment->id,
                    $adjustment->number.' / '.$adjustment->reason,
                    $adjustment->outlet_id ? (int) $adjustment->outlet_id : null,
                    [
                        'qty_input' => $item->qty_input,
                        'unit' => $item->unit,
                        'unit_level' => $item->unit_level,
                        'factor_to_base' => $item->factor_to_base,
                    ],
                    $unitCost,
                );
            }

            $updated = StockAdjustment::query()
                ->withoutGlobalScopes()
                ->whereKey($adjustment->id)
                ->where('status', 'draft')
                ->update([
                    'status' => 'confirmed',
                    'confirmed_at' => now(),
                ]);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
            }

            return $this->load($adjustment->fresh());
        });
    }

    public function cancel(StockAdjustment $adjustment): StockAdjustment
    {
        return DB::transaction(function () use ($adjustment) {
            $adjustment = StockAdjustment::query()->withoutGlobalScopes()->whereKey($adjustment->id)->lockForUpdate()->firstOrFail();
            $this->assertDraft($adjustment);

            $updated = StockAdjustment::query()
                ->withoutGlobalScopes()
                ->whereKey($adjustment->id)
                ->where('status', 'draft')
                ->update(['status' => 'cancelled']);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Dokumen hanya bisa diubah saat draft.']]);
            }

            return $this->load($adjustment->fresh());
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(StockAdjustment $adjustment): array
    {
        $adjustment = $this->load($adjustment);

        return [
            'id' => $adjustment->id,
            'number' => $adjustment->number,
            'client_uuid' => $adjustment->client_uuid,
            'status' => $adjustment->status,
            'reason' => $adjustment->reason,
            'note' => $adjustment->note,
            'warehouse_id' => $adjustment->warehouse_id,
            'warehouse' => $adjustment->warehouse?->only(['id', 'name']),
            'outlet_id' => $adjustment->outlet_id,
            'confirmed_at' => $adjustment->confirmed_at?->toIso8601String(),
            'created_at' => $adjustment->created_at?->toIso8601String(),
            'user' => $adjustment->user?->only(['id', 'name']),
            'items' => $adjustment->items->map(fn (StockAdjustmentItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'name_snapshot' => $item->name_snapshot,
                'qty_change' => (int) $item->qty_change,
                'qty_input' => $item->qty_input !== null ? (int) $item->qty_input : abs((int) $item->qty_change),
                'unit' => $item->unit,
                'unit_level' => $item->unit_level ?: 'small',
                'factor_to_base' => max(1, (int) $item->factor_to_base),
                'base_unit' => $item->product?->unit,
            ])->values()->all(),
        ];
    }

    private function write(array $payload, User $user): StockAdjustment
    {
        $company = CurrentCompany::company();
        if (! $company) {
            throw ValidationException::withMessages(['company' => ['Perusahaan tidak aktif.']]);
        }
        $warehouse = $this->assertWarehouse($company->id, (int) $payload['warehouse_id']);
        $reason = (string) ($payload['reason'] ?? 'other');
        $this->assertReason($reason);

        $adjustment = StockAdjustment::query()->create([
            'company_id' => $company->id,
            'warehouse_id' => $warehouse->id,
            'outlet_id' => $warehouse->outlet_id,
            'user_id' => $user->id,
            'number' => $this->documentSequences->next($company->id, 'stock_adjustment', 'ADJ', 4),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'reason' => $reason,
            'note' => $payload['note'] ?? null,
        ]);

        $this->attachItems($adjustment, $payload['items'], $reason);

        return $this->load($adjustment);
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function attachItems(StockAdjustment $adjustment, array $items, string $reason): void
    {
        $waste = InventoryOps::isWasteReason($reason);
        $seen = [];
        foreach ($items as $row) {
            $productId = (int) $row['product_id'];
            if (isset($seen[$productId])) {
                throw ValidationException::withMessages(['items' => ['Produk tidak boleh dobel dalam satu adjustment.']]);
            }
            $seen[$productId] = true;

            $product = $this->assertTrackableProduct((int) $adjustment->company_id, $productId);
            $entered = (int) $row['qty_change'];
            if ($entered === 0) {
                throw ValidationException::withMessages(['items' => ['Qty perubahan tidak boleh 0.']]);
            }
            if ($waste && $entered > 0) {
                throw ValidationException::withMessages(['items' => ['Waste/spoilage harus mengurangi stok (qty negatif).']]);
            }
            $resolved = $this->productUnits->resolveInventoryLine(
                $product,
                abs($entered),
                isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );

            StockAdjustmentItem::query()->create([
                'company_id' => $adjustment->company_id,
                'stock_adjustment_id' => $adjustment->id,
                'product_id' => $product->id,
                'qty_change' => $entered < 0 ? -$resolved['qty_base'] : $resolved['qty_base'],
                'qty_input' => $resolved['qty_input'],
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
            ]);
        }
    }

    private function assertWasteItemsNegative(StockAdjustment $adjustment): void
    {
        foreach ($adjustment->items as $item) {
            if ((int) $item->qty_change >= 0) {
                throw ValidationException::withMessages(['items' => ['Waste/spoilage harus mengurangi stok (qty negatif).']]);
            }
        }
    }

    private function assertDraft(StockAdjustment $adjustment): void
    {
        if ($adjustment->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Dokumen hanya bisa diubah saat draft.']]);
        }
    }

    private function assertReason(string $reason): void
    {
        if (! in_array($reason, InventoryOps::adjustmentReasons(), true)) {
            throw ValidationException::withMessages(['reason' => ['Alasan adjustment tidak valid.']]);
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

    private function load(StockAdjustment $adjustment): StockAdjustment
    {
        return $adjustment->load(['items.product:id,unit', 'warehouse:id,name', 'user:id,name']);
    }
}
