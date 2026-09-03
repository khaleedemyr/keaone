<?php

namespace App\Services;

use App\Models\StockLot;
use App\Models\StockLotMovement;
use App\Support\InventoryOps;
use Illuminate\Validation\ValidationException;

class LotLedgerService
{
    public function receive(
        int $companyId,
        int $warehouseId,
        int $productId,
        string $lotCode,
        int $qty,
        int $unitCost,
        string $refType,
        int $refId,
        ?string $note = null,
    ): StockLot {
        if ($qty < 1) {
            throw ValidationException::withMessages(['lot_code' => ['Qty lot minimal 1.']]);
        }

        $code = trim($lotCode);
        if ($code === '') {
            throw ValidationException::withMessages(['lot_code' => ['Kode lot wajib diisi untuk ledger.']]);
        }

        $lot = StockLot::query()->withoutGlobalScopes()->firstOrCreate(
            [
                'company_id' => $companyId,
                'warehouse_id' => $warehouseId,
                'product_id' => $productId,
                'lot_code' => $code,
            ],
            [
                'qty' => 0,
                'unit_cost' => $unitCost,
                'status' => 'open',
                'source_ref_type' => $refType,
                'source_ref_id' => $refId,
                'produced_at' => now(),
            ],
        );

        $lot = StockLot::query()->withoutGlobalScopes()->whereKey($lot->id)->lockForUpdate()->firstOrFail();
        if ($lot->status === 'voided') {
            throw ValidationException::withMessages(['lot_code' => ['Lot sudah di-void.']]);
        }

        $next = (int) $lot->qty + $qty;
        $lot->update([
            'qty' => $next,
            'unit_cost' => $unitCost > 0 ? $unitCost : (int) $lot->unit_cost,
            'status' => 'open',
            'source_ref_type' => $lot->source_ref_type ?: $refType,
            'source_ref_id' => $lot->source_ref_id ?: $refId,
            'produced_at' => $lot->produced_at ?: now(),
        ]);

        $this->writeMovement($lot, $qty, $next, 'receipt', $refType, $refId, $note);

        return $lot->fresh();
    }

    public function reverseReceipt(
        int $companyId,
        int $warehouseId,
        int $productId,
        string $lotCode,
        int $qty,
        string $refType,
        int $refId,
        ?string $note = null,
    ): ?StockLot {
        $lot = StockLot::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('warehouse_id', $warehouseId)
            ->where('product_id', $productId)
            ->where('lot_code', trim($lotCode))
            ->lockForUpdate()
            ->first();

        if (! $lot) {
            return null;
        }

        if ($qty > (int) $lot->qty) {
            throw ValidationException::withMessages([
                'lot_code' => ["Qty void lot melebihi saldo lot {$lot->lot_code} ({$lot->qty})."],
            ]);
        }

        $next = (int) $lot->qty - $qty;
        $lot->update([
            'qty' => $next,
            'status' => $next <= 0 ? 'voided' : $lot->status,
        ]);

        $this->writeMovement($lot, -$qty, $next, 'void_receipt', $refType, $refId, $note);

        return $lot->fresh();
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(StockLot $lot): array
    {
        $lot->loadMissing(['warehouse:id,name', 'product:id,name,sku']);

        return [
            'id' => $lot->id,
            'lot_code' => $lot->lot_code,
            'qty' => (int) $lot->qty,
            'unit_cost' => (int) $lot->unit_cost,
            'status' => $lot->status,
            'warehouse_id' => $lot->warehouse_id,
            'warehouse' => $lot->warehouse?->only(['id', 'name']),
            'product_id' => $lot->product_id,
            'product' => $lot->product?->only(['id', 'name', 'sku']),
            'source_ref_type' => $lot->source_ref_type,
            'source_ref_id' => $lot->source_ref_id,
            'produced_at' => $lot->produced_at?->toIso8601String(),
            'created_at' => $lot->created_at?->toIso8601String(),
        ];
    }

    private function writeMovement(
        StockLot $lot,
        int $qtyChange,
        int $qtyAfter,
        string $type,
        string $refType,
        int $refId,
        ?string $note,
    ): void {
        StockLotMovement::query()->create([
            'company_id' => $lot->company_id,
            'stock_lot_id' => $lot->id,
            'qty_change' => $qtyChange,
            'qty_after' => $qtyAfter,
            'type' => $type,
            'ref_type' => $refType,
            'ref_id' => $refId,
            'note' => $note,
        ]);
    }
}
