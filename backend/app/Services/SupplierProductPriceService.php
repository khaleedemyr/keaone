<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Product;
use App\Models\SupplierProductPrice;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SupplierProductPriceService
{
    public function __construct(
        private ProductUnitService $productUnits,
        private PreferredVendorService $preferredVendors,
    ) {}

    public function enabled(?Company $company = null): bool
    {
        return ProcurementSettings::vendorPriceListEnabled($company);
    }

    public function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'price_list' => ['Daftar harga supplier belum diaktifkan di pengaturan procurement.'],
            ]);
        }
    }

    public function resolveUnitCost(int $supplierId, int $productId, ?string $unitLevel = null, ?string $unit = null): ?int
    {
        if (! $this->enabled() || $supplierId < 1 || $productId < 1) {
            return null;
        }

        $product = Product::query()->find($productId);
        if (! $product) {
            return null;
        }

        $resolved = $this->productUnits->resolveLine($product, $unitLevel, $unit);
        $level = $resolved['level'];

        $today = now()->toDateString();
        $row = SupplierProductPrice::query()
            ->where('supplier_id', $supplierId)
            ->where('product_id', $productId)
            ->where('is_active', true)
            ->where(function ($q) use ($level) {
                $q->whereNull('unit_level')->orWhere('unit_level', $level);
            })
            ->where(function ($q) use ($today) {
                $q->whereNull('valid_from')->orWhereDate('valid_from', '<=', $today);
            })
            ->where(function ($q) use ($today) {
                $q->whereNull('valid_to')->orWhereDate('valid_to', '>=', $today);
            })
            ->orderByRaw('unit_level is null')
            ->orderByDesc('id')
            ->first();

        return $row ? (int) $row->unit_cost : null;
    }

    public function resolvePoUnitCost(int $supplierId, Product $product, array $row, array $resolved): int
    {
        if (array_key_exists('unit_cost', $row) && $row['unit_cost'] !== null && $row['unit_cost'] !== '') {
            return max(0, (int) $row['unit_cost']);
        }

        $fromList = $this->resolveUnitCost(
            $supplierId,
            (int) $product->id,
            $resolved['level'] ?? null,
            $resolved['unit'] ?? null,
        );
        if ($fromList !== null && $fromList > 0) {
            return $fromList;
        }

        $factor = max(1, (int) ($resolved['factor_to_base'] ?? 1));

        return (int) ($product->cost_price ?? 0) * $factor;
    }

    public function create(array $payload): SupplierProductPrice
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($payload) {
            $company = CurrentCompany::company();
            abort_unless($company, 422, 'Pilih perusahaan dulu.');

            $this->preferredVendors->assertSupplier((int) $payload['supplier_id']);
            $product = Product::query()->findOrFail($payload['product_id']);
            $resolved = $this->productUnits->resolveLine(
                $product,
                $payload['unit_level'] ?? null,
                $payload['unit'] ?? null,
            );

            return SupplierProductPrice::query()->create([
                'company_id' => $company->id,
                'supplier_id' => (int) $payload['supplier_id'],
                'product_id' => $product->id,
                'unit_cost' => max(0, (int) ($payload['unit_cost'] ?? 0)),
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'min_qty' => isset($payload['min_qty']) ? (int) $payload['min_qty'] : null,
                'valid_from' => $payload['valid_from'] ?? null,
                'valid_to' => $payload['valid_to'] ?? null,
                'note' => $payload['note'] ?? null,
                'is_active' => array_key_exists('is_active', $payload) ? (bool) $payload['is_active'] : true,
            ])->fresh()->load(['supplier:id,name', 'product:id,name,sku']);
        });
    }

    public function update(SupplierProductPrice $row, array $payload): SupplierProductPrice
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($row, $payload) {
            $updates = [];

            if (array_key_exists('supplier_id', $payload)) {
                $this->preferredVendors->assertSupplier((int) $payload['supplier_id']);
                $updates['supplier_id'] = (int) $payload['supplier_id'];
            }
            if (array_key_exists('product_id', $payload)) {
                $updates['product_id'] = (int) $payload['product_id'];
            }
            if (array_key_exists('unit_cost', $payload)) {
                $updates['unit_cost'] = max(0, (int) $payload['unit_cost']);
            }
            if (array_key_exists('min_qty', $payload)) {
                $updates['min_qty'] = $payload['min_qty'] !== null ? (int) $payload['min_qty'] : null;
            }
            if (array_key_exists('valid_from', $payload)) {
                $updates['valid_from'] = $payload['valid_from'];
            }
            if (array_key_exists('valid_to', $payload)) {
                $updates['valid_to'] = $payload['valid_to'];
            }
            if (array_key_exists('note', $payload)) {
                $updates['note'] = $payload['note'];
            }
            if (array_key_exists('is_active', $payload)) {
                $updates['is_active'] = (bool) $payload['is_active'];
            }

            if (array_key_exists('unit_level', $payload) || array_key_exists('unit', $payload)) {
                $product = Product::query()->findOrFail($payload['product_id'] ?? $row->product_id);
                $resolved = $this->productUnits->resolveLine(
                    $product,
                    $payload['unit_level'] ?? $row->unit_level,
                    $payload['unit'] ?? $row->unit,
                );
                $updates['unit'] = $resolved['unit'];
                $updates['unit_level'] = $resolved['level'];
                $updates['factor_to_base'] = $resolved['factor_to_base'];
            }

            $row->update($updates);

            return $row->fresh()->load(['supplier:id,name', 'product:id,name,sku']);
        });
    }

    public function delete(SupplierProductPrice $row): void
    {
        $this->assertEnabled();
        $row->delete();
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(SupplierProductPrice $row): array
    {
        $row->loadMissing(['supplier:id,name', 'product:id,name,sku']);

        return [
            'id' => $row->id,
            'supplier_id' => $row->supplier_id,
            'supplier' => $row->supplier?->only(['id', 'name']),
            'product_id' => $row->product_id,
            'product' => $row->product?->only(['id', 'name', 'sku']),
            'unit_cost' => $row->unit_cost,
            'unit' => $row->unit,
            'unit_level' => $row->unit_level,
            'factor_to_base' => $row->factor_to_base,
            'min_qty' => $row->min_qty,
            'valid_from' => $row->valid_from?->toDateString(),
            'valid_to' => $row->valid_to?->toDateString(),
            'note' => $row->note,
            'is_active' => $row->is_active,
            'created_at' => $row->created_at?->toIso8601String(),
        ];
    }
}
