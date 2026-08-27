<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\Unit;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ProductUnitService
{
    /**
     * @return list<array{level: string, unit_id: int, unit: array{id: int, name: string, symbol: string|null}|null, label: string, factor_to_base: int}>
     */
    public function serialize(Product $product): array
    {
        $rows = $product->relationLoaded('productUnits')
            ? $product->productUnits
            : $product->productUnits()->with('unitMaster')->get();

        if ($rows->isEmpty() && $product->unit_id) {
            $unit = $product->relationLoaded('unitMaster')
                ? $product->unitMaster
                : Unit::query()->find($product->unit_id);

            return [[
                'level' => ProductUnit::LEVEL_SMALL,
                'unit_id' => (int) $product->unit_id,
                'unit' => $unit ? [
                    'id' => (int) $unit->id,
                    'name' => $unit->name,
                    'symbol' => $unit->symbol,
                ] : null,
                'label' => $unit?->symbol ?: ($unit?->name ?: ($product->unit ?: 'pcs')),
                'factor_to_base' => 1,
            ]];
        }

        return $rows
            ->sortBy(fn (ProductUnit $row) => array_search($row->level, ProductUnit::LEVELS, true))
            ->values()
            ->map(fn (ProductUnit $row) => [
                'level' => $row->level,
                'unit_id' => (int) $row->unit_id,
                'unit' => $row->unitMaster ? [
                    'id' => (int) $row->unitMaster->id,
                    'name' => $row->unitMaster->name,
                    'symbol' => $row->unitMaster->symbol,
                ] : null,
                'label' => $row->label(),
                'factor_to_base' => max(1, (int) $row->factor_to_base),
            ])
            ->all();
    }

    /**
     * @param  list<array{level?: string, unit_id?: int|null, factor_to_base?: int|null}>|null  $rows
     */
    public function sync(Product $product, ?array $rows): void
    {
        if ($rows === null) {
            return;
        }

        $normalized = $this->normalizeRows($product->company_id, $rows);
        $keepLevels = [];

        foreach ($normalized as $row) {
            $keepLevels[] = $row['level'];
            ProductUnit::query()->updateOrCreate(
                [
                    'product_id' => $product->id,
                    'level' => $row['level'],
                ],
                [
                    'company_id' => $product->company_id,
                    'unit_id' => $row['unit_id'],
                    'factor_to_base' => $row['factor_to_base'],
                ],
            );
        }

        ProductUnit::query()
            ->where('product_id', $product->id)
            ->whereNotIn('level', $keepLevels ?: ['__none__'])
            ->delete();

        $small = collect($normalized)->firstWhere('level', ProductUnit::LEVEL_SMALL);
        if ($small) {
            $unit = Unit::query()->find($small['unit_id']);
            $product->forceFill([
                'unit_id' => $small['unit_id'],
                'unit' => $unit?->symbol ?: ($unit?->name ?: 'pcs'),
            ])->save();
        }
    }

    /**
     * Resolve purchase/sale line unit against product conversions.
     *
     * @return array{level: string, unit: string, factor_to_base: int}
     */
    public function resolveLine(Product $product, ?string $level = null, ?string $unitLabel = null): array
    {
        $units = collect($this->serialize($product));
        if ($units->isEmpty()) {
            return [
                'level' => ProductUnit::LEVEL_SMALL,
                'unit' => $product->unit ?: 'pcs',
                'factor_to_base' => 1,
            ];
        }

        $picked = null;
        if ($level) {
            $picked = $units->firstWhere('level', $level);
        }
        if (! $picked && $unitLabel) {
            $picked = $units->first(function (array $row) use ($unitLabel) {
                return $row['label'] === $unitLabel
                    || ($row['unit']['symbol'] ?? null) === $unitLabel
                    || ($row['unit']['name'] ?? null) === $unitLabel;
            });
        }
        if (! $picked) {
            $picked = $units->firstWhere('level', ProductUnit::LEVEL_SMALL) ?? $units->first();
        }

        return [
            'level' => $picked['level'],
            'unit' => $picked['label'],
            'factor_to_base' => max(1, (int) $picked['factor_to_base']),
        ];
    }

    public function toBaseQty(int $qty, int $factorToBase): int
    {
        return $qty * max(1, $factorToBase);
    }

    /**
     * Format base qty using available product units (largest first).
     *
     * @param  list<array{level: string, label: string, factor_to_base: int}>  $units
     */
    public function formatQtyBreakdown(int $baseQty, array $units): string
    {
        if ($units === []) {
            return (string) $baseQty;
        }

        $sorted = collect($units)
            ->sortByDesc(fn (array $row) => (int) $row['factor_to_base'])
            ->values();

        $parts = [];
        $remain = abs($baseQty);
        foreach ($sorted as $row) {
            $factor = max(1, (int) $row['factor_to_base']);
            if ($factor <= 1 && $sorted->count() > 1 && $row !== $sorted->last()) {
                continue;
            }
            $count = intdiv($remain, $factor);
            if ($count > 0) {
                $parts[] = $count.' '.$row['label'];
                $remain -= $count * $factor;
            }
        }
        if ($remain > 0) {
            $small = $sorted->firstWhere('level', ProductUnit::LEVEL_SMALL) ?? $sorted->last();
            $parts[] = $remain.' '.($small['label'] ?? 'pcs');
        }

        $text = $parts === [] ? '0 '.($sorted->last()['label'] ?? 'pcs') : implode(' + ', $parts);

        return $baseQty < 0 ? '-'.$text : $text;
    }

    /**
     * @param  list<array{level?: string, unit_id?: int|null, factor_to_base?: int|null}>  $rows
     * @return list<array{level: string, unit_id: int, factor_to_base: int}>
     */
    private function normalizeRows(int $companyId, array $rows): array
    {
        /** @var Collection<int, array{level: string, unit_id: int, factor_to_base: int}> $byLevel */
        $byLevel = collect();

        foreach ($rows as $i => $row) {
            $level = (string) ($row['level'] ?? '');
            if (! in_array($level, ProductUnit::LEVELS, true)) {
                throw ValidationException::withMessages([
                    "units.$i.level" => ['Level unit harus small, medium, atau large.'],
                ]);
            }
            if ($byLevel->has($level)) {
                throw ValidationException::withMessages([
                    'units' => ['Setiap level unit hanya boleh satu.'],
                ]);
            }

            $unitId = isset($row['unit_id']) && $row['unit_id'] ? (int) $row['unit_id'] : null;
            if (! $unitId) {
                continue;
            }

            $exists = Unit::query()
                ->where('company_id', $companyId)
                ->whereKey($unitId)
                ->exists();
            if (! $exists) {
                throw ValidationException::withMessages([
                    "units.$i.unit_id" => ['Satuan tidak valid.'],
                ]);
            }

            $factor = max(1, (int) ($row['factor_to_base'] ?? 1));
            if ($level === ProductUnit::LEVEL_SMALL) {
                $factor = 1;
            }

            $byLevel->put($level, [
                'level' => $level,
                'unit_id' => $unitId,
                'factor_to_base' => $factor,
            ]);
        }

        if (! $byLevel->has(ProductUnit::LEVEL_SMALL)) {
            throw ValidationException::withMessages([
                'units' => ['Unit small (dasar) wajib diisi.'],
            ]);
        }

        if ($byLevel->has(ProductUnit::LEVEL_LARGE) && ! $byLevel->has(ProductUnit::LEVEL_MEDIUM)) {
            throw ValidationException::withMessages([
                'units' => ['Isi unit medium sebelum large.'],
            ]);
        }

        $smallFactor = 1;
        $medium = $byLevel->get(ProductUnit::LEVEL_MEDIUM);
        if ($medium && $medium['factor_to_base'] <= $smallFactor) {
            throw ValidationException::withMessages([
                'units' => ['Faktor medium harus lebih besar dari 1 (isi ke small).'],
            ]);
        }

        $large = $byLevel->get(ProductUnit::LEVEL_LARGE);
        if ($large && $medium && $large['factor_to_base'] <= $medium['factor_to_base']) {
            throw ValidationException::withMessages([
                'units' => ['Faktor large harus lebih besar dari medium (isi ke small).'],
            ]);
        }

        return $byLevel
            ->sortBy(fn (array $row) => array_search($row['level'], ProductUnit::LEVELS, true))
            ->values()
            ->all();
    }
}
