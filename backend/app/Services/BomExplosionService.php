<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductBomItem;
use App\Models\ProductUnit;
use Illuminate\Validation\ValidationException;

class BomExplosionService
{
    private const MAX_DEPTH = 25;

    /**
     * Flat (direct) BOM components that track stock.
     *
     * @return list<array{product_id: int, qty_planned: int, unit: ?string, name_snapshot: string}>
     */
    public function explodeFlat(int $companyId, int $productId, int $qty): array
    {
        if ($qty < 1) {
            throw ValidationException::withMessages(['qty' => ['Qty produksi minimal 1.']]);
        }

        return $this->mapComponents($companyId, $this->directBom($companyId, $productId), $qty);
    }

    /**
     * Recursive leaf explode. Intermediate BOM products that track stock are
     * themselves exploded (not issued) so only raw/trackable leaves are issued.
     * If a component has no BOM, it is treated as a leaf.
     *
     * @return list<array{product_id: int, qty_planned: int, unit: ?string, name_snapshot: string}>
     */
    public function explodeLeaves(int $companyId, int $productId, int $qty): array
    {
        if ($qty < 1) {
            throw ValidationException::withMessages(['qty' => ['Qty produksi minimal 1.']]);
        }

        $totals = [];
        $meta = [];
        $this->walkLeaves($companyId, $productId, (float) $qty, [], 0, $totals, $meta);

        $lines = [];
        foreach ($totals as $componentId => $planned) {
            if ($planned <= 0) {
                continue;
            }
            $lines[] = [
                'product_id' => (int) $componentId,
                'qty_planned' => (int) $planned,
                'unit' => $meta[$componentId]['unit'] ?? null,
                'name_snapshot' => (string) ($meta[$componentId]['name'] ?? '#'.$componentId),
            ];
        }

        usort($lines, fn ($a, $b) => strcmp($a['name_snapshot'], $b['name_snapshot']));

        return $lines;
    }

    /**
     * @param  list<int>  $path
     * @param  array<int, int>  $totals
     * @param  array<int, array{name: string, unit: ?string}>  $meta
     */
    private function walkLeaves(
        int $companyId,
        int $productId,
        float $qtyScale,
        array $path,
        int $depth,
        array &$totals,
        array &$meta,
    ): void {
        if ($depth > self::MAX_DEPTH) {
            throw ValidationException::withMessages(['product_id' => ['BOM terlalu dalam (maks '.self::MAX_DEPTH.' level).']]);
        }
        if (in_array($productId, $path, true)) {
            throw ValidationException::withMessages(['product_id' => ['BOM membentuk siklus saat di-explode.']]);
        }

        $children = $this->directBom($companyId, $productId);
        if ($children->isEmpty()) {
            return;
        }

        $nextPath = [...$path, $productId];
        foreach ($children as $row) {
            /** @var Product|null $component */
            $component = $row->component;
            if (! $component || (int) $component->company_id !== $companyId) {
                continue;
            }
            if (! $component->is_active || ! $component->track_stock) {
                continue;
            }

            $factor = $this->factorToBase($component, $row->unit_id ? (int) $row->unit_id : null);
            $childQty = (float) $row->qty * $factor * $qtyScale;
            $childBom = $this->directBom($companyId, (int) $component->id);
            if ($childBom->isNotEmpty()) {
                $this->walkLeaves($companyId, (int) $component->id, $childQty, $nextPath, $depth + 1, $totals, $meta);

                continue;
            }

            $planned = $this->ceilBaseQty($childQty);
            if ($planned <= 0) {
                continue;
            }
            $id = (int) $component->id;
            $totals[$id] = ($totals[$id] ?? 0) + $planned;
            $meta[$id] = [
                'name' => (string) $component->name,
                'unit' => $component->unit,
            ];
        }
    }

    /**
     * @return \Illuminate\Support\Collection<int, ProductBomItem>
     */
    private function directBom(int $companyId, int $productId)
    {
        return ProductBomItem::query()
            ->withoutGlobalScopes()
            ->with('component:id,name,unit,unit_id,track_stock,is_active,company_id')
            ->where('company_id', $companyId)
            ->where('product_id', $productId)
            ->orderBy('sort_order')
            ->get();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, ProductBomItem>  $bom
     * @return list<array{product_id: int, qty_planned: int, unit: ?string, name_snapshot: string}>
     */
    private function mapComponents(int $companyId, $bom, int $qty): array
    {
        $lines = [];
        foreach ($bom as $row) {
            $component = $row->component;
            if (! $component || (int) $component->company_id !== $companyId) {
                continue;
            }
            if (! $component->is_active || ! $component->track_stock) {
                continue;
            }

            $factor = $this->factorToBase($component, $row->unit_id ? (int) $row->unit_id : null);
            $planned = $this->ceilBaseQty((float) $row->qty * $factor * $qty);
            if ($planned <= 0) {
                continue;
            }
            $lines[] = [
                'product_id' => (int) $component->id,
                'qty_planned' => $planned,
                'unit' => $component->unit,
                'name_snapshot' => (string) $component->name,
            ];
        }

        return $lines;
    }

    /**
     * Resolve BOM line unit to base/small factor using the component's product units.
     */
    private function factorToBase(Product $component, ?int $unitId): int
    {
        if (! $unitId || (int) ($component->unit_id ?? 0) === $unitId) {
            return 1;
        }

        $row = ProductUnit::query()
            ->where('product_id', $component->id)
            ->where('unit_id', $unitId)
            ->first();

        if ($row) {
            return max(1, (int) $row->factor_to_base);
        }

        throw ValidationException::withMessages([
            'bom_items' => ["Satuan BOM untuk {$component->name} tidak cocok dengan satuan produk."],
        ]);
    }

    /**
     * Issue materials with ceil so fractional recipes do not under-consume.
     * Zero after ceil is allowed (no forced minimum of 1).
     */
    private function ceilBaseQty(float $qty): int
    {
        if ($qty <= 0) {
            return 0;
        }

        return (int) max(0, (int) ceil($qty - 1e-12));
    }
}
