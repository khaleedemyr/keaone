<?php

namespace App\Services;

use App\Models\GlAccount;
use App\Models\GlJournalEntry;
use App\Models\GlJournalLine;
use App\Models\GoodsReceipt;
use App\Models\User;
use App\Models\VendorInvoice;
use App\Models\VendorPaymentBatch;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GlPostingService
{
    public function __construct(
        private WithholdingTaxService $withholdingTax,
    ) {}

    public function enabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::glPostingEnabled($company);
    }

    /**
     * @return array<string, int|null>
     */
    public function mapping(?\App\Models\Company $company = null): array
    {
        $company ??= CurrentCompany::company();

        return [
            'inventory' => ProcurementSettings::getInt('gl_procurement_inventory_account_id', $company),
            'grni' => ProcurementSettings::getInt('gl_procurement_grni_account_id', $company),
            'ap' => ProcurementSettings::getInt('gl_procurement_ap_account_id', $company),
            'vat_input' => ProcurementSettings::getInt('gl_procurement_vat_input_account_id', $company),
            'cash' => ProcurementSettings::getInt('gl_procurement_cash_account_id', $company),
            'bank' => ProcurementSettings::getInt('gl_procurement_bank_account_id', $company),
            'wht_payable' => ProcurementSettings::getInt('gl_procurement_wht_payable_account_id', $company),
            'expense' => ProcurementSettings::getInt('gl_procurement_expense_account_id', $company),
            'fixed_asset' => ProcurementSettings::getInt('gl_procurement_fixed_asset_account_id', $company),
        ];
    }

    public function postGoodsReceipt(GoodsReceipt $gr, ?User $user = null): ?GlJournalEntry
    {
        if (! $this->enabled()) {
            return null;
        }

        if ($this->hasPosted('goods_receipt', (int) $gr->id)) {
            return null;
        }

        $map = $this->mapping();
        $buckets = $this->receiptLineBuckets($gr);

        $required = ['grni'];
        if ($buckets['inventory'] > 0) {
            $required[] = 'inventory';
        }
        if ($buckets['fixed_asset'] > 0) {
            $required[] = 'fixed_asset';
        }
        if ($buckets['expense'] > 0) {
            $required[] = 'expense';
        }
        $this->assertMapping($map, $required);

        $subtotal = (int) $gr->subtotal;
        $tax = (int) $gr->tax;
        $total = (int) $gr->total;

        if ($total <= 0) {
            return null;
        }

        $lines = [];
        if ($buckets['inventory'] > 0) {
            $lines[] = ['account_id' => $map['inventory'], 'debit' => $buckets['inventory'], 'credit' => 0, 'note' => 'Persediaan'];
        }
        if ($buckets['fixed_asset'] > 0) {
            $lines[] = ['account_id' => $map['fixed_asset'], 'debit' => $buckets['fixed_asset'], 'credit' => 0, 'note' => 'Aset tetap'];
        }
        if ($buckets['expense'] > 0) {
            $lines[] = ['account_id' => $map['expense'], 'debit' => $buckets['expense'], 'credit' => 0, 'note' => 'Beban pembelian'];
        }
        if ($tax > 0 && $map['vat_input']) {
            $lines[] = ['account_id' => $map['vat_input'], 'debit' => $tax, 'credit' => 0, 'note' => 'PPN Masukan'];
        }
        $lines[] = ['account_id' => $map['grni'], 'debit' => 0, 'credit' => $total, 'note' => 'GRNI'];

        return $this->createEntry(
            companyId: (int) $gr->company_id,
            outletId: (int) $gr->outlet_id,
            user: $user,
            sourceType: 'goods_receipt',
            sourceId: (int) $gr->id,
            sourceNumber: $gr->number,
            description: 'Jurnal penerimaan barang '.$gr->number,
            entryDate: $gr->received_at ?? now(),
            lines: $lines,
        );
    }

    public function reverseGoodsReceipt(GoodsReceipt $gr, ?User $user = null): ?GlJournalEntry
    {
        if (! $this->enabled()) {
            return null;
        }

        if ($this->hasPosted('goods_receipt_void', (int) $gr->id)) {
            return null;
        }

        $original = GlJournalEntry::query()
            ->where('company_id', $gr->company_id)
            ->where('source_type', 'goods_receipt')
            ->where('source_id', $gr->id)
            ->where('status', 'posted')
            ->first();

        if (! $original) {
            return null;
        }

        $original->load('lines');
        $lines = $original->lines->map(fn (GlJournalLine $line) => [
            'account_id' => (int) $line->gl_account_id,
            'debit' => (int) $line->credit,
            'credit' => (int) $line->debit,
            'note' => 'Reversal '.$line->note,
        ])->values()->all();

        $reversal = $this->createEntry(
            companyId: (int) $gr->company_id,
            outletId: (int) $gr->outlet_id,
            user: $user,
            sourceType: 'goods_receipt_void',
            sourceId: (int) $gr->id,
            sourceNumber: $gr->number,
            description: 'Reversal penerimaan barang '.$gr->number,
            entryDate: now(),
            lines: $lines,
        );

        $original->update(['status' => 'reversed', 'reversed_entry_id' => $reversal->id]);

        return $reversal;
    }

    public function postVendorInvoice(VendorInvoice $invoice, ?User $user = null): ?GlJournalEntry
    {
        if (! $this->enabled()) {
            return null;
        }

        if ($this->hasPosted('vendor_invoice', (int) $invoice->id)) {
            return null;
        }

        $map = $this->mapping();
        $this->assertMapping($map, ['ap']);

        $subtotal = (int) $invoice->subtotal;
        $tax = (int) $invoice->tax;
        $total = (int) $invoice->total;

        if ($total <= 0) {
            return null;
        }

        $lines = [];

        if ($invoice->goods_receipt_id && $map['grni']) {
            $clearAmount = $subtotal + $tax;
            if ($clearAmount > 0) {
                $lines[] = ['account_id' => $map['grni'], 'debit' => $clearAmount, 'credit' => 0, 'note' => 'Clear GRNI'];
            }
        } else {
            $debitAccount = $map['inventory'] ?: $map['expense'];
            if (! $debitAccount) {
                throw ValidationException::withMessages([
                    'gl' => ['Mapping akun persediaan atau beban belum diatur.'],
                ]);
            }
            if ($subtotal > 0) {
                $lines[] = ['account_id' => $debitAccount, 'debit' => $subtotal, 'credit' => 0, 'note' => 'Pembelian'];
            }
            if ($tax > 0 && $map['vat_input']) {
                $lines[] = ['account_id' => $map['vat_input'], 'debit' => $tax, 'credit' => 0, 'note' => 'PPN Masukan'];
            }
        }

        $lines[] = ['account_id' => $map['ap'], 'debit' => 0, 'credit' => $total, 'note' => 'Utang usaha'];

        return $this->createEntry(
            companyId: (int) $invoice->company_id,
            outletId: (int) $invoice->outlet_id,
            user: $user,
            sourceType: 'vendor_invoice',
            sourceId: (int) $invoice->id,
            sourceNumber: $invoice->number,
            description: 'Jurnal tagihan supplier '.$invoice->number,
            entryDate: $invoice->confirmed_at ?? now(),
            lines: $lines,
        );
    }

    public function postPaymentBatch(VendorPaymentBatch $batch, ?User $user = null): ?GlJournalEntry
    {
        if (! $this->enabled()) {
            return null;
        }

        if ($this->hasPosted('vendor_payment_batch', (int) $batch->id)) {
            return null;
        }

        $map = $this->mapping();
        $this->assertMapping($map, ['ap']);

        $batch->load(['items.vendorInvoice']);

        $cashAccount = (string) $batch->payment_method === 'cash'
            ? ($map['cash'] ?: $map['bank'])
            : ($map['bank'] ?: $map['cash']);

        if (! $cashAccount) {
            throw ValidationException::withMessages([
                'gl' => ['Mapping akun kas/bank belum diatur.'],
            ]);
        }

        $lines = [];
        $totalCash = 0;
        $totalAp = 0;
        $totalWht = 0;

        foreach ($batch->items as $item) {
            $invoice = $item->vendorInvoice;
            if (! $invoice) {
                continue;
            }

            $payment = (int) $item->amount;
            $wht = $this->withholdingTax->withholdingForPayment($invoice, $payment);
            $apClear = $payment + $wht;

            if ($apClear <= 0) {
                continue;
            }

            $totalAp += $apClear;
            $totalCash += $payment;
            $totalWht += $wht;
        }

        if ($totalAp <= 0) {
            return null;
        }

        $lines[] = ['account_id' => $map['ap'], 'debit' => $totalAp, 'credit' => 0, 'note' => 'Pelunasan utang'];
        if ($totalCash > 0) {
            $lines[] = ['account_id' => $cashAccount, 'debit' => 0, 'credit' => $totalCash, 'note' => 'Pembayaran'];
        }
        if ($totalWht > 0 && $map['wht_payable']) {
            $lines[] = ['account_id' => $map['wht_payable'], 'debit' => 0, 'credit' => $totalWht, 'note' => 'PPh dipotong'];
        } elseif ($totalWht > 0) {
            $lines[] = ['account_id' => $cashAccount, 'debit' => 0, 'credit' => $totalWht, 'note' => 'PPh dipotong'];
        }

        return $this->createEntry(
            companyId: (int) $batch->company_id,
            outletId: $batch->outlet_id ? (int) $batch->outlet_id : null,
            user: $user,
            sourceType: 'vendor_payment_batch',
            sourceId: (int) $batch->id,
            sourceNumber: $batch->number,
            description: 'Jurnal pembayaran supplier '.$batch->number,
            entryDate: $batch->paid_at ?? now(),
            lines: $lines,
        );
    }

    public function serialize(GlJournalEntry $entry): array
    {
        $entry->load(['lines.account:id,code,name,account_type', 'user:id,name']);

        return [
            'id' => $entry->id,
            'number' => $entry->number,
            'entry_date' => $entry->entry_date?->toDateString(),
            'source_type' => $entry->source_type,
            'source_id' => $entry->source_id,
            'source_number' => $entry->source_number,
            'description' => $entry->description,
            'status' => $entry->status,
            'total_debit' => $entry->total_debit,
            'total_credit' => $entry->total_credit,
            'user' => $entry->user?->only(['id', 'name']),
            'lines' => $entry->lines->map(fn (GlJournalLine $line) => [
                'id' => $line->id,
                'line_no' => $line->line_no,
                'debit' => $line->debit,
                'credit' => $line->credit,
                'note' => $line->note,
                'account' => $line->account?->only(['id', 'code', 'name', 'account_type']),
            ])->values(),
            'created_at' => $entry->created_at?->toIso8601String(),
        ];
    }

    private function hasPosted(string $sourceType, int $sourceId): bool
    {
        return GlJournalEntry::query()
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->where('status', 'posted')
            ->exists();
    }

    /**
     * @return array{inventory: int, fixed_asset: int, expense: int}
     */
    private function receiptLineBuckets(GoodsReceipt $gr): array
    {
        $gr->loadMissing(['items.product']);

        $inventory = 0;
        $fixedAsset = 0;
        $expense = 0;

        foreach ($gr->items as $item) {
            $total = (int) $item->total;
            $product = $item->product;

            if ($product?->is_fixed_asset_item) {
                $fixedAsset += $total;
            } elseif ($product?->track_stock) {
                $inventory += $total;
            } else {
                $expense += $total;
            }
        }

        return [
            'inventory' => $inventory,
            'fixed_asset' => $fixedAsset,
            'expense' => $expense,
        ];
    }

    /**
     * @param  array<string, int|null>  $map
     * @param  list<string>  $required
     */
    private function assertMapping(array $map, array $required): void
    {
        foreach ($required as $key) {
            if (empty($map[$key])) {
                throw ValidationException::withMessages([
                    'gl' => ["Mapping akun GL ({$key}) belum diatur di Pengaturan Procurement."],
                ]);
            }
        }
    }

    /**
     * @param  list<array{account_id: int, debit: int, credit: int, note?: ?string}>  $lines
     */
    private function createEntry(
        int $companyId,
        ?int $outletId,
        ?User $user,
        string $sourceType,
        int $sourceId,
        ?string $sourceNumber,
        string $description,
        \DateTimeInterface $entryDate,
        array $lines,
    ): GlJournalEntry {
        $normalized = array_values(array_filter($lines, fn (array $row) => ((int) $row['debit']) > 0 || ((int) $row['credit']) > 0));

        if ($normalized === []) {
            throw ValidationException::withMessages(['gl' => ['Jurnal tidak punya baris.']]);
        }

        $totalDebit = array_sum(array_column($normalized, 'debit'));
        $totalCredit = array_sum(array_column($normalized, 'credit'));

        if ($totalDebit !== $totalCredit) {
            throw ValidationException::withMessages([
                'gl' => ["Jurnal tidak balance (Dr {$totalDebit} vs Cr {$totalCredit})."],
            ]);
        }

        return DB::transaction(function () use (
            $companyId,
            $outletId,
            $user,
            $sourceType,
            $sourceId,
            $sourceNumber,
            $description,
            $entryDate,
            $normalized,
            $totalDebit,
            $totalCredit,
        ) {
            $entry = GlJournalEntry::query()->create([
                'company_id' => $companyId,
                'outlet_id' => $outletId,
                'user_id' => $user?->id,
                'number' => $this->nextNumber($companyId),
                'entry_date' => $entryDate,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'source_number' => $sourceNumber,
                'description' => $description,
                'status' => 'posted',
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
            ]);

            foreach ($normalized as $index => $row) {
                GlAccount::query()->findOrFail($row['account_id']);
                $entry->lines()->create([
                    'gl_account_id' => $row['account_id'],
                    'line_no' => $index + 1,
                    'debit' => (int) $row['debit'],
                    'credit' => (int) $row['credit'],
                    'note' => $row['note'] ?? null,
                ]);
            }

            return $entry->fresh(['lines.account']);
        });
    }

    private function nextNumber(int $companyId): string
    {
        $prefix = 'JE-'.now()->format('ymd').'-';
        $last = GlJournalEntry::query()
            ->where('company_id', $companyId)
            ->where('number', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('number');

        $seq = 1;
        if (is_string($last) && preg_match('/-(\d+)$/', $last, $m)) {
            $seq = (int) $m[1] + 1;
        }

        return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }
}
