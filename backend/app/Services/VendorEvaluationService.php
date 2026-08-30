<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\GoodsReceipt;
use App\Models\PurchaseOrder;

class VendorEvaluationService
{
    /**
     * @return array{
     *   order_count: int,
     *   on_time_percent: float|null,
     *   avg_price_variance_percent: float|null,
     *   quality_score: float|null,
     *   overall_score: float|null
     * }
     */
    public function forSupplier(Contact $contact): array
    {
        $orders = PurchaseOrder::query()
            ->where('company_id', $contact->company_id)
            ->where('supplier_id', $contact->id)
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->get(['id', 'expected_at', 'status', 'ordered_at']);

        $orderCount = $orders->count();
        if ($orderCount === 0) {
            return [
                'order_count' => 0,
                'on_time_percent' => null,
                'avg_price_variance_percent' => null,
                'quality_score' => null,
                'overall_score' => null,
            ];
        }

        $onTime = 0;
        $onTimeTotal = 0;
        foreach ($orders as $po) {
            if (! $po->expected_at) {
                continue;
            }
            $onTimeTotal++;
            $gr = GoodsReceipt::query()
                ->where('purchase_order_id', $po->id)
                ->where('status', 'confirmed')
                ->orderBy('received_at')
                ->first(['received_at']);
            if ($gr?->received_at && $gr->received_at->toDateString() <= $po->expected_at->toDateString()) {
                $onTime++;
            }
        }

        $onTimePercent = $onTimeTotal > 0 ? round($onTime / $onTimeTotal * 100, 1) : null;

        // Placeholder quality score from fulfillment rate until formal QC exists.
        $received = $orders->whereIn('status', ['received', 'partial'])->count();
        $qualityScore = round($received / max(1, $orderCount) * 100, 1);

        $overall = null;
        if ($onTimePercent !== null) {
            $overall = round(($onTimePercent * 0.5) + ($qualityScore * 0.5), 1);
        }

        return [
            'order_count' => $orderCount,
            'on_time_percent' => $onTimePercent,
            'avg_price_variance_percent' => null,
            'quality_score' => $qualityScore,
            'overall_score' => $overall,
        ];
    }
}
