<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockCostConsumption;
use App\Models\StockCostLayer;
use App\Models\StockMovement;
use App\Support\InventorySettings;
use Illuminate\Validation\ValidationException;

class CostingService
{
    /**
     * @return array{unit_cost: int, cost_amount: int, method: string, consumptions: list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>}
     */
    public function apply(
        Company $company,
        Product $product,
        StockBalance $balance,
        int $qtyBefore,
        int $qtyChange,
        string $refType,
        ?int $refId,
        ?int $inboundUnitCost,
        bool $reverseCosting,
    ): array {
        $method = InventorySettings::method($company);

        if ($method === InventorySettings::AVERAGE) {
            $this->rollAveragePeriod($balance, $product, $qtyBefore);
        }

        if ($qtyBefore <= 0) {
            $balance->cost_value = 0;
        }

        if ($qtyChange > 0 && $reverseCosting && InventorySettings::usesLayers($company)) {
            $restored = $this->restoreConsumptions($balance, $qtyChange, $refType, $refId);
            if ($restored !== null) {
                $this->syncProductCost($product, $balance);

                return $restored + ['method' => $method];
            }
        }

        if ($qtyChange < 0 && $reverseCosting && InventorySettings::usesLayers($company)) {
            $result = $this->consumeSourceLayers($balance, $product, abs($qtyChange), $refType, $refId);
            $this->syncProductCost($product, $balance);

            return $result + ['method' => $method];
        }

        if (InventorySettings::usesLayers($company)) {
            $this->seedOpeningLayer($balance, $product, $qtyBefore, $inboundUnitCost);
        }

        if ($qtyChange > 0) {
            $unitCost = $this->resolveInboundCost($product, $balance, $inboundUnitCost);
            $result = match ($method) {
                InventorySettings::FIFO => $this->inboundLayer(
                    $balance,
                    $qtyChange,
                    $unitCost,
                    $refType,
                    $refId,
                ),
                InventorySettings::AVERAGE => $this->inboundAverage($balance, $qtyChange, $unitCost),
                default => $this->inboundMovingAverage($balance, $qtyBefore, $qtyChange, $unitCost),
            };
        } else {
            $qtyOut = abs($qtyChange);
            $result = match ($method) {
                InventorySettings::FIFO => $this->consumeLayers($balance, $product, $qtyOut),
                InventorySettings::AVERAGE => $this->outboundAverage($balance, $qtyBefore, $qtyOut),
                default => $this->outboundMovingAverage($balance, $qtyBefore, $qtyOut),
            };
        }

        $this->syncProductCost($product, $balance);

        return $result + ['method' => $method];
    }

    /**
     * @param  list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>  $consumptions
     */
    public function attachConsumptions(StockMovement $movement, array $consumptions): void
    {
        foreach ($consumptions as $row) {
            StockCostConsumption::query()->withoutGlobalScopes()->create([
                'company_id' => $movement->company_id,
                'stock_movement_id' => $movement->id,
                'stock_cost_layer_id' => $row['layer_id'],
                'qty' => $row['qty'],
                'unit_cost' => $row['unit_cost'],
                'cost_amount' => $row['cost_amount'],
            ]);
        }
    }

    public function currentUnitCost(StockBalance $balance, Product $product): int
    {
        $avg = (int) $balance->avg_cost;
        if ($avg > 0) {
            return $avg;
        }

        $qty = (int) $balance->qty;
        $value = (int) $balance->cost_value;
        if ($qty > 0 && $value > 0) {
            return (int) round($value / $qty);
        }

        return (int) $product->cost_price;
    }

    private function rollAveragePeriod(StockBalance $balance, Product $product, int $qtyBefore): void
    {
        $year = (int) now()->year;
        $month = (int) now()->month;
        if ((int) $balance->period_year === $year && (int) $balance->period_month === $month) {
            return;
        }

        $unit = $this->currentUnitCost($balance, $product);
        $balance->period_year = $year;
        $balance->period_month = $month;
        $balance->period_opening_qty = max(0, $qtyBefore);
        $balance->period_opening_value = max(0, $qtyBefore) * $unit;
        $balance->period_receipt_qty = 0;
        $balance->period_receipt_value = 0;
        $balance->save();
    }

