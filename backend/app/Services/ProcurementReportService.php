<?php

namespace App\Services;

use App\Models\Budget;
use App\Models\BudgetCommitment;
use App\Models\BudgetLine;
use App\Models\Category;
use App\Models\Contact;
use App\Models\Department;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\MatchException;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\VendorInvoice;
use App\Support\CurrentCompany;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ProcurementReportService
{
    public function __construct(private VendorEvaluationService $vendorEvaluation) {}

    /**
     * @param  array{group_by?: string|null, budget_id?: int|null}  $options
     * @return array<string, mixed>
     */
    public function report(string $kind, string $fromDate, string $toDate, array $options = []): array
    {
        $companyId = CurrentCompany::id();
        $groupBy = $options['group_by'] ?? null;
        $budgetId = isset($options['budget_id']) ? (int) $options['budget_id'] : null;
        $suffix = implode(':', [$kind, $fromDate, $toDate, $groupBy ?? '-', $budgetId ?? '-']);

        if (! $companyId) {
            return $this->reportUncached($kind, $fromDate, $toDate, $groupBy, $budgetId);
        }

        return TenantCache::rememberVersioned($companyId, 'procurement_reports', $suffix, 300, fn () => $this->reportUncached(
            $kind,
            $fromDate,
            $toDate,
            $groupBy,
            $budgetId,
        ));
    }

    /**
     * @return array<string, mixed>
     */
    private function reportUncached(string $kind, string $fromDate, string $toDate, ?string $groupBy, ?int $budgetId): array
    {
        [$from, $to] = $this->parseRange($fromDate, $toDate);

        return match ($kind) {
            'spend' => $this->reportSpend($from, $to, $groupBy ?? 'supplier'),
            'cycle_time' => $this->reportCycleTime($from, $to),
            'vendor_performance' => $this->reportVendorPerformance($from, $to),
            'budget_actual' => $this->reportBudgetActual($from, $to, $budgetId),
            'open_po_aging' => $this->reportOpenPoAging(),
            'price_variance' => $this->reportPriceVariance($from, $to),
            'abc' => $this->reportAbc($from, $to, $groupBy ?? 'supplier'),
            default => [
                'kind' => $kind,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'rows' => [],
            ],
        };
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function parseRange(string $fromDate, string $toDate): array
    {
        $from = Carbon::parse($fromDate)->startOfDay();
        $to = Carbon::parse($toDate)->endOfDay();
        if ($from->gt($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }
        if ($from->diffInDays($to) > 366) {
            $from = $to->copy()->subDays(366)->startOfDay();
        }

        return [$from, $to];
    }

    /**
     * @return array<string, mixed>
     */
    private function reportSpend(Carbon $from, Carbon $to, string $groupBy): array
    {
        $rows = match ($groupBy) {
            'category' => $this->spendByCategory($from, $to),
            'department' => $this->spendByDepartment($from, $to),
            default => $this->spendBySupplier($from, $to),
        };

        $total = (int) array_sum(array_column($rows, 'amount'));
        $rows = $this->withSharePercent($rows, $total);

        $trend = GoodsReceipt::query()
            ->where('status', 'confirmed')
            ->whereBetween('received_at', [$from, $to])
            ->selectRaw("DATE_FORMAT(received_at, '%Y-%m') as period, SUM(total) as amount")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->map(fn ($row) => ['period' => (string) $row->period, 'amount' => (int) $row->amount])
            ->values()
            ->all();

        return [
            'kind' => 'spend',
            'group_by' => $groupBy,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'total' => $total,
            'rows' => $rows,
            'trend' => $trend,
        ];
    }

    /**
     * @return list<array{id: int|null, name: string, amount: int}>
     */
    private function spendBySupplier(Carbon $from, Carbon $to): array
    {
        $raw = GoodsReceipt::query()
            ->where('status', 'confirmed')
            ->whereBetween('received_at', [$from, $to])
            ->selectRaw('supplier_id, SUM(total) as amount')
            ->groupBy('supplier_id')
            ->orderByDesc('amount')
            ->get();

        $names = Contact::query()
            ->whereIn('id', $raw->pluck('supplier_id')->filter()->all())
            ->pluck('name', 'id');

        return $raw->map(fn ($row) => [
            'id' => $row->supplier_id ? (int) $row->supplier_id : null,
            'name' => $names[(int) $row->supplier_id] ?? '—',
            'amount' => (int) $row->amount,
        ])->values()->all();
    }

    /**
     * @return list<array{id: int|null, name: string, amount: int}>
     */
    private function spendByCategory(Carbon $from, Carbon $to): array
    {
        $raw = GoodsReceiptItem::query()
            ->join('goods_receipts', 'goods_receipts.id', '=', 'goods_receipt_items.goods_receipt_id')
            ->join('products', 'products.id', '=', 'goods_receipt_items.product_id')
            ->where('goods_receipts.status', 'confirmed')
            ->whereBetween('goods_receipts.received_at', [$from, $to])
            ->selectRaw('products.category_id, SUM(goods_receipt_items.total) as amount')
            ->groupBy('products.category_id')
            ->orderByDesc('amount')
            ->get();

        $names = Category::query()
            ->whereIn('id', $raw->pluck('category_id')->filter()->all())
            ->pluck('name', 'id');

        return $raw->map(fn ($row) => [
            'id' => $row->category_id ? (int) $row->category_id : null,
            'name' => $row->category_id ? ($names[(int) $row->category_id] ?? '—') : '—',
            'amount' => (int) $row->amount,
        ])->values()->all();
    }

    /**
     * @return list<array{id: int|null, name: string, amount: int}>
     */
    private function spendByDepartment(Carbon $from, Carbon $to): array
    {
        $raw = GoodsReceiptItem::query()
            ->join('goods_receipts', 'goods_receipts.id', '=', 'goods_receipt_items.goods_receipt_id')
            ->leftJoin('purchase_orders', 'purchase_orders.id', '=', 'goods_receipts.purchase_order_id')
            ->where('goods_receipts.status', 'confirmed')
            ->whereBetween('goods_receipts.received_at', [$from, $to])
            ->selectRaw('purchase_orders.department_id, SUM(goods_receipt_items.total) as amount')
            ->groupBy('purchase_orders.department_id')
            ->orderByDesc('amount')
            ->get();

        $names = Department::query()
            ->whereIn('id', $raw->pluck('department_id')->filter()->all())
            ->pluck('name', 'id');

        return $raw->map(fn ($row) => [
            'id' => $row->department_id ? (int) $row->department_id : null,
            'name' => $row->department_id ? ($names[(int) $row->department_id] ?? '—') : '—',
            'amount' => (int) $row->amount,
        ])->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function reportCycleTime(Carbon $from, Carbon $to): array
    {
        $orders = PurchaseOrder::query()
            ->with(['supplier:id,name', 'requisition:id,number,created_at'])
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('id')
            ->limit(200)
            ->get(['id', 'number', 'supplier_id', 'purchase_requisition_id', 'created_at', 'ordered_at']);

        $poIds = $orders->pluck('id')->all();
        $firstGrByPo = GoodsReceipt::query()
            ->whereIn('purchase_order_id', $poIds)
            ->where('status', 'confirmed')
            ->orderBy('received_at')
            ->get(['purchase_order_id', 'received_at'])
            ->groupBy('purchase_order_id')
            ->map(fn ($rows) => $rows->first()?->received_at);

        $firstInvoiceByPo = VendorInvoice::query()
            ->whereIn('purchase_order_id', $poIds)
            ->whereIn('status', ['confirmed', 'approved', 'paid'])
            ->orderBy('confirmed_at')
            ->get(['purchase_order_id', 'confirmed_at', 'created_at'])
            ->groupBy('purchase_order_id')
            ->map(fn ($rows) => $rows->first()?->confirmed_at ?? $rows->first()?->created_at);

        $rows = [];
        $prToPo = [];
        $poToGr = [];
        $grToInv = [];
        $totals = [];

        foreach ($orders as $po) {
            $pr = $po->requisition;
            $grAt = $firstGrByPo->get($po->id);
            $invAt = $firstInvoiceByPo->get($po->id);

            $prToPoDays = null;
            if ($pr?->created_at && $po->created_at) {
                $prToPoDays = (int) $pr->created_at->diffInDays($po->created_at);
                $prToPo[] = $prToPoDays;
            }

            $poToGrDays = null;
            if ($po->ordered_at && $grAt) {
                $poToGrDays = (int) $po->ordered_at->diffInDays($grAt);
                $poToGr[] = $poToGrDays;
            }

            $grToInvDays = null;
            if ($grAt && $invAt) {
                $grToInvDays = (int) Carbon::parse($grAt)->diffInDays($invAt);
                $grToInv[] = $grToInvDays;
            }

            $totalDays = null;
            if ($pr?->created_at && $invAt) {
                $totalDays = (int) $pr->created_at->diffInDays($invAt);
                $totals[] = $totalDays;
            } elseif ($po->created_at && $invAt) {
                $totalDays = (int) $po->created_at->diffInDays($invAt);
                $totals[] = $totalDays;
            }

            $rows[] = [
                'po_id' => $po->id,
                'po_number' => $po->number,
                'supplier_name' => $po->supplier?->name,
                'pr_number' => $pr?->number,
                'pr_to_po_days' => $prToPoDays,
                'po_to_gr_days' => $poToGrDays,
                'gr_to_invoice_days' => $grToInvDays,
                'total_days' => $totalDays,
            ];
        }

        return [
            'kind' => 'cycle_time',
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'rows' => $rows,
            'summary' => [
                'avg_pr_to_po_days' => $this->avg($prToPo),
                'avg_po_to_gr_days' => $this->avg($poToGr),
                'avg_gr_to_invoice_days' => $this->avg($grToInv),
                'avg_total_days' => $this->avg($totals),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function reportVendorPerformance(Carbon $from, Carbon $to): array
    {
        $supplierIds = PurchaseOrder::query()
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->whereBetween('created_at', [$from, $to])
            ->distinct()
            ->pluck('supplier_id')
            ->filter()
            ->all();

        $suppliers = Contact::query()->whereIn('id', $supplierIds)->orderBy('name')->get(['id', 'name']);
        $rows = [];

        foreach ($suppliers as $supplier) {
            $eval = $this->vendorEvaluation->forSupplier($supplier);
            $priceVariance = $this->avgPriceVarianceForSupplier((int) $supplier->id, $from, $to);

            $rows[] = [
                'supplier_id' => $supplier->id,
                'name' => $supplier->name,
                'order_count' => $eval['order_count'],
                'on_time_percent' => $eval['on_time_percent'],
                'quality_score' => $eval['quality_score'],
                'overall_score' => $eval['overall_score'],
                'avg_price_variance_percent' => $priceVariance,
            ];
        }

        usort($rows, fn ($a, $b) => ($b['overall_score'] ?? 0) <=> ($a['overall_score'] ?? 0));

        return [
            'kind' => 'vendor_performance',
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'rows' => $rows,
        ];
    }

    private function avgPriceVarianceForSupplier(int $supplierId, Carbon $from, Carbon $to): ?float
    {
        $avg = MatchException::query()
            ->join('vendor_invoices', 'vendor_invoices.id', '=', 'match_exceptions.vendor_invoice_id')
            ->where('vendor_invoices.supplier_id', $supplierId)
            ->where('match_exceptions.exception_type', 'price')
            ->whereBetween('match_exceptions.created_at', [$from, $to])
            ->avg('match_exceptions.variance_percent');

        return $avg !== null ? round((float) $avg, 2) : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function reportBudgetActual(Carbon $from, Carbon $to, ?int $budgetId): array
    {
        $budgetQuery = Budget::query()->with(['lines.department', 'lines.outlet'])->where('status', 'active');
        if ($budgetId) {
            $budgetQuery->where('id', $budgetId);
        } else {
            $budgetQuery
                ->whereDate('period_start', '<=', $to->toDateString())
                ->whereDate('period_end', '>=', $from->toDateString())
                ->orderByDesc('id')
                ->limit(1);
        }

        $budget = $budgetQuery->first();
        if (! $budget) {
            return [
                'kind' => 'budget_actual',
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'budget' => null,
                'rows' => [],
            ];
        }

        $lineIds = $budget->lines->pluck('id')->all();
        $committedByLine = BudgetCommitment::query()
            ->whereIn('budget_line_id', $lineIds)
            ->where('status', 'active')
            ->selectRaw('budget_line_id, SUM(amount) as total')
            ->groupBy('budget_line_id')
            ->pluck('total', 'budget_line_id');

        $rows = [];
        foreach ($budget->lines as $line) {
            $actual = $this->actualSpendForBudgetLine($line, $from, $to);
            $allocated = (int) $line->amount;
            $committed = (int) ($committedByLine[$line->id] ?? 0);

            $rows[] = [
                'line_id' => $line->id,
                'department_id' => $line->department_id,
                'department_name' => $line->department?->name,
                'outlet_id' => $line->outlet_id,
                'outlet_name' => $line->outlet?->name,
                'allocated' => $allocated,
                'committed' => $committed,
                'actual' => $actual,
                'variance' => $actual - $allocated,
                'available' => max(0, $allocated - $committed),
            ];
        }

        return [
            'kind' => 'budget_actual',
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'budget' => [
                'id' => $budget->id,
                'name' => $budget->name,
                'fiscal_year' => $budget->fiscal_year,
                'period_start' => $budget->period_start?->toDateString(),
                'period_end' => $budget->period_end?->toDateString(),
            ],
            'rows' => $rows,
            'totals' => [
                'allocated' => (int) array_sum(array_column($rows, 'allocated')),
                'committed' => (int) array_sum(array_column($rows, 'committed')),
                'actual' => (int) array_sum(array_column($rows, 'actual')),
                'variance' => (int) array_sum(array_column($rows, 'variance')),
            ],
        ];
    }

    private function actualSpendForBudgetLine(BudgetLine $line, Carbon $from, Carbon $to): int
    {
        $query = GoodsReceiptItem::query()
            ->join('goods_receipts', 'goods_receipts.id', '=', 'goods_receipt_items.goods_receipt_id')
            ->leftJoin('purchase_orders', 'purchase_orders.id', '=', 'goods_receipts.purchase_order_id')
            ->where('goods_receipts.status', 'confirmed')
            ->whereBetween('goods_receipts.received_at', [$from, $to]);

        if ($line->department_id) {
            $query->where('purchase_orders.department_id', $line->department_id);
        }
        if ($line->outlet_id) {
            $query->where(function ($q) use ($line) {
                $q->where('purchase_orders.outlet_id', $line->outlet_id)
                    ->orWhere('goods_receipts.outlet_id', $line->outlet_id);
            });
        }

        return (int) $query->sum('goods_receipt_items.total');
    }

    /**
     * @return array<string, mixed>
     */
    private function reportOpenPoAging(): array
    {
        $today = now()->startOfDay();
        $orders = PurchaseOrder::query()
            ->with('supplier:id,name')
            ->whereIn('status', ['ordered', 'partial'])
            ->orderBy('ordered_at')
            ->limit(500)
            ->get(['id', 'number', 'supplier_id', 'ordered_at', 'expected_at', 'total', 'status']);

        $buckets = [
            '0_30' => ['label' => '0-30', 'count' => 0, 'total' => 0],
            '31_60' => ['label' => '31-60', 'count' => 0, 'total' => 0],
            '61_plus' => ['label' => '61+', 'count' => 0, 'total' => 0],
        ];

        $rows = [];
        foreach ($orders as $po) {
            $anchor = $po->ordered_at ?? $po->created_at ?? $today;
            $ageDays = (int) Carbon::parse($anchor)->diffInDays($today);
            $amount = (int) $po->total;

            if ($ageDays <= 30) {
                $key = '0_30';
            } elseif ($ageDays <= 60) {
                $key = '31_60';
            } else {
                $key = '61_plus';
            }

            $buckets[$key]['count']++;
            $buckets[$key]['total'] += $amount;

            $rows[] = [
                'po_id' => $po->id,
                'po_number' => $po->number,
                'supplier_name' => $po->supplier?->name,
                'ordered_at' => $po->ordered_at?->toDateString(),
                'expected_at' => $po->expected_at?->toDateString(),
                'age_days' => $ageDays,
                'total' => $amount,
                'status' => $po->status,
            ];
        }

        return [
            'kind' => 'open_po_aging',
            'rows' => $rows,
            'buckets' => array_values($buckets),
            'summary' => [
                'open_count' => count($rows),
                'open_total' => (int) array_sum(array_column($rows, 'total')),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function reportPriceVariance(Carbon $from, Carbon $to): array
    {
        $matchRows = MatchException::query()
            ->with(['vendorInvoice.supplier:id,name', 'purchaseOrderItem.product:id,name'])
            ->where('exception_type', 'price')
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        $companyId = CurrentCompany::id();
        $grVariance = DB::table('goods_receipt_items as gri')
            ->join('goods_receipts as gr', 'gr.id', '=', 'gri.goods_receipt_id')
            ->join('purchase_order_items as poi', 'poi.id', '=', 'gri.purchase_order_item_id')
            ->join('products as p', 'p.id', '=', 'gri.product_id')
            ->join('purchase_orders as po', 'po.id', '=', 'gr.purchase_order_id')
            ->join('contacts as s', 's.id', '=', 'po.supplier_id')
            ->where('gr.status', 'confirmed')
            ->whereBetween('gr.received_at', [$from, $to])
            ->when($companyId, fn ($q) => $q->where('gr.company_id', $companyId))
            ->when(CurrentCompany::id(), fn ($q, $id) => $q->where('gr.company_id', $id))
            ->whereColumn('gri.unit_cost', '!=', 'poi.unit_cost')
            ->select([
                's.name as supplier_name',
                'p.name as product_name',
                'poi.unit_cost as po_unit_cost',
                'gri.unit_cost as gr_unit_cost',
            ])
            ->limit(200)
            ->get()
            ->map(function ($row) {
                $poCost = (int) $row->po_unit_cost;
                $grCost = (int) $row->gr_unit_cost;
                $variance = $poCost > 0 ? round(($grCost - $poCost) / $poCost * 100, 2) : null;

                return [
                    'supplier_name' => $row->supplier_name,
                    'product_name' => $row->product_name,
                    'po_unit_cost' => $poCost,
                    'gr_unit_cost' => $grCost,
                    'variance_percent' => $variance,
                    'source' => 'gr',
                ];
            })
            ->all();

        $rows = [];
        foreach ($matchRows as $ex) {
            $rows[] = [
                'supplier_name' => $ex->vendorInvoice?->supplier?->name,
                'product_name' => $ex->purchaseOrderItem?->product?->name,
                'po_unit_cost' => $ex->expected_value !== null ? (int) $ex->expected_value : null,
                'gr_unit_cost' => $ex->actual_value !== null ? (int) $ex->actual_value : null,
                'variance_percent' => $ex->variance_percent,
                'source' => 'match',
                'status' => $ex->status,
            ];
        }

        $rows = array_merge($rows, $grVariance);
        $variances = array_filter(array_column($rows, 'variance_percent'), fn ($v) => $v !== null);

        return [
            'kind' => 'price_variance',
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'rows' => $rows,
            'summary' => [
                'row_count' => count($rows),
                'avg_variance_percent' => $variances !== [] ? round(array_sum($variances) / count($variances), 2) : null,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function reportAbc(Carbon $from, Carbon $to, string $groupBy): array
    {
        $baseRows = $groupBy === 'product'
            ? $this->spendByProduct($from, $to)
            : $this->spendBySupplier($from, $to);

        $total = (int) array_sum(array_column($baseRows, 'amount'));
        $cumulative = 0;
        $rows = [];

        foreach ($baseRows as $index => $row) {
            $share = $total > 0 ? ($row['amount'] / $total) * 100 : 0;
            $cumulative += $share;
            $class = $cumulative <= 80 ? 'A' : ($cumulative <= 95 ? 'B' : 'C');

            $rows[] = [
                'rank' => $index + 1,
                'id' => $row['id'],
                'name' => $row['name'],
                'amount' => $row['amount'],
                'share_percent' => round($share, 1),
                'cumulative_percent' => round($cumulative, 1),
                'class' => $class,
            ];
        }

        return [
            'kind' => 'abc',
            'group_by' => $groupBy,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'total' => $total,
            'rows' => $rows,
        ];
    }

    /**
     * @return list<array{id: int|null, name: string, amount: int}>
     */
    private function spendByProduct(Carbon $from, Carbon $to): array
    {
        $raw = GoodsReceiptItem::query()
            ->join('goods_receipts', 'goods_receipts.id', '=', 'goods_receipt_items.goods_receipt_id')
            ->where('goods_receipts.status', 'confirmed')
            ->whereBetween('goods_receipts.received_at', [$from, $to])
            ->selectRaw('goods_receipt_items.product_id, SUM(goods_receipt_items.total) as amount')
            ->groupBy('goods_receipt_items.product_id')
            ->orderByDesc('amount')
            ->limit(100)
            ->get();

        $names = Product::query()
            ->whereIn('id', $raw->pluck('product_id')->filter()->all())
            ->pluck('name', 'id');

        return $raw->map(fn ($row) => [
            'id' => $row->product_id ? (int) $row->product_id : null,
            'name' => $names[(int) $row->product_id] ?? '—',
            'amount' => (int) $row->amount,
        ])->values()->all();
    }

    /**
     * @param  list<array{id: int|null, name: string, amount: int}>  $rows
     * @return list<array{id: int|null, name: string, amount: int, share_percent: float}>
     */
    private function withSharePercent(array $rows, int $total): array
    {
        return array_map(function ($row) use ($total) {
            $row['share_percent'] = $total > 0 ? round($row['amount'] / $total * 100, 1) : 0;

            return $row;
        }, $rows);
    }

    /**
     * @param  list<int>  $values
     */
    private function avg(array $values): ?float
    {
        if ($values === []) {
            return null;
        }

        return round(array_sum($values) / count($values), 1);
    }
}
