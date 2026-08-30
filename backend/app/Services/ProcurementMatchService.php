<?php

namespace App\Services;

use App\Models\GoodsReceiptItem;
use App\Models\MatchException;
use App\Models\PurchaseOrderItem;
use App\Models\User;
use App\Models\VendorInvoice;
use App\Models\VendorInvoiceItem;
use App\Support\ProcurementSettings;
use Illuminate\Validation\ValidationException;

class ProcurementMatchService
{
    public function match(VendorInvoice $invoice): VendorInvoice
    {
        MatchException::query()
            ->where('vendor_invoice_id', $invoice->id)
            ->where('status', 'open')
            ->delete();

        $invoice->load(['items.product.category']);
        $qtyTolerance = ProcurementSettings::matchQtyTolerance();
        $priceTolerance = ProcurementSettings::matchPriceTolerance();
        $hasOpenException = false;

        foreach ($invoice->items as $item) {
            $twoWay = $this->isTwoWayItem($item);

            if ($invoice->purchase_order_id && ! $item->purchase_order_item_id) {
                if ($this->createException($invoice, $item, 'missing_po', 'purchase_order_item_id', null, null, null, 'Item invoice tidak terhubung ke baris PO.')) {
                    $hasOpenException = true;
                }
            }

            if (! $twoWay && $invoice->goods_receipt_id && ! $item->goods_receipt_item_id) {
                if ($this->createException($invoice, $item, 'missing_gr', 'goods_receipt_item_id', null, null, null, 'Item invoice tidak terhubung ke baris GR.')) {
                    $hasOpenException = true;
                }
            }

            if ($item->purchase_order_item_id) {
                $poItem = PurchaseOrderItem::query()->find($item->purchase_order_item_id);
                if ($poItem) {
                    if (! $this->withinTolerance((int) $poItem->unit_cost, (int) $item->unit_cost, $priceTolerance)) {
                        $variance = $this->variancePercent((int) $poItem->unit_cost, (int) $item->unit_cost);
                        if ($this->createException(
                            $invoice,
                            $item,
                            'price',
                            'unit_cost',
                            (string) $poItem->unit_cost,
                            (string) $item->unit_cost,
                            $variance,
                            "Harga invoice ({$item->unit_cost}) tidak sesuai PO ({$poItem->unit_cost}).",
                            $item->purchase_order_item_id,
                            null,
                        )) {
                            $hasOpenException = true;
                        }
                    }
                }
            }

            if (! $twoWay && $item->goods_receipt_item_id) {
                $grItem = GoodsReceiptItem::query()->find($item->goods_receipt_item_id);
                if ($grItem) {
                    if (! $this->withinTolerance((int) $grItem->qty, (int) $item->qty, $qtyTolerance)) {
                        $variance = $this->variancePercent((int) $grItem->qty, (int) $item->qty);
                        if ($this->createException(
                            $invoice,
                            $item,
                            'qty',
                            'qty',
                            (string) $grItem->qty,
                            (string) $item->qty,
                            $variance,
                            "Qty invoice ({$item->qty}) tidak sesuai GR ({$grItem->qty}).",
                            $item->purchase_order_item_id,
                            $item->goods_receipt_item_id,
                        )) {
                            $hasOpenException = true;
                        }
                    }
                }
            } elseif ($item->purchase_order_item_id) {
                $poItem = PurchaseOrderItem::query()->find($item->purchase_order_item_id);
                if ($poItem && ! $this->withinTolerance((int) $poItem->qty, (int) $item->qty, $qtyTolerance)) {
                    $variance = $this->variancePercent((int) $poItem->qty, (int) $item->qty);
                    if ($this->createException(
                        $invoice,
                        $item,
                        'qty',
                        'qty',
                        (string) $poItem->qty,
                        (string) $item->qty,
                        $variance,
                        "Qty invoice ({$item->qty}) tidak sesuai PO ({$poItem->qty}).",
                        $item->purchase_order_item_id,
                        null,
                    )) {
                        $hasOpenException = true;
                    }
                }
            }
        }

        $openCount = MatchException::query()
            ->where('vendor_invoice_id', $invoice->id)
            ->where('status', 'open')
            ->count();

        $invoice->update([
            'match_status' => ($hasOpenException || $openCount > 0) ? 'exception' : 'matched',
        ]);

        return $invoice->fresh();
    }

