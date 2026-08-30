<?php

namespace App\Services;

use App\Models\Company;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\GoodsReceiptLandedCost;
use Illuminate\Validation\ValidationException;

class LandedCostService
{
    public function enabled(?Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_landed_cost_enabled', $company);
    }

    public function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'landed_cost' => ['Landed cost belum diaktifkan di pengaturan procurement.'],
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(GoodsReceiptLandedCost $row): array
    {
        return [
            'id' => $row->id,
            'goods_receipt_id' => $row->goods_receipt_id,
            'freight' => (int) $row->freight,
            'customs' => (int) $row->customs,
            'insurance' => (int) $row->insurance,
            'other' => (int) $row->other,
            'total_extra' => $row->totalExtra(),
            'allocation_method' => $row->allocation_method,
            'applied_at' => $row->applied_at?->toIso8601String(),
        ];
    }

    public function upsert(GoodsReceipt $gr, array $payload): GoodsReceiptLandedCost
    {
        $this->assertEnabled();

        if ($gr->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Landed cost hanya bisa diubah saat GR draft.']]);
        }

        $data = [
            'freight' => max(0, (int) ($payload['freight'] ?? 0)),
            'customs' => max(0, (int) ($payload['customs'] ?? 0)),
            'insurance' => max(0, (int) ($payload['insurance'] ?? 0)),
            'other' => max(0, (int) ($payload['other'] ?? 0)),
            'allocation_method' => in_array($payload['allocation_method'] ?? 'value', ['value', 'qty'], true)
                ? $payload['allocation_method']
                : 'value',
        ];

        return GoodsReceiptLandedCost::query()->updateOrCreate(
            ['company_id' => $gr->company_id, 'goods_receipt_id' => $gr->id],
            $data,
        );
    }

    public function applyToReceipt(GoodsReceipt $gr): void
    {
        if (! $this->enabled()) {
            return;
        }

        $landed = GoodsReceiptLandedCost::query()
            ->where('goods_receipt_id', $gr->id)
            ->whereNull('applied_at')
            ->first();

        if (! $landed || $landed->totalExtra() <= 0) {
            return;
        }

        $items = GoodsReceiptItem::query()->where('goods_receipt_id', $gr->id)->get();
        if ($items->isEmpty()) {
            return;
        }

        $extra = $landed->totalExtra();
        $weights = $this->allocationWeights($items, $landed->allocation_method);
        $weightTotal = array_sum($weights);
        if ($weightTotal <= 0) {
            return;
        }

        $allocated = 0;
        $lastId = $items->last()->id;

        foreach ($items as $item) {
            $share = $item->id === $lastId
                ? $extra - $allocated
                : (int) floor($extra * ($weights[$item->id] / $weightTotal));
            $allocated += $share;

            if ($share <= 0) {
                continue;
            }

            $qty = max(1, (int) $item->qty);
            $addPerUnit = (int) floor($share / $qty);
            $newUnitCost = (int) $item->unit_cost + $addPerUnit;
            $item->update([
                'unit_cost' => $newUnitCost,
                'total' => $newUnitCost * $qty,
            ]);
        }

        $subtotal = (int) GoodsReceiptItem::query()->where('goods_receipt_id', $gr->id)->sum('total');
        $gr->update([
            'subtotal' => $subtotal,
            'total' => $subtotal + (int) ($gr->tax ?? 0),
        ]);

        $landed->update(['applied_at' => now()]);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, GoodsReceiptItem>  $items
     * @return array<int, float|int>
     */
    private function allocationWeights($items, string $method): array
    {
        $weights = [];

        foreach ($items as $item) {
            $weights[$item->id] = $method === 'qty'
                ? max(1, (int) $item->qty)
                : max(1, (int) $item->total);
        }

        return $weights;
    }
}
