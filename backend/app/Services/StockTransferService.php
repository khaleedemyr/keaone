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
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
        private DocumentSequenceService $documentSequences,
    ) {}

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
        return DB::transaction(function () use ($transfer, $payload) {
            $transfer = StockTransfer::query()->withoutGlobalScopes()->whereKey($transfer->id)->lockForUpdate()->firstOrFail();
            $this->assertDraft($transfer);

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
                $item->update([
                    'unit_cost' => $result->unitCost,
                    'cost_amount' => $result->costAmount,
                ]);
            }

            $updated = StockTransfer::query()
                ->withoutGlobalScopes()
                ->whereKey($transfer->id)
                ->where('status', 'draft')
                ->update([
                    'status' => 'shipped',
                    'shipped_at' => now(),
                ]);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikirim.']]);
            }

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
                $this->receiveItemCostPreserving($transfer, $item, $to);
            }

            $updated = StockTransfer::query()
                ->withoutGlobalScopes()
                ->whereKey($transfer->id)
                ->where('status', 'shipped')
                ->update([
                    'status' => 'received',
                    'received_at' => now(),
                ]);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Hanya transfer terkirim yang bisa diterima.']]);
            }

            return $this->load($transfer->fresh());
        });
    }

    /**
     * Void a shipped (in-transit) or received transfer, reversing stock movements.
     */
    public function void(StockTransfer $transfer, User $user, ?string $reason = null): StockTransfer
    {
        if (! in_array($transfer->status, ['shipped', 'received'], true)) {
            throw ValidationException::withMessages(['status' => ['Hanya transfer shipped/received yang bisa di-void.']]);
        }

        return DB::transaction(function () use ($transfer, $user, $reason) {
            $transfer = StockTransfer::query()->withoutGlobalScopes()->whereKey($transfer->id)->lockForUpdate()->firstOrFail();
            if (! in_array($transfer->status, ['shipped', 'received'], true)) {
                throw ValidationException::withMessages(['status' => ['Hanya transfer shipped/received yang bisa di-void.']]);
            }

            $from = Warehouse::query()->withoutGlobalScopes()->findOrFail($transfer->from_warehouse_id);
            $to = Warehouse::query()->withoutGlobalScopes()->findOrFail($transfer->to_warehouse_id);
            $wasReceived = $transfer->status === 'received';

            if ($wasReceived) {
                foreach ($transfer->items as $item) {
                    $this->inventory->adjust(
                        (int) $transfer->company_id,
                        (int) $transfer->to_warehouse_id,
                        (int) $item->product_id,
                        -1 * (int) $item->qty,
                        InventoryOps::TYPE_TRANSFER_VOID_IN,
                        InventoryOps::TRANSFER_REF,
                        (int) $transfer->id,
                        $transfer->number.' / void receive',
                        $to->outlet_id ? (int) $to->outlet_id : null,
                        [
                            'qty_input' => $item->qty_input,
                            'unit' => $item->unit,
                            'unit_level' => $item->unit_level,
                            'factor_to_base' => $item->factor_to_base,
                        ],
                        null,
                        true,
                    );
                }
            }

            foreach ($transfer->items as $item) {
                $this->inventory->adjust(
                    (int) $transfer->company_id,
                    (int) $transfer->from_warehouse_id,
                    (int) $item->product_id,
                    (int) $item->qty,
                    InventoryOps::TYPE_TRANSFER_VOID_OUT,
                    InventoryOps::TRANSFER_REF,
                    (int) $transfer->id,
                    $transfer->number.' / void ship',
                    $from->outlet_id ? (int) $from->outlet_id : null,
                    [
                        'qty_input' => $item->qty_input,
                        'unit' => $item->unit,
                        'unit_level' => $item->unit_level,
                        'factor_to_base' => $item->factor_to_base,
                    ],
                    null,
                    true,
                );
            }

            $status = $wasReceived ? 'received' : 'shipped';
            $updated = StockTransfer::query()
                ->withoutGlobalScopes()
                ->whereKey($transfer->id)
                ->where('status', $status)
                ->update([
                    'status' => 'voided',
                    'voided_at' => now(),
                    'voided_by' => $user->id,
                    'void_reason' => $reason,
                ]);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Hanya transfer shipped/received yang bisa di-void.']]);
            }

            return $this->load($transfer->fresh());
        });
    }

    public function cancel(StockTransfer $transfer): StockTransfer
    {
        return DB::transaction(function () use ($transfer) {
            $transfer = StockTransfer::query()->withoutGlobalScopes()->whereKey($transfer->id)->lockForUpdate()->firstOrFail();
            $this->assertDraft($transfer);

            $updated = StockTransfer::query()
                ->withoutGlobalScopes()
                ->whereKey($transfer->id)
                ->where('status', 'draft')
                ->update(['status' => 'cancelled']);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Dokumen hanya bisa diubah saat draft.']]);
            }

            return $this->load($transfer->fresh());
        });
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
            'voided_at' => $transfer->voided_at?->toIso8601String(),
            'void_reason' => $transfer->void_reason,
            'created_at' => $transfer->created_at?->toIso8601String(),
            'user' => $transfer->user?->only(['id', 'name']),
            'items' => $transfer->items->map(fn (StockTransferItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'name_snapshot' => $item->name_snapshot,
                'qty' => (int) $item->qty,
                'qty_input' => $item->qty_input !== null ? (int) $item->qty_input : (int) $item->qty,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level ?: 'small',
                'factor_to_base' => max(1, (int) $item->factor_to_base),
                'base_unit' => $item->product?->unit,
                'unit_cost' => (int) $item->unit_cost,
                'cost_amount' => (int) ($item->cost_amount ?? ((int) $item->unit_cost * (int) $item->qty)),
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
            'number' => $this->documentSequences->next($company->id, 'stock_transfer', 'TRF', 4),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'note' => $payload['note'] ?? null,
        ]);

        $this->attachItems($transfer, $payload['items']);

        return $this->load($transfer);
    }

    /**
     * Post inbound at destination preserving total cost_amount from ship (integer remainder on last unit).
     */
    private function receiveItemCostPreserving(StockTransfer $transfer, StockTransferItem $item, Warehouse $to): void
    {
        $qty = (int) $item->qty;
        if ($qty < 1) {
            return;
        }

        $amount = (int) ($item->cost_amount ?? ((int) $item->unit_cost * $qty));
        $baseUnit = (int) intdiv($amount, $qty);
        $remainder = $amount - ($baseUnit * $qty);
        $meta = [
            'qty_input' => $item->qty_input,
            'unit' => $item->unit,
            'unit_level' => $item->unit_level,
            'factor_to_base' => $item->factor_to_base,
        ];

        $chunks = $remainder !== 0 && $qty > 1
            ? [[$qty - 1, $baseUnit], [1, $baseUnit + $remainder]]
            : [[$qty, $baseUnit + $remainder]];

        foreach ($chunks as [$chunkQty, $unitCost]) {
            if ($chunkQty < 1) {
                continue;
            }
            $this->inventory->adjust(
                (int) $transfer->company_id,
                (int) $transfer->to_warehouse_id,
                (int) $item->product_id,
                $chunkQty,
                InventoryOps::TYPE_TRANSFER_IN,
                InventoryOps::TRANSFER_REF,
                (int) $transfer->id,
                $transfer->number,
                $to->outlet_id ? (int) $to->outlet_id : null,
                $meta,
                $unitCost,
            );
        }
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function attachItems(StockTransfer $transfer, array $items): void
    {
        $seen = [];
        foreach ($items as $row) {
            $productId = (int) $row['product_id'];
            if (isset($seen[$productId])) {
                throw ValidationException::withMessages(['items' => ['Produk tidak boleh dobel dalam satu transfer.']]);
            }
            $seen[$productId] = true;

            $product = $this->assertTrackableProduct((int) $transfer->company_id, $productId);
            $entered = (int) $row['qty'];
            if ($entered < 1) {
                throw ValidationException::withMessages(['items' => ['Qty transfer minimal 1.']]);
            }
            $resolved = $this->productUnits->resolveInventoryLine(
                $product,
                $entered,
                isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );

            StockTransferItem::query()->create([
                'company_id' => $transfer->company_id,
                'stock_transfer_id' => $transfer->id,
                'product_id' => $product->id,
                'qty' => $resolved['qty_base'],
                'qty_input' => $resolved['qty_input'],
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'unit_cost' => 0,
                'cost_amount' => 0,
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
            'items.product:id,unit',
            'fromWarehouse:id,name',
            'toWarehouse:id,name',
            'user:id,name',
        ]);
    }
}
