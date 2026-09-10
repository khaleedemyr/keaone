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
    public function __construct(private ProductUnitService $productUnits) {}

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
            $invoiceBase = $this->productUnits->toBaseQty(
                (int) $item->qty,
                max(1, (int) ($item->factor_to_base ?: 1)),
            );

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
                if (! $poItem) {
                    if ($this->createException($invoice, $item, 'missing_po', 'purchase_order_item_id', null, null, null, 'Baris PO tidak ditemukan.')) {
                        $hasOpenException = true;
                    }
                } elseif ((int) $poItem->purchase_order_id !== (int) ($invoice->purchase_order_id ?? 0)) {
                    if ($this->createException($invoice, $item, 'missing_po', 'purchase_order_item_id', null, null, null, 'Baris PO tidak milik PO invoice.')) {
                        $hasOpenException = true;
                    }
                } elseif ((int) $poItem->product_id !== (int) $item->product_id) {
                    if ($this->createException($invoice, $item, 'missing_po', 'product_id', (string) $poItem->product_id, (string) $item->product_id, null, 'Produk invoice tidak cocok dengan baris PO.')) {
                        $hasOpenException = true;
                    }
                } else {
                    $poNet = $this->productUnits->netUnitCost((int) $poItem->qty, (int) $poItem->unit_cost, (int) ($poItem->discount ?? 0));
                    $invNet = $this->productUnits->netUnitCost((int) $item->qty, (int) $item->unit_cost, (int) ($item->discount ?? 0));
                    // Normalize net unit cost to base unit for cross-unit compare.
                    $poFactor = max(1, (int) ($poItem->factor_to_base ?: 1));
                    $invFactor = max(1, (int) ($item->factor_to_base ?: 1));
                    $poNetBase = (int) round($poNet / $poFactor);
                    $invNetBase = (int) round($invNet / $invFactor);

                    if (! $this->withinTolerance($poNetBase, $invNetBase, $priceTolerance)) {
                        $variance = $this->variancePercent($poNetBase, $invNetBase);
                        if ($this->createException(
                            $invoice,
                            $item,
                            'price',
                            'unit_cost',
                            (string) $poNetBase,
                            (string) $invNetBase,
                            $variance,
                            "Harga bersih/base invoice ({$invNetBase}) tidak sesuai PO ({$poNetBase}).",
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
                if (! $grItem) {
                    if ($this->createException($invoice, $item, 'missing_gr', 'goods_receipt_item_id', null, null, null, 'Baris GR tidak ditemukan.')) {
                        $hasOpenException = true;
                    }
                } elseif ($invoice->goods_receipt_id && (int) $grItem->goods_receipt_id !== (int) $invoice->goods_receipt_id) {
                    if ($this->createException($invoice, $item, 'missing_gr', 'goods_receipt_item_id', null, null, null, 'Baris GR tidak milik GR invoice.')) {
                        $hasOpenException = true;
                    }
                } elseif ((int) $grItem->product_id !== (int) $item->product_id) {
                    if ($this->createException($invoice, $item, 'missing_gr', 'product_id', (string) $grItem->product_id, (string) $item->product_id, null, 'Produk invoice tidak cocok dengan baris GR.')) {
                        $hasOpenException = true;
                    }
                } else {
                    $grBase = $this->productUnits->toBaseQty((int) $grItem->qty, max(1, (int) ($grItem->factor_to_base ?: 1)));
                    $priorBase = $this->invoicedBaseQtyForLink('goods_receipt_item_id', (int) $grItem->id, (int) $invoice->id);
                    $remainingBase = max(0, $grBase - $priorBase);

                    if (! $this->withinTolerance($remainingBase, $invoiceBase, $qtyTolerance) && $invoiceBase > $remainingBase) {
                        $variance = $this->variancePercent(max(1, $remainingBase), $invoiceBase);
                        if ($this->createException(
                            $invoice,
                            $item,
                            'qty',
                            'qty',
                            (string) $remainingBase,
                            (string) $invoiceBase,
                            $variance,
                            "Qty invoice (base {$invoiceBase}) melebihi sisa GR yang belum ditagih (base {$remainingBase}).",
                            $item->purchase_order_item_id,
                            $item->goods_receipt_item_id,
                        )) {
                            $hasOpenException = true;
                        }
                    }
                }
            } elseif ($item->purchase_order_item_id) {
                $poItem = PurchaseOrderItem::query()->find($item->purchase_order_item_id);
                if ($poItem && (int) $poItem->product_id === (int) $item->product_id) {
                    $poBase = $this->productUnits->toBaseQty((int) $poItem->qty, max(1, (int) ($poItem->factor_to_base ?: 1)));
                    $priorBase = $this->invoicedBaseQtyForLink('purchase_order_item_id', (int) $poItem->id, (int) $invoice->id);
                    $remainingBase = max(0, $poBase - $priorBase);

                    if (! $this->withinTolerance($remainingBase, $invoiceBase, $qtyTolerance) && $invoiceBase > $remainingBase) {
                        $variance = $this->variancePercent(max(1, $remainingBase), $invoiceBase);
                        if ($this->createException(
                            $invoice,
                            $item,
                            'qty',
                            'qty',
                            (string) $remainingBase,
                            (string) $invoiceBase,
                            $variance,
                            "Qty invoice (base {$invoiceBase}) melebihi sisa PO yang belum ditagih (base {$remainingBase}).",
                            $item->purchase_order_item_id,
                            null,
                        )) {
                            $hasOpenException = true;
                        }
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

        $note = trim((string) $note);
        if (mb_strlen($note) < 5) {
            throw ValidationException::withMessages([
                'note' => ['Catatan waive wajib diisi (minimal 5 karakter).'],
            ]);
        }

        $exception->loadMissing('vendorInvoice');
        $invoice = $exception->vendorInvoice;
        if ($invoice && (int) $invoice->user_id === (int) $user->id) {
            throw ValidationException::withMessages([
                'user' => ['Pembuat invoice tidak boleh waive exception (segregation of duties).'],
            ]);
        }

        $exception->update([
            'status' => 'waived',
            'resolved_by' => $user->id,
            'resolved_at' => now(),
            'note' => $note,
        ]);

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

    private function invoicedBaseQtyForLink(string $column, int $linkId, int $excludeInvoiceId): int
    {
        return (int) VendorInvoiceItem::query()
            ->where($column, $linkId)
            ->whereHas('vendorInvoice', function ($q) use ($excludeInvoiceId) {
                $q->whereKeyNot($excludeInvoiceId)
                    ->whereIn('status', ['draft', 'submitted', 'approved', 'confirmed']);
            })
            ->get(['qty', 'factor_to_base'])
            ->sum(fn (VendorInvoiceItem $row) => $this->productUnits->toBaseQty(
                (int) $row->qty,
                max(1, (int) ($row->factor_to_base ?: 1)),
            ));
    }

    private function createException(
        VendorInvoice $invoice,
        VendorInvoiceItem $item,
        string $type,
        ?string $field,
        ?string $expected,
        ?string $actual,
        ?float $variance,
        string $message,
        ?int $poItemId = null,
        ?int $grItemId = null,
    ): bool {
        if ($this->isWaived($invoice, $item, $type)) {
            return false;
        }

        MatchException::query()->create([
            'company_id' => $invoice->company_id,
            'vendor_invoice_id' => $invoice->id,
            'vendor_invoice_item_id' => $item->id,
            'purchase_order_item_id' => $poItemId,
            'goods_receipt_item_id' => $grItemId,
            'exception_type' => $type,
            'field_name' => $field,
            'expected_value' => $expected,
            'actual_value' => $actual,
            'variance_percent' => $variance,
            'message' => $message,
            'status' => 'open',
        ]);

        return true;
    }

    private function isWaived(VendorInvoice $invoice, VendorInvoiceItem $item, string $type): bool
    {
        return MatchException::query()
            ->where('vendor_invoice_id', $invoice->id)
            ->where('vendor_invoice_item_id', $item->id)
            ->where('exception_type', $type)
            ->where('status', 'waived')
            ->exists();
    }

    private function isTwoWayItem(VendorInvoiceItem $item): bool
    {
        if (! ProcurementSettings::twoWayMatchEnabled()) {
            return false;
        }

        $category = $item->product?->category;
        if ($category && ($category->procurement_match_mode ?? null) === 'two_way') {
            return true;
        }

        return (bool) ($item->product?->is_procurement_item && ! $item->product?->track_stock);
    }

    private function withinTolerance(int $expected, int $actual, float $tolerancePercent): bool
    {
        if ($tolerancePercent <= 0) {
            return $expected === $actual;
        }
        if ($expected === 0) {
            return $actual === 0;
        }

        $variance = abs($actual - $expected) / abs($expected) * 100;

        return $variance <= $tolerancePercent;
    }

    private function variancePercent(int $expected, int $actual): float
    {
        if ($expected === 0) {
            return $actual === 0 ? 0.0 : 100.0;
        }

        return round(abs($actual - $expected) / abs($expected) * 100, 4);
    }
}