    private function resolveInboundCost(Product $product, StockBalance $balance, ?int $inboundUnitCost): int
    {
        if ($inboundUnitCost !== null && $inboundUnitCost >= 0) {
            return $inboundUnitCost;
        }

        return $this->currentUnitCost($balance, $product);
    }

    /**
     * @return array{unit_cost: int, cost_amount: int, consumptions: list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>}
     */
    private function inboundLayer(StockBalance $balance, int $qty, int $unitCost, string $refType, ?int $refId): array
    {
        StockCostLayer::query()->withoutGlobalScopes()->create([
            'company_id' => $balance->company_id,
            'warehouse_id' => $balance->warehouse_id,
            'product_id' => $balance->product_id,
            'qty_original' => $qty,
            'qty_remaining' => $qty,
            'unit_cost' => $unitCost,
            'received_at' => now(),
            'ref_type' => $refType,
            'ref_id' => $refId,
        ]);

        $amount = $qty * $unitCost;
        $balance->cost_value = (int) $balance->cost_value + $amount;
        $this->refreshLayerAverage($balance);
        $balance->save();

        return [
            'unit_cost' => $unitCost,
            'cost_amount' => $amount,
            'consumptions' => [],
        ];
    }

    /**
     * @return array{unit_cost: int, cost_amount: int, consumptions: list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>}
     */
    private function consumeLayers(StockBalance $balance, Product $product, int $qtyOut): array
    {
        $layers = StockCostLayer::query()
            ->withoutGlobalScopes()
            ->where('company_id', $balance->company_id)
            ->where('warehouse_id', $balance->warehouse_id)
            ->where('product_id', $balance->product_id)
            ->where('qty_remaining', '>', 0)
            ->lockForUpdate()
            ->orderBy('received_at')
            ->orderBy('id')
            ->get();

        $remaining = $qtyOut;
        $costAmount = 0;
        $consumptions = [];

        foreach ($layers as $layer) {
            if ($remaining <= 0) {
                break;
            }
            $take = min((int) $layer->qty_remaining, $remaining);
            $line = $take * (int) $layer->unit_cost;
            $layer->qty_remaining = (int) $layer->qty_remaining - $take;
            $layer->save();
            $consumptions[] = [
                'layer_id' => (int) $layer->id,
                'qty' => $take,
                'unit_cost' => (int) $layer->unit_cost,
                'cost_amount' => $line,
            ];
            $costAmount += $line;
            $remaining -= $take;
        }

        if ($remaining > 0) {
            $fallback = $this->currentUnitCost($balance, $product);
            $line = $remaining * $fallback;
            $costAmount += $line;
            $remaining = 0;
        }

        $balance->cost_value = max(0, (int) $balance->cost_value - $costAmount);
        $this->refreshLayerAverage($balance);
        $balance->save();

        $unitCost = $qtyOut > 0 ? (int) round($costAmount / $qtyOut) : 0;

        return [
            'unit_cost' => $unitCost,
            'cost_amount' => $costAmount,
            'consumptions' => $consumptions,
        ];
    }

    /**
     * @return array{unit_cost: int, cost_amount: int, consumptions: list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>}
     */
    private function consumeSourceLayers(
        StockBalance $balance,
        Product $product,
        int $qtyOut,
        string $refType,
        ?int $refId,
    ): array {
        $layers = StockCostLayer::query()
            ->withoutGlobalScopes()
            ->where('company_id', $balance->company_id)
            ->where('warehouse_id', $balance->warehouse_id)
            ->where('product_id', $balance->product_id)
            ->where('ref_type', $refType)
            ->where('ref_id', $refId)
            ->where('qty_remaining', '>', 0)
            ->lockForUpdate()
            ->orderBy('id')
            ->get();

        $available = (int) $layers->sum('qty_remaining');
        if ($available < $qtyOut) {
            throw ValidationException::withMessages([
                'status' => ['Sebagian stok dari transaksi ini sudah terpakai, sehingga pembatalan tidak bisa dilakukan.'],
            ]);
        }

        $remaining = $qtyOut;
        $costAmount = 0;
        $consumptions = [];

        foreach ($layers as $layer) {
            if ($remaining <= 0) {
                break;
            }
            $take = min((int) $layer->qty_remaining, $remaining);
            $line = $take * (int) $layer->unit_cost;
            $layer->qty_remaining = (int) $layer->qty_remaining - $take;
            $layer->save();
            $consumptions[] = [
                'layer_id' => (int) $layer->id,
                'qty' => $take,
                'unit_cost' => (int) $layer->unit_cost,
                'cost_amount' => $line,
            ];
            $costAmount += $line;
            $remaining -= $take;
        }

        $balance->cost_value = max(0, (int) $balance->cost_value - $costAmount);
        $this->refreshLayerAverage($balance);
        $balance->save();

        return [
            'unit_cost' => $qtyOut > 0 ? (int) round($costAmount / $qtyOut) : (int) $product->cost_price,
            'cost_amount' => $costAmount,
            'consumptions' => $consumptions,
        ];
    }

