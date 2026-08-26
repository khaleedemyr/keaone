<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function today(): JsonResponse
    {
        $this->ensureCan('insight', 'view');

        $outletId = CurrentCompany::outlet()?->id;
        $from = now()->startOfDay();
        $to = now()->endOfDay();

        $sales = Sale::query()
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->whereBetween('sold_at', [$from, $to])
            ->where('status', '!=', 'cancelled');

        $salesCount = (clone $sales)->count();
        $revenue = (int) (clone $sales)->sum('total');
        $paid = (int) (clone $sales)->sum('paid_amount');
        $saleIds = (clone $sales)->pluck('id');

        $itemsSold = $saleIds->isEmpty()
            ? 0
            : (int) SaleItem::query()->whereIn('sale_id', $saleIds)->sum('qty');

        $methods = ['cash' => 0, 'transfer' => 0, 'qris' => 0];
        if ($saleIds->isNotEmpty()) {
            $rows = Payment::query()
                ->where('payable_type', 'sale')
                ->whereIn('payable_id', $saleIds)
                ->selectRaw('method, sum(amount) as total')
                ->groupBy('method')
                ->pluck('total', 'method');

            foreach ($rows as $method => $total) {
                if (array_key_exists($method, $methods)) {
                    $methods[$method] = (int) $total;
                }
            }
        }

        return $this->ok([
            'date' => now()->toDateString(),
            'sales_count' => $salesCount,
            'revenue' => $revenue,
            'paid' => $paid,
            'items_sold' => $itemsSold,
            'average_ticket' => $salesCount > 0 ? (int) round($revenue / $salesCount) : 0,
            'payment_methods' => $methods,
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $this->ensureCan('insight', 'view');

        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now()->endOfDay();

        $base = Sale::query()->whereBetween('sold_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);

        $active = (clone $base)->where('status', '!=', 'cancelled');
        $salesCount = (clone $active)->count();
        $revenue = (int) (clone $active)->sum('total');
        $cancelledCount = (clone $base)->where('status', 'cancelled')->count();
        $saleIds = (clone $active)->pluck('id');
        $itemsSold = $saleIds->isEmpty()
            ? 0
            : (int) SaleItem::query()->whereIn('sale_id', $saleIds)->sum('qty');

        return $this->ok([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'sales_count' => $salesCount,
            'revenue' => $revenue,
            'cancelled_count' => $cancelledCount,
            'items_sold' => $itemsSold,
            'average_ticket' => $salesCount > 0 ? (int) round($revenue / $salesCount) : 0,
        ]);
    }
}
