<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductBomItem;
use App\Models\Unit;
use Illuminate\Database\Seeder;

/**
 * Seeds one trackable finished-good + BOM for Toko Demo (company_id=1)
 * so Prep/produksi UI and inventory QA can pick a has_bom product.
 */
class QaInventoryBomSeeder extends Seeder
{
    public function run(): void
    {
        $companyId = 1;

        $unit = Unit::query()
            ->where('company_id', $companyId)
            ->orderBy('id')
            ->first();

        if (! $unit) {
            $this->command?->warn('QaInventoryBomSeeder: no units for company 1');

            return;
        }

        $air = Product::query()
            ->where('company_id', $companyId)
            ->where('sku', 'MIN-001')
            ->first();
        $second = Product::query()
            ->where('company_id', $companyId)
            ->where('track_stock', true)
            ->where('id', '!=', $air?->id)
            ->where(function ($q) {
                $q->where('sku', 'like', 'DMD-%')->orWhere('sku', 'MAK-001')->orWhere('sku', 'SEM-001');
            })
            ->orderBy('id')
            ->first();

        if (! $air || ! $second) {
            $this->command?->warn('QaInventoryBomSeeder: missing stocked components');

            return;
        }

        $fg = Product::query()->updateOrCreate(
            ['company_id' => $companyId, 'sku' => 'PKT-QA-001'],
            [
                'name' => 'Paket QA Produksi',
                'barcode' => '8991002199001',
                'type' => 'goods',
                'unit' => $unit->symbol ?: $unit->name ?: 'pcs',
                'unit_id' => $unit->id,
                'sell_price' => 15000,
                'cost_price' => 10000,
                'track_stock' => true,
                'is_active' => true,
            ],
        );

        // Replace BOM with components that typically have stock in demo WH
        ProductBomItem::query()->where('product_id', $fg->id)->delete();

        foreach ([[$air, 1], [$second, 1]] as $i => [$comp, $qty]) {
            ProductBomItem::query()->create([
                'product_id' => $fg->id,
                'component_id' => $comp->id,
                'company_id' => $companyId,
                'qty' => $qty,
                'unit_id' => $comp->unit_id ?: $unit->id,
                'sort_order' => $i,
            ]);
        }

        $this->command?->info("QaInventoryBomSeeder: {$fg->name} (#{$fg->id}) with ".$fg->bomItems()->count().' BOM lines');
    }
}