    /**
     * @return array{unit_cost: int, cost_amount: int, consumptions: list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>}|null
     */
    private function restoreConsumptions(StockBalance $balance, int $qtyIn, string $refType, ?int $refId): ?array
    {
        $movementIds = StockMovement::query()
            ->withoutGlobalScopes()
            ->where('company_id', $balance->company_id)
            ->where('warehouse_id', $balance->warehouse_id)
            ->where('product_id', $balance->product_id)
            ->where('ref_type', $refType)
            ->where('ref_id', $refId)
            ->where('qty_change', '<', 0)
            ->pluck('id');

        if ($movementIds->isEmpty()) {
            return null;
        }

        $rows = StockCostConsumption::query()
            ->withoutGlobalScopes()
            ->whereIn('stock_movement_id', $movementIds)
            ->orderBy('id')
            ->get();

        if ($rows->isEmpty()) {
            return null;
        }

        $remaining = $qtyIn;
        $costAmount = 0;

        foreach ($rows as $row) {
            if ($remaining <= 0) {
                break;
            }
            $take = min((int) $row->qty, $remaining);
            $layer = StockCostLayer::query()->withoutGlobalScopes()->whereKey($row->stock_cost_layer_id)->lockForUpdate()->first();
            if ($layer) {
                $layer->qty_remaining = (int) $layer->qty_remaining + $take;
                $layer->save();
            }
            $line = $take * (int) $row->unit_cost;
            $costAmount += $line;
            $remaining -= $take;
        }

        if ($remaining === $qtyIn) {
            return null;
        }

        $balance->cost_value = (int) $balance->cost_value + $costAmount;

        if ($remaining > 0) {
            $unit = $costAmount > 0
                ? (int) round($costAmount / ($qtyIn - $remaining))
                : 0;
            $this->inboundLayer($balance, $remaining, $unit, 'opening', (int) $balance->id);
            $costAmount += $remaining * $unit;
        } else {
            $this->refreshLayerAverage($balance);
            $balance->save();
        }

        return [
            'unit_cost' => $qtyIn > 0 ? (int) round($costAmount / $qtyIn) : 0,
            'cost_amount' => $costAmount,
            'consumptions' => [],
        ];
    }

    /**
     * @return array{unit_cost: int, cost_amount: int, consumptions: list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>}
     */
    private function inboundMovingAverage(StockBalance $balance, int $qtyBefore, int $qty, int $unitCost): array
    {
        $value = (int) $balance->cost_value + ($qty * $unitCost);
        $newQty = $qtyBefore + $qty;
        $balance->cost_value = $value;
        $balance->avg_cost = $newQty > 0 ? (int) round($value / $newQty) : $unitCost;
        $balance->save();

        return [
            'unit_cost' => $unitCost,
            'cost_amount' => $qty * $unitCost,
            'consumptions' => [],
        ];
    }

    /**
     * @return array{unit_cost: int, cost_amount: int, consumptions: list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>}
     */
    private function outboundMovingAverage(StockBalance $balance, int $qtyBefore, int $qtyOut): array
    {
        $avg = (int) $balance->avg_cost;
        $costAmount = $avg * $qtyOut;
        $qtyAfter = $qtyBefore - $qtyOut;
        if ($qtyAfter <= 0) {
            $costAmount = (int) $balance->cost_value;
            $balance->cost_value = 0;
        } else {
            $balance->cost_value = max(0, (int) $balance->cost_value - $costAmount);
            $balance->avg_cost = (int) round(((int) $balance->cost_value) / $qtyAfter);
        }
        $balance->save();

        return [
            'unit_cost' => $qtyOut > 0 ? (int) round($costAmount / $qtyOut) : $avg,
            'cost_amount' => $costAmount,
            'consumptions' => [],
        ];
    }

