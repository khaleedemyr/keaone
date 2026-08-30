<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\VendorInvoice;
use App\Models\VendorPaymentBatch;
use App\Models\VendorWithholdingRecord;
use App\Support\ProcurementSettings;
use Illuminate\Validation\ValidationException;

class WithholdingTaxService
{
    public const TYPES = ['pph23', 'pph22', 'pph42'];

    public const BASES = ['subtotal', 'total'];

    public function enabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::withholdingTaxEnabled($company);
    }

    /**
     * @return array{
     *     withholding_tax_type: ?string,
     *     withholding_tax_rate: float,
     *     withholding_tax_base: ?string,
     *     withholding_tax: int,
     *     amount_payable: int
     * }
     */
    public function applyToTotals(int $subtotal, int $total, ?Contact $supplier): array
    {
        $empty = [
            'withholding_tax_type' => null,
            'withholding_tax_rate' => 0.0,
            'withholding_tax_base' => null,
            'withholding_tax' => 0,
            'amount_payable' => $total,
        ];

        if (! $this->enabled() || ! $supplier || ! $supplier->withholding_tax_enabled) {
            return $empty;
        }

        $type = (string) ($supplier->withholding_tax_type ?? '');
        $rate = (float) ($supplier->withholding_tax_rate ?? 0);
        $base = (string) ($supplier->withholding_tax_base ?? 'subtotal');

        if (! in_array($type, self::TYPES, true) || $rate <= 0) {
            return $empty;
        }

        if (! in_array($base, self::BASES, true)) {
            $base = 'subtotal';
        }

        $baseAmount = $base === 'total' ? $total : $subtotal;
        $withholding = (int) round($baseAmount * $rate / 100);

        return [
            'withholding_tax_type' => $type,
            'withholding_tax_rate' => $rate,
            'withholding_tax_base' => $base,
            'withholding_tax' => $withholding,
            'amount_payable' => max(0, $total - $withholding),
        ];
    }

    /**
     * Proportional WHT for a partial payment against invoice amount_payable.
     */
    public function withholdingForPayment(VendorInvoice $invoice, int $paymentAmount): int
    {
        $withholding = (int) $invoice->withholding_tax;
        $payable = (int) ($invoice->amount_payable ?: $invoice->total);

        if ($withholding <= 0 || $paymentAmount <= 0 || $payable <= 0) {
            return 0;
        }

        if ($paymentAmount >= $payable) {
            return $withholding;
        }

        return (int) round($withholding * $paymentAmount / $payable);
    }

    public function recordFromPayment(
        VendorInvoice $invoice,
        VendorPaymentBatch $batch,
        int $paymentAmount,
        \DateTimeInterface $withheldAt,
    ): ?VendorWithholdingRecord {
        if ((int) $invoice->withholding_tax <= 0) {
            return null;
        }

        $withholdingAmount = $this->withholdingForPayment($invoice, $paymentAmount);
        if ($withholdingAmount <= 0) {
            return null;
        }

        $baseAmount = (string) $invoice->withholding_tax_base === 'total'
            ? (int) $invoice->total
            : (int) $invoice->subtotal;

        return VendorWithholdingRecord::query()->create([
            'company_id' => $invoice->company_id,
            'supplier_id' => $invoice->supplier_id,
            'vendor_invoice_id' => $invoice->id,
            'vendor_payment_batch_id' => $batch->id,
            'invoice_number' => $invoice->number,
            'withholding_tax_type' => (string) $invoice->withholding_tax_type,
            'withholding_tax_rate' => (float) $invoice->withholding_tax_rate,
            'withholding_tax_base' => (string) $invoice->withholding_tax_base,
            'base_amount' => $baseAmount,
            'withholding_amount' => $withholdingAmount,
            'payment_amount' => $paymentAmount,
            'status' => 'withheld',
            'withheld_at' => $withheldAt,
        ]);
    }

    public function markRemitted(VendorWithholdingRecord $record): VendorWithholdingRecord
    {
        if ($record->status === 'remitted') {
            throw ValidationException::withMessages(['status' => ['PPh sudah ditandai disetor.']]);
        }

        $record->update([
            'status' => 'remitted',
            'remitted_at' => now(),
        ]);

        return $record->fresh(['supplier:id,name']);
    }

    public function serialize(VendorWithholdingRecord $record): array
    {
        $record->loadMissing('supplier:id,name');

        return [
            'id' => $record->id,
            'supplier_id' => $record->supplier_id,
            'supplier' => $record->supplier?->only(['id', 'name']),
            'vendor_invoice_id' => $record->vendor_invoice_id,
            'vendor_payment_batch_id' => $record->vendor_payment_batch_id,
            'invoice_number' => $record->invoice_number,
            'withholding_tax_type' => $record->withholding_tax_type,
            'withholding_tax_rate' => $record->withholding_tax_rate,
            'withholding_tax_base' => $record->withholding_tax_base,
            'base_amount' => $record->base_amount,
            'withholding_amount' => $record->withholding_amount,
            'payment_amount' => $record->payment_amount,
            'status' => $record->status,
            'withheld_at' => $record->withheld_at?->toIso8601String(),
            'remitted_at' => $record->remitted_at?->toIso8601String(),
            'note' => $record->note,
            'created_at' => $record->created_at?->toIso8601String(),
        ];
    }
}
