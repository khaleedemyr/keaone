<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\Company;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Support\ProcurementSettings;
use Illuminate\Support\Facades\DB;

class AssetService
{
    public function registerFromGrItem(
        GoodsReceipt $gr,
        GoodsReceiptItem $item,
        Product $product,
    ): void {
        if (! $product->is_fixed_asset_item) {
            return;
        }

        $factor = max(1, (int) ($item->factor_to_base ?: 1));
        // Satu kartu aset per unit dasar (pcs), bukan per unit kemasan PO/GR.
        $baseQty = max(1, (int) $item->qty * $factor);
        $unitCost = (int) $item->unit_cost;
        $costPerBase = $factor > 1 ? (int) round($unitCost / $factor) : $unitCost;
        $acquiredAt = $gr->received_at ?? now();
        $autoSerial = ProcurementSettings::fixedAssetAutoSerialEnabled(
            Company::query()->find($gr->company_id)
        );

        for ($i = 0; $i < $baseQty; $i++) {
            Asset::query()->create([
                'company_id' => $gr->company_id,
                'number' => $this->nextNumber((int) $gr->company_id),
                'product_id' => $product->id,
                'goods_receipt_id' => $gr->id,
                'goods_receipt_item_id' => $item->id,
                'outlet_id' => $gr->outlet_id,
                'name_snapshot' => $item->name_snapshot ?: $product->name,
                'acquisition_cost' => max(0, $costPerBase),
                'status' => 'active',
                'serial_number' => $autoSerial ? $this->nextSerial((int) $gr->company_id) : null,
                'acquired_at' => $acquiredAt,
            ]);
        }
    }

    public function voidForGr(GoodsReceipt $gr): void
    {
        Asset::query()
            ->where('company_id', $gr->company_id)
            ->where('goods_receipt_id', $gr->id)
            ->where('status', 'active')
            ->update(['status' => 'voided']);
    }

    public function serialize(Asset $asset): array
    {
        $asset->loadMissing(['product:id,name,sku', 'outlet:id,name', 'custodian:id,name']);

        return [
            'id' => $asset->id,
            'number' => $asset->number,
            'product_id' => $asset->product_id,
            'product' => $asset->product?->only(['id', 'name', 'sku']),
            'goods_receipt_id' => $asset->goods_receipt_id,
            'goods_receipt_item_id' => $asset->goods_receipt_item_id,
            'outlet_id' => $asset->outlet_id,
            'outlet' => $asset->outlet?->only(['id', 'name']),
            'name_snapshot' => $asset->name_snapshot,
            'acquisition_cost' => (int) $asset->acquisition_cost,
            'status' => $asset->status,
            'serial_number' => $asset->serial_number,
            'location' => $asset->location,
            'custodian_user_id' => $asset->custodian_user_id,
            'custodian' => $asset->custodian?->only(['id', 'name']),
            'acquired_at' => $asset->acquired_at?->toDateString(),
            'note' => $asset->note,
            'created_at' => $asset->created_at?->toIso8601String(),
        ];
    }

    public function nextNumber(int $companyId): string
    {
        return DB::transaction(function () use ($companyId) {
            $prefix = 'AST-'.now()->format('ymd').'-';
            $last = Asset::query()
                ->where('company_id', $companyId)
                ->where('number', 'like', $prefix.'%')
                ->lockForUpdate()
                ->orderByDesc('id')
                ->value('number');

            $seq = 1;
            if (is_string($last) && preg_match('/-(\d+)$/', $last, $matches)) {
                $seq = (int) $matches[1] + 1;
            }

            return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
        });
    }

    public function nextSerial(int $companyId): string
    {
        return DB::transaction(function () use ($companyId) {
            $prefix = 'SN-'.now()->format('ymd').'-';
            $last = Asset::query()
                ->where('company_id', $companyId)
                ->where('serial_number', 'like', $prefix.'%')
                ->lockForUpdate()
                ->orderByDesc('id')
                ->value('serial_number');

            $seq = 1;
            if (is_string($last) && preg_match('/-(\d+)$/', $last, $matches)) {
                $seq = (int) $matches[1] + 1;
            }

            return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
        });
    }
}
