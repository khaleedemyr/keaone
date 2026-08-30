<?php

namespace App\Services;

use App\Models\GoodsReceipt;
use App\Models\MatchException;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseOrderDeliverySchedule;
use App\Models\PurchaseReturn;
use App\Models\VendorAdjustmentNote;
use App\Models\VendorInvoice;
use App\Models\VendorPaymentBatch;
use App\Support\ProcurementSettings;
use Illuminate\Support\Carbon;

class ProcurementDashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        $flow = ProcurementSettings::flow();
        $returnEnabled = ProcurementSettings::returnEnabled();
        $adjustmentEnabled = ProcurementSettings::vendorAdjustmentEnabled();
        $invoiceEnabled = ProcurementSettings::vendorInvoiceEnabled();
        $matchEnabled = ProcurementSettings::matchEnabled();
        $paymentBatchEnabled = ProcurementSettings::vendorPaymentBatchEnabled();
        $deliveryEnabled = ProcurementSettings::deliveryScheduleEnabled();
        $now = now();
        $monthStart = $now->copy()->startOfMonth();
        $today = $now->toDateString();

        $counts = [
            'pr_draft' => 0,
            'pr_submitted' => 0,
            'po_draft' => 0,
            'po_submitted' => 0,
            'po_open' => 0,
            'po_overdue' => 0,
            'gr_draft' => 0,
            'return_submitted' => 0,
            'adjustment_draft' => 0,
            'invoice_draft' => 0,
            'invoice_submitted' => 0,
            'invoice_payable' => 0,
            'payment_batch_draft' => 0,
            'payment_batch_submitted' => 0,
            'match_exception_open' => 0,
            'delivery_overdue' => 0,
        ];

        if ($flow === 'strict_pr_po_gr') {
            $counts['pr_draft'] = PurchaseRequisition::query()->where('status', 'draft')->count();
            $counts['pr_submitted'] = PurchaseRequisition::query()->where('status', 'submitted')->count();
        }

        if ($flow === 'strict_pr_po_gr' || $flow === 'po_gr') {
            $counts['po_draft'] = PurchaseOrder::query()->where('status', 'draft')->count();
            $counts['po_submitted'] = PurchaseOrder::query()->where('status', 'submitted')->count();
            $counts['po_open'] = PurchaseOrder::query()->whereIn('status', ['ordered', 'partial'])->count();
            $counts['po_overdue'] = PurchaseOrder::query()
                ->whereIn('status', ['ordered', 'partial'])
                ->whereNotNull('expected_at')
                ->whereDate('expected_at', '<', $today)
                ->count();
        }

        if ($flow !== 'direct') {
            $counts['gr_draft'] = GoodsReceipt::query()->where('status', 'draft')->count();
        } else {
            $counts['gr_draft'] = GoodsReceipt::query()
                ->where('status', 'draft')
                ->whereNull('purchase_order_id')
                ->count();
        }

        if ($returnEnabled) {
            $counts['return_submitted'] = PurchaseReturn::query()->where('status', 'submitted')->count();
        }

        if ($adjustmentEnabled) {
            $counts['adjustment_draft'] = VendorAdjustmentNote::query()->where('status', 'draft')->count();
        }

        if ($invoiceEnabled) {
            $counts['invoice_draft'] = VendorInvoice::query()->where('status', 'draft')->count();
            $counts['invoice_submitted'] = VendorInvoice::query()->where('status', 'submitted')->count();
        }

        $paymentBatchEnabled = ProcurementSettings::vendorPaymentBatchEnabled();
        if ($paymentBatchEnabled) {
            $counts['payment_batch_draft'] = VendorPaymentBatch::query()->where('status', 'draft')->count();
            $counts['payment_batch_submitted'] = VendorPaymentBatch::query()->where('status', 'submitted')->count();
            $counts['invoice_payable'] = VendorInvoice::query()
                ->where('status', 'confirmed')
                ->whereRaw('amount_paid < (CASE WHEN amount_payable > 0 THEN amount_payable ELSE total END)')
                ->count();
        }

        if ($matchEnabled) {
            $counts['match_exception_open'] = MatchException::query()->where('status', 'open')->count();
        }

        if ($deliveryEnabled && ($flow === 'strict_pr_po_gr' || $flow === 'po_gr')) {
            $counts['delivery_overdue'] = PurchaseOrderDeliverySchedule::query()
                ->where('status', 'planned')
                ->whereDate('delivery_date', '<', $today)
                ->count();
        }

        $spendMtd = (int) GoodsReceipt::query()
            ->where('status', 'confirmed')
            ->where('received_at', '>=', $monthStart)
            ->sum('total');

        return [
            'flow' => $flow,
            'return_enabled' => $returnEnabled,
            'adjustment_enabled' => $adjustmentEnabled,
            'vendor_invoice_enabled' => $invoiceEnabled,
            'match_enabled' => $matchEnabled,
            'vendor_payment_batch_enabled' => $paymentBatchEnabled,
            'delivery_schedule_enabled' => $deliveryEnabled,
            'month' => $monthStart->format('Y-m'),
            'counts' => $counts,
            'spend_mtd' => $spendMtd,
            'recent' => $this->recentItems($flow, $returnEnabled, $adjustmentEnabled, $deliveryEnabled),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function recentItems(string $flow, bool $returnEnabled, bool $adjustmentEnabled, bool $deliveryEnabled): array
    {
        $items = [];

        if ($flow === 'strict_pr_po_gr') {
            PurchaseRequisition::query()
                ->with('user:id,name')
                ->whereIn('status', ['submitted', 'draft'])
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->each(function (PurchaseRequisition $row) use (&$items) {
                    $items[] = $this->row('purchase_requisition', $row->id, $row->number, $row->status, $row->user?->name, $row->created_at);
                });
        }

        if ($flow === 'strict_pr_po_gr' || $flow === 'po_gr') {
            PurchaseOrder::query()
                ->with(['supplier:id,name', 'user:id,name'])
                ->whereIn('status', ['submitted', 'ordered', 'partial'])
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->each(function (PurchaseOrder $row) use (&$items) {
                    $items[] = $this->row(
                        'purchase_order',
                        $row->id,
                        $row->number,
                        $row->status,
                        $row->supplier?->name ?? $row->user?->name,
                        $row->created_at,
                        $row->expected_at?->toDateString(),
                    );
                });
        }

        $grQuery = GoodsReceipt::query()
            ->with(['supplier:id,name'])
            ->where('status', 'draft')
            ->orderByDesc('id')
            ->limit(5);

        if ($flow === 'direct') {
            $grQuery->whereNull('purchase_order_id');
        }

        $grQuery->get()->each(function (GoodsReceipt $row) use (&$items) {
            $items[] = $this->row('goods_receipt', $row->id, $row->number, $row->status, $row->supplier?->name, $row->created_at);
        });

        if ($returnEnabled) {
            PurchaseReturn::query()
                ->with(['supplier:id,name', 'user:id,name'])
                ->whereIn('status', ['submitted', 'approved'])
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->each(function (PurchaseReturn $row) use (&$items) {
                    $items[] = $this->row(
                        'purchase_return',
                        $row->id,
                        $row->number,
                        $row->status,
                        $row->supplier?->name ?? $row->user?->name,
                        $row->created_at,
                    );
                });
        }

        if ($adjustmentEnabled) {
            VendorAdjustmentNote::query()
                ->with(['supplier:id,name'])
                ->where('status', 'draft')
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->each(function (VendorAdjustmentNote $row) use (&$items) {
                    $items[] = $this->row(
                        'vendor_adjustment_note',
                        $row->id,
                        $row->number,
                        $row->status,
                        $row->supplier?->name,
                        $row->created_at,
                        null,
                        $row->type,
                    );
                });
        }

        if ($deliveryEnabled && ($flow === 'strict_pr_po_gr' || $flow === 'po_gr')) {
            PurchaseOrderDeliverySchedule::query()
                ->with(['order:id,number,supplier_id', 'order.supplier:id,name'])
                ->where('status', 'planned')
                ->whereDate('delivery_date', '<=', now()->addDays(7)->toDateString())
                ->orderBy('delivery_date')
                ->limit(5)
                ->get()
                ->each(function (PurchaseOrderDeliverySchedule $row) use (&$items) {
                    $items[] = $this->row(
                        'delivery_schedule',
                        $row->id,
                        $row->order?->number ?? '—',
                        $row->status,
                        $row->order?->supplier?->name,
                        $row->created_at,
                        $row->delivery_date?->toDateString(),
                    );
                });
        }

        return collect($items)
            ->sortByDesc(fn (array $row) => $row['created_at'] ?? '')
            ->take(12)
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function row(
        string $type,
        int $id,
        string $number,
        string $status,
        ?string $subtitle,
        ?Carbon $createdAt,
        ?string $expectedAt = null,
        ?string $subtype = null,
    ): array {
        return [
            'type' => $type,
            'subtype' => $subtype,
            'id' => $id,
            'number' => $number,
            'status' => $status,
            'subtitle' => $subtitle,
            'expected_at' => $expectedAt,
            'created_at' => $createdAt?->toIso8601String(),
        ];
    }
}
