<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StockProduction;
use App\Models\StockProductionItem;
use App\Models\StockProductionStep;
use App\Models\StockSerial;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use App\Support\InventoryOps;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockProductionService
{
    public function __construct(
        private InventoryService $inventory,
        private BomExplosionService $bom,
        private LotLedgerService $lots,
        private ProductUnitService $productUnits,
        private DocumentSequenceService $documentSequences,
    ) {}

    /**
     * @return array{product: array<string, mixed>, items: list<array<string, mixed>>, manufacturing: bool, multilevel: bool}
     */
    public function preview(int $productId, int $qty, ?string $unitLevel = null): array
    {
        $company = CurrentCompany::company();
        if (! $company) {
            throw ValidationException::withMessages(['company' => ['Perusahaan tidak aktif.']]);
        }

        $product = $this->assertOutputProduct($company->id, $productId);
        $resolved = $this->productUnits->resolveInventoryLine($product, $qty, $unitLevel);
        $baseQty = $resolved['qty_base'];
        $manufacturing = $this->manufacturingEnabled();
        $items = $this->buildBomLines($company->id, $product, $baseQty, $manufacturing);

        if ($items === []) {
            throw ValidationException::withMessages(['product_id' => ['Produk belum punya BOM dengan komponen yang dilacak stoknya.']]);
        }

        return [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'unit' => $product->unit,
                'units' => $this->productUnits->serialize($product),
            ],
            'qty' => $baseQty,
            'qty_input' => $resolved['qty_input'],
            'unit' => $resolved['unit'],
            'unit_level' => $resolved['level'],
            'factor_to_base' => $resolved['factor_to_base'],
            'manufacturing' => $manufacturing,
            'multilevel' => $manufacturing,
            'items' => $items,
            'default_steps' => $manufacturing ? InventoryOps::defaultProductionSteps() : [],
        ];
    }

    public function create(array $payload, User $user): StockProduction
    {
        $existing = StockProduction::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->load($existing);
        }

        try {
            return DB::transaction(fn () => $this->write($payload, $user));
        } catch (UniqueConstraintViolationException) {
            return $this->load(StockProduction::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail());
        }
    }

    public function update(StockProduction $production, array $payload): StockProduction
    {
        return DB::transaction(function () use ($production, $payload) {
            $production = StockProduction::query()->withoutGlobalScopes()->whereKey($production->id)->lockForUpdate()->firstOrFail();
            $this->assertDraft($production);

            $companyId = (int) $production->company_id;
            $warehouseId = (int) ($payload['warehouse_id'] ?? $production->warehouse_id);
            $warehouse = $this->assertWarehouse($companyId, $warehouseId);
            $productId = (int) ($payload['product_id'] ?? $production->product_id);
            $product = $this->assertOutputProduct($companyId, $productId);
            $hasQty = array_key_exists('qty', $payload);
            $hasUnit = array_key_exists('unit_level', $payload);
            $resolved = $this->productUnits->resolveInventoryLine(
                $product,
                $hasQty ? (int) $payload['qty'] : (int) ($production->qty_input ?? $production->qty),
                $hasUnit
                    ? ($payload['unit_level'] !== null ? (string) $payload['unit_level'] : null)
                    : ($production->unit_level ?: null),
            );
            $qty = $resolved['qty_base'];
            $manufacturing = $this->manufacturingEnabled();
            $rebuildBom = isset($payload['product_id']) || $hasQty || $hasUnit || isset($payload['warehouse_id']);

            $scrapQty = $manufacturing ? (int) ($payload['scrap_qty'] ?? $production->scrap_qty ?? 0) : 0;
            $lotCode = $manufacturing
                ? (array_key_exists('lot_code', $payload) ? $payload['lot_code'] : $production->lot_code)
                : null;
            $trackSerial = $manufacturing
                ? (bool) ($payload['track_serial'] ?? $production->track_serial ?? false)
                : false;

            if ($scrapQty < 0 || $scrapQty >= $qty) {
                throw ValidationException::withMessages(['scrap_qty' => ['Scrap harus ≥ 0 dan lebih kecil dari qty hasil.']]);
            }

            $production->update([
                'warehouse_id' => $warehouse->id,
                'outlet_id' => $warehouse->outlet_id,
                'product_id' => $product->id,
                'qty' => $qty,
                'qty_input' => $resolved['qty_input'],
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'scrap_qty' => $scrapQty,
                'lot_code' => $lotCode ? (string) $lotCode : null,
                'track_serial' => $trackSerial,
                'product_name_snapshot' => $product->name,
                'note' => array_key_exists('note', $payload) ? $payload['note'] : $production->note,
            ]);

            if ($rebuildBom) {
                $lines = $this->buildBomLines($companyId, $product, $qty, $manufacturing);
                if ($lines === []) {
                    throw ValidationException::withMessages(['product_id' => ['Produk belum punya BOM dengan komponen yang dilacak stoknya.']]);
                }
                $production->items()->delete();
                $this->attachItems($production, $lines);
            }

            if ($manufacturing && isset($payload['items']) && is_array($payload['items'])) {
                $this->applyActuals($production->fresh(), $payload['items']);
            }

            if ($manufacturing && isset($payload['steps']) && is_array($payload['steps'])) {
                $this->syncSteps($production->fresh(), $payload['steps']);
            }

            return $this->load($production->fresh());
        });
    }

    public function completeStep(StockProduction $production, int $stepId, ?string $note = null): StockProduction
    {
        if (! $this->manufacturingEnabled()) {
            throw ValidationException::withMessages(['module' => ['Modul work order belum aktif.']]);
        }

        return DB::transaction(function () use ($production, $stepId, $note) {
            $production = StockProduction::query()->withoutGlobalScopes()->whereKey($production->id)->lockForUpdate()->firstOrFail();
            $this->assertDraft($production);

            $step = StockProductionStep::query()
                ->where('stock_production_id', $production->id)
                ->whereKey($stepId)
                ->lockForUpdate()
                ->firstOrFail();

            $step->update([
                'status' => 'done',
                'done_at' => now(),
                'note' => $note ?? $step->note,
            ]);

            return $this->load($production->fresh());
        });
    }

    public function confirm(StockProduction $production, array $payload = []): StockProduction
    {
        if ($production->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
        }
        if ($production->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Produksi belum punya komponen.']]);
        }

        return DB::transaction(function () use ($production, $payload) {
            $production = StockProduction::query()->withoutGlobalScopes()->whereKey($production->id)->lockForUpdate()->firstOrFail();
            if ($production->status !== 'draft') {
                throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
            }

            $manufacturing = $this->manufacturingEnabled();
            $scrapQty = $manufacturing ? (int) ($production->scrap_qty ?? 0) : 0;
            $outputQty = (int) $production->qty;
            $goodQty = $outputQty - $scrapQty;
            if ($goodQty < 1) {
                throw ValidationException::withMessages(['scrap_qty' => ['Qty hasil bersih harus minimal 1.']]);
            }

            if ($manufacturing) {
                $pending = $production->steps()->where('status', '!=', 'done')->count();
                if ($pending > 0) {
                    throw ValidationException::withMessages(['steps' => ['Selesaikan semua langkah routing sebelum konfirmasi.']]);
                }
            }

            $serials = [];
            if ($manufacturing && $production->track_serial) {
                $serials = array_values(array_filter(array_map(
                    fn ($s) => trim((string) $s),
                    $payload['serials'] ?? [],
                )));
                if (count($serials) !== $goodQty) {
                    throw ValidationException::withMessages([
                        'serials' => ["Jumlah serial harus sama dengan qty bersih ({$goodQty})."],
                    ]);
                }
                if (count($serials) !== count(array_unique($serials))) {
                    throw ValidationException::withMessages(['serials' => ['Serial tidak boleh dobel.']]);
                }
            }

            $lotSuffix = $manufacturing && $production->lot_code
                ? ' / lot '.$production->lot_code
                : '';

            $totalIssueCost = 0;
            foreach ($production->items as $item) {
                $qty = $manufacturing
                    ? (int) ($item->qty_actual ?? $item->qty_planned)
                    : (int) $item->qty_planned;
                if ($qty <= 0) {
                    continue;
                }

                $result = $this->inventory->adjust(
                    (int) $production->company_id,
                    (int) $production->warehouse_id,
                    (int) $item->product_id,
                    -$qty,
                    InventoryOps::TYPE_PRODUCTION_ISSUE,
                    InventoryOps::PRODUCTION_REF,
                    (int) $production->id,
                    $production->number.' / issue'.$lotSuffix,
                    $production->outlet_id ? (int) $production->outlet_id : null,
                    [
                        'qty_input' => $qty,
                        'unit' => $item->unit,
                        'unit_level' => 'small',
                        'factor_to_base' => 1,
                    ],
                );

                $totalIssueCost += abs((int) $result->costAmount);

                if ($manufacturing && $item->qty_actual === null) {
                    $item->update(['qty_actual' => $qty]);
                }
            }

            $unitCost = $goodQty > 0 ? (int) intdiv($totalIssueCost, $goodQty) : 0;
            $remainder = $totalIssueCost - ($unitCost * $goodQty);

            if ($remainder !== 0 && $goodQty > 1) {
                $this->inventory->adjust(
                    (int) $production->company_id,
                    (int) $production->warehouse_id,
                    (int) $production->product_id,
                    $goodQty - 1,
                    InventoryOps::TYPE_PRODUCTION_RECEIPT,
                    InventoryOps::PRODUCTION_REF,
                    (int) $production->id,
                    $production->number.' / receipt'.$lotSuffix,
                    $production->outlet_id ? (int) $production->outlet_id : null,
                    [
                        'qty_input' => $goodQty - 1,
                        'unit' => null,
                        'unit_level' => 'small',
                        'factor_to_base' => 1,
                    ],
                    $unitCost,
                );
                $this->inventory->adjust(
                    (int) $production->company_id,
                    (int) $production->warehouse_id,
                    (int) $production->product_id,
                    1,
                    InventoryOps::TYPE_PRODUCTION_RECEIPT,
                    InventoryOps::PRODUCTION_REF,
                    (int) $production->id,
                    $production->number.' / receipt'.$lotSuffix,
                    $production->outlet_id ? (int) $production->outlet_id : null,
                    [
                        'qty_input' => 1,
                        'unit' => null,
                        'unit_level' => 'small',
                        'factor_to_base' => 1,
                    ],
                    $unitCost + $remainder,
                );
            } else {
                $this->inventory->adjust(
                    (int) $production->company_id,
                    (int) $production->warehouse_id,
                    (int) $production->product_id,
                    $goodQty,
                    InventoryOps::TYPE_PRODUCTION_RECEIPT,
                    InventoryOps::PRODUCTION_REF,
                    (int) $production->id,
                    $production->number.' / receipt'.$lotSuffix,
                    $production->outlet_id ? (int) $production->outlet_id : null,
                    [
                        'qty_input' => $goodQty,
                        'unit' => null,
                        'unit_level' => 'small',
                        'factor_to_base' => 1,
                    ],
                    $unitCost + $remainder,
                );
            }

            $receiptUnitCost = $goodQty > 0 ? (int) round($totalIssueCost / $goodQty) : 0;

            if ($manufacturing && $production->lot_code) {
                $this->lots->receive(
                    (int) $production->company_id,
                    (int) $production->warehouse_id,
                    (int) $production->product_id,
                    (string) $production->lot_code,
                    $goodQty,
                    $receiptUnitCost,
                    InventoryOps::PRODUCTION_REF,
                    (int) $production->id,
                    $production->number.' / lot receipt',
                );
            }

            if ($serials !== []) {
                foreach ($serials as $serial) {
                    StockSerial::query()->create([
                        'company_id' => $production->company_id,
                        'warehouse_id' => $production->warehouse_id,
                        'product_id' => $production->product_id,
                        'serial_number' => $serial,
                        'lot_code' => $production->lot_code,
                        'status' => 'available',
                        'stock_production_id' => $production->id,
                    ]);
                }
            }

            $updated = StockProduction::query()
                ->withoutGlobalScopes()
                ->whereKey($production->id)
                ->where('status', 'draft')
                ->update([
                    'status' => 'confirmed',
                    'confirmed_at' => now(),
                ]);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
            }

            return $this->load($production->fresh());
        });
    }

    public function void(StockProduction $production, User $user, ?string $reason = null): StockProduction
    {
        if ($production->status !== 'confirmed') {
            throw ValidationException::withMessages(['status' => ['Hanya produksi confirmed yang bisa di-void.']]);
        }

        return DB::transaction(function () use ($production, $user, $reason) {
            $production = StockProduction::query()->withoutGlobalScopes()->whereKey($production->id)->lockForUpdate()->firstOrFail();
            if ($production->status !== 'confirmed') {
                throw ValidationException::withMessages(['status' => ['Hanya produksi confirmed yang bisa di-void.']]);
            }

            $manufacturing = $this->manufacturingEnabled();
            $scrapQty = $manufacturing ? (int) ($production->scrap_qty ?? 0) : 0;
            $goodQty = (int) $production->qty - $scrapQty;
            $lotSuffix = $production->lot_code ? ' / lot '.$production->lot_code : '';

            if ($production->track_serial) {
                $serials = StockSerial::query()
                    ->withoutGlobalScopes()
                    ->where('stock_production_id', $production->id)
                    ->lockForUpdate()
                    ->get();
                if ($serials->count() !== $goodQty) {
                    throw ValidationException::withMessages([
                        'serials' => ['Jumlah serial produksi tidak cocok dengan qty bersih; void dibatalkan.'],
                    ]);
                }
                if ($serials->contains(fn (StockSerial $s) => $s->status !== 'available')) {
                    throw ValidationException::withMessages([
                        'serials' => ['Sebagian serial sudah dipakai/terjual, sehingga produksi tidak bisa di-void.'],
                    ]);
                }
            }

            // Reverse FG receipt first (outbound with reverseCosting).
            $this->inventory->adjust(
                (int) $production->company_id,
                (int) $production->warehouse_id,
                (int) $production->product_id,
                -$goodQty,
                InventoryOps::TYPE_PRODUCTION_VOID_RECEIPT,
                InventoryOps::PRODUCTION_REF,
                (int) $production->id,
                $production->number.' / void receipt'.$lotSuffix,
                $production->outlet_id ? (int) $production->outlet_id : null,
                [
                    'qty_input' => $goodQty,
                    'unit' => null,
                    'unit_level' => 'small',
                    'factor_to_base' => 1,
                ],
                null,
                true,
            );

            if ($production->lot_code) {
                $this->lots->reverseReceipt(
                    (int) $production->company_id,
                    (int) $production->warehouse_id,
                    (int) $production->product_id,
                    (string) $production->lot_code,
                    $goodQty,
                    InventoryOps::PRODUCTION_REF,
                    (int) $production->id,
                    $production->number.' / void lot',
                );
            }

            if ($production->track_serial) {
                $voided = StockSerial::query()
                    ->withoutGlobalScopes()
                    ->where('stock_production_id', $production->id)
                    ->where('status', 'available')
                    ->update(['status' => 'voided']);
                if ($voided !== $goodQty) {
                    throw ValidationException::withMessages([
                        'serials' => ['Serial berubah saat void; transaksi dibatalkan.'],
                    ]);
                }
            }

            // Restore components.
            foreach ($production->items as $item) {
                $qty = $manufacturing
                    ? (int) ($item->qty_actual ?? $item->qty_planned)
                    : (int) $item->qty_planned;
                if ($qty <= 0) {
                    continue;
                }

                $this->inventory->adjust(
                    (int) $production->company_id,
                    (int) $production->warehouse_id,
                    (int) $item->product_id,
                    $qty,
                    InventoryOps::TYPE_PRODUCTION_VOID_ISSUE,
                    InventoryOps::PRODUCTION_REF,
                    (int) $production->id,
                    $production->number.' / void issue'.$lotSuffix,
                    $production->outlet_id ? (int) $production->outlet_id : null,
                    [
                        'qty_input' => $qty,
                        'unit' => $item->unit,
                        'unit_level' => 'small',
                        'factor_to_base' => 1,
                    ],
                    null,
                    true,
                );
            }

            $updated = StockProduction::query()
                ->withoutGlobalScopes()
                ->whereKey($production->id)
                ->where('status', 'confirmed')
                ->update([
                    'status' => 'voided',
                    'voided_at' => now(),
                    'voided_by' => $user->id,
                    'void_reason' => $reason,
                ]);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Hanya produksi confirmed yang bisa di-void.']]);
            }

            return $this->load($production->fresh());
        });
    }

    public function cancel(StockProduction $production): StockProduction
    {
        return DB::transaction(function () use ($production) {
            $production = StockProduction::query()->withoutGlobalScopes()->whereKey($production->id)->lockForUpdate()->firstOrFail();
            $this->assertDraft($production);

            $updated = StockProduction::query()
                ->withoutGlobalScopes()
                ->whereKey($production->id)
                ->where('status', 'draft')
                ->update(['status' => 'cancelled']);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['status' => ['Dokumen hanya bisa diubah saat draft.']]);
            }

            return $this->load($production->fresh());
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(StockProduction $production): array
    {
        $production = $this->load($production);
        $manufacturing = $this->manufacturingEnabled();

        return [
            'id' => $production->id,
            'number' => $production->number,
            'client_uuid' => $production->client_uuid,
            'status' => $production->status,
            'qty' => (int) $production->qty,
            'qty_input' => $production->qty_input !== null ? (int) $production->qty_input : (int) $production->qty,
            'unit' => $production->unit,
            'unit_level' => $production->unit_level ?: 'small',
            'factor_to_base' => max(1, (int) $production->factor_to_base),
            'base_unit' => $production->product?->unit,
            'scrap_qty' => (int) ($production->scrap_qty ?? 0),
            'lot_code' => $production->lot_code,
            'track_serial' => (bool) ($production->track_serial ?? false),
            'note' => $production->note,
            'warehouse_id' => $production->warehouse_id,
            'warehouse' => $production->warehouse?->only(['id', 'name']),
            'outlet_id' => $production->outlet_id,
            'product_id' => $production->product_id,
            'product_name' => $production->product_name_snapshot,
            'product' => $production->product?->only(['id', 'name', 'sku', 'unit']),
            'manufacturing' => $manufacturing,
            'confirmed_at' => $production->confirmed_at?->toIso8601String(),
            'voided_at' => $production->voided_at?->toIso8601String(),
            'void_reason' => $production->void_reason,
            'created_at' => $production->created_at?->toIso8601String(),
            'user' => $production->user?->only(['id', 'name']),
            'items' => $production->items->map(function (StockProductionItem $item) {
                $planned = (int) $item->qty_planned;
                $actual = $item->qty_actual !== null ? (int) $item->qty_actual : null;

                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'name_snapshot' => $item->name_snapshot,
                    'qty_planned' => $planned,
                    'qty_actual' => $actual,
                    'qty_variance' => $actual === null ? 0 : $actual - $planned,
                    'unit' => $item->unit,
                ];
            })->values()->all(),
            'steps' => $production->steps->map(fn (StockProductionStep $step) => [
                'id' => $step->id,
                'sort_order' => (int) $step->sort_order,
                'name' => $step->name,
                'status' => $step->status,
                'done_at' => $step->done_at?->toIso8601String(),
                'note' => $step->note,
            ])->values()->all(),
            'serials' => $production->serials->map(fn (StockSerial $serial) => [
                'id' => $serial->id,
                'serial_number' => $serial->serial_number,
                'lot_code' => $serial->lot_code,
                'status' => $serial->status,
            ])->values()->all(),
        ];
    }

    public function manufacturingEnabled(): bool
    {
        return CurrentCompany::hasModule('work_order');
    }

    private function write(array $payload, User $user): StockProduction
    {
        $company = CurrentCompany::company();
        if (! $company) {
            throw ValidationException::withMessages(['company' => ['Perusahaan tidak aktif.']]);
        }

        $warehouse = $this->assertWarehouse($company->id, (int) $payload['warehouse_id']);
        $product = $this->assertOutputProduct($company->id, (int) $payload['product_id']);
        $resolved = $this->productUnits->resolveInventoryLine(
            $product,
            (int) $payload['qty'],
            isset($payload['unit_level']) ? (string) $payload['unit_level'] : null,
        );
        $qty = $resolved['qty_base'];
        $manufacturing = $this->manufacturingEnabled();
        $scrapQty = $manufacturing ? (int) ($payload['scrap_qty'] ?? 0) : 0;
        $lotCode = $manufacturing ? ($payload['lot_code'] ?? null) : null;
        $trackSerial = $manufacturing ? (bool) ($payload['track_serial'] ?? false) : false;

        if ($scrapQty < 0 || $scrapQty >= $qty) {
            throw ValidationException::withMessages(['scrap_qty' => ['Scrap harus ≥ 0 dan lebih kecil dari qty hasil.']]);
        }

        $lines = $this->buildBomLines($company->id, $product, $qty, $manufacturing);
        if ($lines === []) {
            throw ValidationException::withMessages(['product_id' => ['Produk belum punya BOM dengan komponen yang dilacak stoknya.']]);
        }

        $production = StockProduction::query()->create([
            'company_id' => $company->id,
            'warehouse_id' => $warehouse->id,
            'outlet_id' => $warehouse->outlet_id,
            'user_id' => $user->id,
            'product_id' => $product->id,
            'number' => $this->documentSequences->next($company->id, 'stock_production', 'PRD', 4),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'qty' => $qty,
            'qty_input' => $resolved['qty_input'],
            'unit' => $resolved['unit'],
            'unit_level' => $resolved['level'],
            'factor_to_base' => $resolved['factor_to_base'],
            'scrap_qty' => $scrapQty,
            'lot_code' => $lotCode ? (string) $lotCode : null,
            'track_serial' => $trackSerial,
            'product_name_snapshot' => $product->name,
            'note' => $payload['note'] ?? null,
        ]);

        $this->attachItems($production, $lines);

        if ($manufacturing) {
            if (isset($payload['items']) && is_array($payload['items'])) {
                $this->applyActuals($production->fresh(), $payload['items']);
            }
            $steps = isset($payload['steps']) && is_array($payload['steps']) && $payload['steps'] !== []
                ? $payload['steps']
                : array_map(fn ($name, $i) => ['name' => $name, 'sort_order' => $i], InventoryOps::defaultProductionSteps(), array_keys(InventoryOps::defaultProductionSteps()));
            $this->syncSteps($production->fresh(), $steps);
        }

        return $this->load($production->fresh());
    }

    /**
     * @param  list<array<string, mixed>>  $lines
     */
    private function attachItems(StockProduction $production, array $lines): void
    {
        foreach ($lines as $row) {
            StockProductionItem::query()->create([
                'company_id' => $production->company_id,
                'stock_production_id' => $production->id,
                'product_id' => $row['product_id'],
                'qty_planned' => $row['qty_planned'],
                'qty_actual' => $row['qty_actual'] ?? $row['qty_planned'],
                'unit' => $row['unit'],
                'name_snapshot' => $row['name_snapshot'],
            ]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function applyActuals(StockProduction $production, array $items): void
    {
        $byProduct = [];
        foreach ($items as $row) {
            if (! isset($row['product_id'])) {
                continue;
            }
            $byProduct[(int) $row['product_id']] = max(0, (int) ($row['qty_actual'] ?? $row['qty_planned'] ?? 0));
        }

        foreach ($production->items as $item) {
            if (! array_key_exists((int) $item->product_id, $byProduct)) {
                continue;
            }
            $item->update(['qty_actual' => $byProduct[(int) $item->product_id]]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $steps
     */
    private function syncSteps(StockProduction $production, array $steps): void
    {
        $production->steps()->delete();
        foreach (array_values($steps) as $i => $row) {
            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            // Status transitions only via completeStep — payload cannot mark done.
            StockProductionStep::query()->create([
                'company_id' => $production->company_id,
                'stock_production_id' => $production->id,
                'sort_order' => (int) ($row['sort_order'] ?? $i),
                'name' => $name,
                'status' => 'pending',
                'done_at' => null,
                'note' => $row['note'] ?? null,
            ]);
        }
    }

    /**
     * @return list<array{product_id: int, qty_planned: int, unit: ?string, name_snapshot: string}>
     */
    private function buildBomLines(int $companyId, Product $product, int $qty, bool $manufacturing): array
    {
        return $manufacturing
            ? $this->bom->explodeLeaves($companyId, $product->id, $qty)
            : $this->bom->explodeFlat($companyId, $product->id, $qty);
    }

    private function assertDraft(StockProduction $production): void
    {
        if ($production->status !== 'draft') {
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

    private function assertOutputProduct(int $companyId, int $productId): Product
    {
        $product = Product::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($productId)
            ->first();

        if (! $product || ! $product->is_active) {
            throw ValidationException::withMessages(['product_id' => ['Produk hasil tidak valid.']]);
        }
        if (! $product->track_stock) {
            throw ValidationException::withMessages(['product_id' => ['Produk hasil harus dilacak stoknya (semi-finished / prep).']]);
        }

        return $product;
    }

    private function load(StockProduction $production): StockProduction
    {
        return $production->load([
            'items',
            'steps',
            'serials',
            'warehouse:id,name',
            'user:id,name',
            'product:id,name,sku,unit',
        ]);
    }
}