    /**
     * @return array{unit_cost: int, cost_amount: int, consumptions: list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>}
     */
    private function inboundAverage(StockBalance $balance, int $qty, int $unitCost): array
    {
        $balance->period_receipt_qty = (int) $balance->period_receipt_qty + $qty;
        $balance->period_receipt_value = (int) $balance->period_receipt_value + ($qty * $unitCost);
        $balance->cost_value = (int) $balance->cost_value + ($qty * $unitCost);
        $balance->avg_cost = $this->periodRate($balance);
        $balance->save();

        return [
            'unit_cost' => $unitCost,
            'cost_amount' => $qty * $unitCost,
            'consumptions' => [],
        ];
    }

    /**
     * @return array{unit_cost: int, cost_amount: int, consumptions: list<array{layer_id: int, qty: int, unit_cost: int, cost_amount: int}>}
     */
    private function outboundAverage(StockBalance $balance, int $qtyBefore, int $qtyOut): array
    {
        $rate = $this->periodRate($balance);
        $costAmount = $rate * $qtyOut;
        $qtyAfter = $qtyBefore - $qtyOut;
        if ($qtyAfter <= 0) {
            $costAmount = (int) $balance->cost_value;
            $balance->cost_value = 0;
        } else {
            $balance->cost_value = max(0, (int) $balance->cost_value - $costAmount);
        }
        $balance->avg_cost = $rate;
        $balance->save();

        return [
            'unit_cost' => $qtyOut > 0 ? (int) round($costAmount / $qtyOut) : $rate,
            'cost_amount' => $costAmount,
            'consumptions' => [],
        ];
    }

    private function periodRate(StockBalance $balance): int
    {
        $den = (int) $balance->period_opening_qty + (int) $balance->period_receipt_qty;
        if ($den <= 0) {
            return (int) $balance->avg_cost;
        }

        $num = (int) $balance->period_opening_value + (int) $balance->period_receipt_value;

        return (int) round($num / $den);
    }

    private function seedOpeningLayer(StockBalance $balance, Product $product, int $qtyBefore, ?int $inboundUnitCost): void
    {
        if ($qtyBefore <= 0) {
            return;
        }

        $layered = (int) StockCostLayer::query()
            ->withoutGlobalScopes()
            ->where('company_id', $balance->company_id)
            ->where('warehouse_id', $balance->warehouse_id)
            ->where('product_id', $balance->product_id)
            ->sum('qty_remaining');

        $gap = $qtyBefore - $layered;
        if ($gap <= 0) {
            return;
        }

        $unitCost = $this->resolveInboundCost($product, $balance, $inboundUnitCost);
        StockCostLayer::query()->withoutGlobalScopes()->create([
            'company_id' => $balance->company_id,
            'warehouse_id' => $balance->warehouse_id,
            'product_id' => $balance->product_id,
            'qty_original' => $gap,
            'qty_remaining' => $gap,
            'unit_cost' => $unitCost,
            'received_at' => now()->subSecond(),
            'ref_type' => 'opening',
            'ref_id' => $balance->id,
        ]);

        if ((int) $balance->cost_value <= 0) {
            $balance->cost_value = $gap * $unitCost;
            $balance->avg_cost = $unitCost;
            $balance->save();
        }
    }

    private function refreshLayerAverage(StockBalance $balance): void
    {
        $qty = (int) StockCostLayer::query()
            ->withoutGlobalScopes()
            ->where('company_id', $balance->company_id)
            ->where('warehouse_id', $balance->warehouse_id)
            ->where('product_id', $balance->product_id)
            ->sum('qty_remaining');

        if ($qty <= 0) {
            $balance->avg_cost = (int) $balance->avg_cost;

            return;
        }

        $value = (int) $balance->cost_value;
        $balance->avg_cost = $value > 0 ? (int) round($value / $qty) : (int) $balance->avg_cost;
    }

    private function syncProductCost(Product $product, StockBalance $balance): void
    {
        $unit = $this->currentUnitCost($balance, $product);
        if ($unit > 0 && (int) $product->cost_price !== $unit) {
            $product->forceFill(['cost_price' => $unit])->save();
        }
    }
}
