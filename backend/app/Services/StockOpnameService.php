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
    public function __construct(private InventoryService $inventory) {}

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
        $this->assertDraft($opname);

        return DB::transaction(function () use ($opname, $payload) {
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
                $variance = (int) $item->counted_qty - (int) $item->book_qty;
                $item->update(['variance' => $variance]);
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

            $opname->update([
                'status' => 'confirmed',
                'confirmed_at' => now(),
                'counted_at' => $opname->counted_at ?? now(),
            ]);

            return $this->load($opname->fresh());
        });
    }

    public function cancel(StockOpname $opname): StockOpname
    {
        $this->assertDraft($opname);
        $opname->update(['status' => 'cancelled']);

        return $this->load($opname->fresh());
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
                'variance' => (int) $item->variance,
                'unit' => $item->unit,
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
            'number' => $this->nextNumber($company->id),
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
        foreach ($items as $row) {
            $product = $this->assertTrackableProduct((int) $opname->company_id, (int) $row['product_id']);
            $bookQty = array_key_exists('book_qty', $row)
                ? (int) $row['book_qty']
                : $this->inventory->qtyAtWarehouse((int) $opname->warehouse_id, $product->id);
            $countedQty = (int) ($row['counted_qty'] ?? $bookQty);

            StockOpnameItem::query()->create([
                'company_id' => $opname->company_id,
                'stock_opname_id' => $opname->id,
                'product_id' => $product->id,
                'book_qty' => $bookQty,
                'counted_qty' => $countedQty,
                'variance' => $countedQty - $bookQty,
                'name_snapshot' => $product->name,
                'unit' => $row['unit'] ?? $product->unit,
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
        return $opname->load(['items', 'warehouse:id,name', 'user:id,name']);
    }

    private function nextNumber(int $companyId): string
    {
        $full = 'OPN-'.now()->format('ymd').'-';
        $last = StockOpname::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('number', 'like', $full.'%')
            ->orderByDesc('number')
            ->lockForUpdate()
            ->value('number');

        $seq = $last ? ((int) substr((string) $last, -3)) + 1 : 1;

        return $full.str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
    }
}