    public function waive(MatchException $exception, User $user, ?string $note = null): MatchException
    {
        if ($exception->status !== 'open') {
            throw ValidationException::withMessages(['status' => ['Exception sudah diselesaikan.']]);
        }

        $exception->update([
            'status' => 'waived',
            'resolved_by' => $user->id,
            'resolved_at' => now(),
            'note' => $note,
        ]);

        $invoice = $exception->vendorInvoice;
        if ($invoice) {
            $openCount = MatchException::query()
                ->where('vendor_invoice_id', $invoice->id)
                ->where('status', 'open')
                ->count();

            if ($openCount === 0 && $invoice->match_status === 'exception') {
                $invoice->update(['match_status' => 'matched']);
            }
        }

        return $exception->fresh(['vendorInvoice', 'vendorInvoiceItem']);
    }

    public function serializeException(MatchException $exception): array
    {
        $exception->load([
            'vendorInvoice:id,number,status,match_status',
            'vendorInvoiceItem:id,name_snapshot,qty,unit_cost',
            'resolver:id,name',
        ]);

        return [
            'id' => $exception->id,
            'vendor_invoice_id' => $exception->vendor_invoice_id,
            'vendor_invoice' => $exception->vendorInvoice?->only(['id', 'number', 'status', 'match_status']),
            'vendor_invoice_item_id' => $exception->vendor_invoice_item_id,
            'vendor_invoice_item' => $exception->vendorInvoiceItem?->only(['id', 'name_snapshot', 'qty', 'unit_cost']),
            'purchase_order_item_id' => $exception->purchase_order_item_id,
            'goods_receipt_item_id' => $exception->goods_receipt_item_id,
            'exception_type' => $exception->exception_type,
            'field_name' => $exception->field_name,
            'expected_value' => $exception->expected_value,
            'actual_value' => $exception->actual_value,
            'variance_percent' => $exception->variance_percent,
            'message' => $exception->message,
            'status' => $exception->status,
            'resolved_by' => $exception->resolved_by,
            'resolver' => $exception->resolver?->only(['id', 'name']),
            'resolved_at' => $exception->resolved_at?->toIso8601String(),
            'note' => $exception->note,
            'created_at' => $exception->created_at?->toIso8601String(),
        ];
    }

    private function createException(
        VendorInvoice $invoice,
        VendorInvoiceItem $item,
        string $type,
        ?string $fieldName,
        ?string $expected,
        ?string $actual,
        ?float $variance,
        ?string $message,
        ?int $poItemId = null,
        ?int $grItemId = null,
    ): bool {
        if ($this->isWaived($invoice->id, $item->id, $type)) {
            return false;
        }

        MatchException::query()->create([
            'company_id' => $invoice->company_id,
            'vendor_invoice_id' => $invoice->id,
            'vendor_invoice_item_id' => $item->id,
            'purchase_order_item_id' => $poItemId ?? $item->purchase_order_item_id,
            'goods_receipt_item_id' => $grItemId ?? $item->goods_receipt_item_id,
            'exception_type' => $type,
            'field_name' => $fieldName,
            'expected_value' => $expected,
            'actual_value' => $actual,
            'variance_percent' => $variance,
            'message' => $message,
            'status' => 'open',
        ]);

        return true;
    }

    private function isWaived(int $invoiceId, int $itemId, string $type): bool
    {
        return MatchException::query()
            ->where('vendor_invoice_id', $invoiceId)
            ->where('vendor_invoice_item_id', $itemId)
            ->where('exception_type', $type)
            ->where('status', 'waived')
            ->exists();
    }

    private function isTwoWayItem(VendorInvoiceItem $item): bool
    {
        if (! ProcurementSettings::twoWayMatchEnabled()) {
            return false;
        }

        $mode = $item->product?->category?->procurement_match_mode ?? 'three_way';

        return $mode === 'two_way';
    }

    private function withinTolerance(int|float $expected, int|float $actual, float $tolerancePercent): bool
    {
        if ((int) $expected === (int) $actual) {
            return true;
        }

        if ($expected == 0) {
            return $actual == 0;
        }

        $variance = abs($actual - $expected) / abs($expected) * 100;

        return $variance <= $tolerancePercent;
    }

    private function variancePercent(int|float $expected, int|float $actual): float
    {
        if ($expected == 0) {
            return $actual == 0 ? 0.0 : 100.0;
        }

        return round(abs($actual - $expected) / abs($expected) * 100, 2);
    }
}
