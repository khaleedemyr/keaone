<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use App\Support\InventoryOps;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockTransferService
{
    public function __construct(private InventoryService $inventory) {}

    public function create(array $payload, User $user): StockTransfer
    {
        $existing = StockTransfer::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->load($existing);
        }

        try {
            return DB::transaction(fn () => $this->write($payload, $user));
        } catch (UniqueConstraintViolationException) {
            return $this->load(StockTransfer::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail());
        }
    }

    public function update(StockTransfer $transfer, array $payload): StockTransfer
    {
        $this->assertDraft($transfer);

        return DB::transaction(function () use ($transfer, $payload) {
            $fromId = (int) ($payload['from_warehouse_id'] ?? $transfer->from_warehouse_id);
            $toId = (int) ($payload['to_warehouse_id'] ?? $transfer->to_warehouse_id);
            $this->assertWarehouses($transfer->company_id, $fromId, $toId);

            $from = Warehouse::query()->withoutGlobalScopes()->findOrFail($fromId);

            $transfer->update([
                'from_warehouse_id' => $fromId,
                'to_warehouse_id' => $toId,
                'outlet_id' => $from->outlet_id,
                'note' => array_key_exists('note', $payload) ? $payload['note'] : $transfer->note,
            ]);

            if (isset($payload['items'])) {
                $transfer->items()->delete();
                $this->attachItems($transfer, $payload['items']);
            }

            return $this->load($transfer->fresh());
        });
    }

    public function ship(StockTransfer $transfer): StockTransfer
    {
        if ($transfer->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikirim.']]);
        }
        if ($transfer->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Transfer belum punya item.']]);
        }

        return DB::transaction(function () use ($transfer) {
            $transfer = StockTransfer::query()->withoutGlobalScopes()->whereKey($transfer->id)->lockForUpdate()->firstOrFail();
            if ($transfer->status !== 'draft') {
                throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikirim.']]);
            }

            $items = $transfer->items()->get();
            foreach ($items as $item) {
                $result = $this->inventory->adjust(
                    (int) $transfer->company_id,
                    (int) $transfer->from_warehouse_id,
                    (int) $item->product_id,
                    -1 * (int) $item->qty,
                    InventoryOps::TYPE_TRANSFER_OUT,
                    InventoryOps::TRANSFER_REF,
                    (int) $transfer->id,
                    $transfer->number,
                    $transfer->outlet_id ? (int) $transfer->outlet_id : null,
                    [
                        'qty_input' => $item->qty_input,
                        'unit' => $item->unit,
                        'unit_level' => $item->unit_level,
                        'factor_to_base' => $item->factor_to_base,
                    ],
                );
                $item->update(['unit_cost' => $result->unitCost]);
            }

            $transfer->update([
                'status' => 'shipped',
                'shipped_at' => now(),
            ]);

            return $this->load($transfer->fresh());
        });
    }

    public function receive(StockTransfer $transfer): StockTransfer
    {
        if ($transfer->status !== 'shipped') {
            throw ValidationException::withMessages(['status' => ['Hanya transfer terkirim yang bisa diterima.']]);
        }

        return DB::transaction(function () use ($transfer) {
            $transfer = StockTransfer::query()->withoutGlobalScopes()->whereKey($transfer->id)->lockForUpdate()->firstOrFail();
            if ($transfer->status !== 'shipped') {
                throw ValidationException::withMessages(['status' => ['Hanya transfer terkirim yang bisa diterima.']]);
            }

            $to = Warehouse::query()->withoutGlobalScopes()->findOrFail($transfer->to_warehouse_id);

            foreach ($transfer->items as $item) {
                $this->inventory->adjust(
                    (int) $transfer->company_id,
                    (int) $transfer->to_warehouse_id,
                    (int) $item->product_id,
                    (int) $item->qty,
                    InventoryOps::TYPE_TRANSFER_IN,
                    InventoryOps::TRANSFER_REF,
                    (int) $transfer->id,
                    $transfer->number,
                    $to->outlet_id ? (int) $to->outlet_id : null,
                    [
                        'qty_input' => $item->qty_input,
                        'unit' => $item->unit,
                        'unit_level' => $item->unit_level,
                        'factor_to_base' => $item->factor_to_base,
                    ],
                    (int) $item->unit_cost,
                );
            }

            $transfer->update([
                'status' => 'received',
                'received_at' => now(),
            ]);

            return $this->load($transfer->fresh());
        });
    }

    public function cancel(StockTransfer $transfer): StockTransfer
    {
        $this->assertDraft($transfer);
        $transfer->update(['status' => 'cancelled']);

        return $this->load($transfer->fresh());
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(StockTransfer $transfer): array
    {
        $transfer = $this->load($transfer);

        return [
            'id' => $transfer->id,
            'number' => $transfer->number,
            'client_uuid' => $transfer->client_uuid,
            'status' => $transfer->status,
            'note' => $transfer->note,
            'from_warehouse_id' => $transfer->from_warehouse_id,
            'to_warehouse_id' => $transfer->to_warehouse_id,
            'from_warehouse' => $transfer->fromWarehouse?->only(['id', 'name']),
            'to_warehouse' => $transfer->toWarehouse?->only(['id', 'name']),
            'outlet_id' => $transfer->outlet_id,
            'shipped_at' => $transfer->shipped_at?->toIso8601String(),
            'received_at' => $transfer->received_at?->toIso8601String(),
            'created_at' => $transfer->created_at?->toIso8601String(),
            'user' => $transfer->user?->only(['id', 'name']),
            'items' => $transfer->items->map(fn (StockTransferItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'name_snapshot' => $item->name_snapshot,
                'qty' => (int) $item->qty,
                'qty_input' => $item->qty_input,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'factor_to_base' => (int) $item->factor_to_base,
                'unit_cost' => (int) $item->unit_cost,
            ])->values()->all(),
        ];
    }

    private function write(array $payload, User $user): StockTransfer
    {
        $company = CurrentCompany::company();
        if (! $company) {
            throw ValidationException::withMessages(['company' => ['Perusahaan tidak aktif.']]);
        }
        $fromId = (int) $payload['from_warehouse_id'];
        $toId = (int) $payload['to_warehouse_id'];
        $this->assertWarehouses($company->id, $fromId, $toId);
        $from = Warehouse::query()->withoutGlobalScopes()->findOrFail($fromId);

        $transfer = StockTransfer::query()->create([
            'company_id' => $company->id,
            'from_warehouse_id' => $fromId,
            'to_warehouse_id' => $toId,
            'outlet_id' => $from->outlet_id,
            'user_id' => $user->id,
            'number' => $this->nextNumber($company->id),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'note' => $payload['note'] ?? null,
        ]);

        $this->attachItems($transfer, $payload['items']);

        return $this->load($transfer);
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function attachItems(StockTransfer $transfer, array $items): void
    {
        foreach ($items as $row) {
            $product = $this->assertTrackableProduct((int) $transfer->company_id, (int) $row['product_id']);
            $qty = (int) $row['qty'];
            if ($qty < 1) {
                throw ValidationException::withMessages(['items' => ['Qty transfer minimal 1.']]);
            }
            $factor = max(1, (int) ($row['factor_to_base'] ?? 1));
            $qtyInput = isset($row['qty_input']) ? (int) $row['qty_input'] : $qty;

            StockTransferItem::query()->create([
                'company_id' => $transfer->company_id,
                'stock_transfer_id' => $transfer->id,
                'product_id' => $product->id,
                'qty' => $qty,
                'qty_input' => $qtyInput,
                'unit' => $row['unit'] ?? $product->unit,
                'unit_level' => $row['unit_level'] ?? 'small',
                'factor_to_base' => $factor,
                'name_snapshot' => $product->name,
                'unit_cost' => 0,
            ]);
        }
    }

    private function assertDraft(StockTransfer $transfer): void
    {
        if ($transfer->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Dokumen hanya bisa diubah saat draft.']]);
        }
    }

    private function assertWarehouses(int $companyId, int $fromId, int $toId): void
    {
        if ($fromId === $toId) {
            throw ValidationException::withMessages(['to_warehouse_id' => ['Gudang tujuan harus berbeda.']]);
        }

        foreach ([$fromId, $toId] as $id) {
            $ok = Warehouse::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereKey($id)
                ->where('is_active', true)
                ->exists();
            if (! $ok) {
                throw ValidationException::withMessages(['warehouse_id' => ['Gudang tidak valid.']]);
            }
        }
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

    private function load(StockTransfer $transfer): StockTransfer
    {
        return $transfer->load([
            'items',
            'fromWarehouse:id,name',
            'toWarehouse:id,name',
            'user:id,name',
        ]);
    }

    private function nextNumber(int $companyId): string
    {
        $full = 'TRF-'.now()->format('ymd').'-';
        $last = StockTransfer::query()
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
