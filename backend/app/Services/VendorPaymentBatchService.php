<?php

namespace App\Services;

use App\Models\CompanyUser;
use App\Models\Outlet;
use App\Models\User;
use App\Models\VendorInvoice;
use App\Models\VendorPaymentBatch;
use App\Models\VendorPaymentBatchApproval;
use App\Models\VendorPaymentBatchItem;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VendorPaymentBatchService
{
    public function __construct(
        private NotificationService $notifications,
        private WithholdingTaxService $withholdingTax,
        private GlPostingService $glPosting,
    ) {}

    public function enabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::vendorPaymentBatchEnabled($company);
    }

    public function needApproval(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::vendorPaymentBatchNeedApproval($company);
    }

    public function create(array $payload, User $user): VendorPaymentBatch
    {
        $this->assertEnabled();

        $existing = VendorPaymentBatch::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadBatch($existing);
        }

        try {
            return DB::transaction(fn () => $this->writeBatch($payload, $user));
        } catch (UniqueConstraintViolationException) {
            $row = VendorPaymentBatch::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadBatch($row);
        }
    }

    public function update(VendorPaymentBatch $batch, array $payload): VendorPaymentBatch
    {
        if (! in_array($batch->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['Batch hanya bisa diubah saat draft atau ditolak.']]);
        }

        return DB::transaction(function () use ($batch, $payload) {
            $batch->update([
                'payment_method' => $payload['payment_method'] ?? $batch->payment_method,
                'note' => array_key_exists('note', $payload) ? $payload['note'] : $batch->note,
            ]);

            if (isset($payload['items'])) {
                $batch->items()->delete();
                $total = $this->attachItems($batch, $payload['items']);
                $batch->update(['total' => $total]);
            }

            if (array_key_exists('approvals', $payload) || $this->needApproval()) {
                $this->syncApprovals($batch, $payload['approvals'] ?? []);
            }

            return $this->loadBatch($batch->fresh());
        });
    }

    public function submit(VendorPaymentBatch $batch): VendorPaymentBatch
    {
        if (! in_array($batch->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['Hanya draft atau ditolak yang bisa diajukan.']]);
        }
        if ($batch->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Batch belum punya invoice.']]);
        }

        $result = DB::transaction(function () use ($batch) {
            $batch = VendorPaymentBatch::query()->whereKey($batch->id)->lockForUpdate()->firstOrFail();
            $this->assertItemsPayable($batch);

            if ($this->needApproval()) {
                $levels = $batch->approvals()->orderBy('level')->get();
                if ($levels->isEmpty()) {
                    throw ValidationException::withMessages([
                        'approvals' => ['Batch membutuhkan approval. Pilih minimal satu approver dan urutkan levelnya.'],
                    ]);
                }
                foreach ($levels as $row) {
                    $row->update([
                        'status' => 'pending',
                        'acted_by' => null,
                        'acted_at' => null,
                        'note' => null,
                    ]);
                }
                $batch->update([
                    'status' => 'submitted',
                    'approved_by' => null,
                    'approved_at' => null,
                    'current_approval_level' => 1,
                ]);
            } else {
                $batch->approvals()->delete();
                $batch->update([
                    'status' => 'submitted',
                    'approved_by' => null,
                    'approved_at' => null,
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadBatch($batch->fresh());
        });

        if ($this->needApproval()) {
            $this->notifyCurrentApprover($result);
        }

        return $result;
    }

    public function approve(VendorPaymentBatch $batch, User $user): VendorPaymentBatch
    {
        if ($batch->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya batch yang diajukan yang bisa disetujui.']]);
        }

        $result = DB::transaction(function () use ($batch, $user) {
            $batch = VendorPaymentBatch::query()->whereKey($batch->id)->lockForUpdate()->firstOrFail();

            if (! $this->needApproval() || $batch->approvals()->count() === 0) {
                $batch->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);

                return $this->loadBatch($batch->fresh());
            }

            $level = (int) ($batch->current_approval_level ?: 1);
            $step = VendorPaymentBatchApproval::query()
                ->where('vendor_payment_batch_id', $batch->id)
                ->where('level', $level)
                ->lockForUpdate()
                ->first();

            if (! $step || $step->status !== 'pending') {
                throw ValidationException::withMessages([
                    'approvals' => ['Tidak ada tahap approval yang menunggu di level ini.'],
                ]);
            }
            if ((int) $step->user_id !== (int) $user->id) {
                throw ValidationException::withMessages([
                    'approvals' => ['Belum giliran Anda. Approval harus berurutan per level.'],
                ]);
            }

            $step->update([
                'status' => 'approved',
                'acted_by' => $user->id,
                'acted_at' => now(),
            ]);

            $nextLevel = $level + 1;
            $hasNext = VendorPaymentBatchApproval::query()
                ->where('vendor_payment_batch_id', $batch->id)
                ->where('level', $nextLevel)
                ->exists();

            if ($hasNext) {
                $batch->update(['current_approval_level' => $nextLevel]);
            } else {
                $batch->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadBatch($batch->fresh());
        });

        if ($result->status === 'submitted') {
            $this->notifyCurrentApprover($result);
        } else {
            $this->notifyCreator($result, 'notifPaymentBatchApprovedTitle', 'notifPaymentBatchApprovedBody', 'success');
        }

        return $result;
    }

    public function reject(VendorPaymentBatch $batch, User $user, ?string $note = null): VendorPaymentBatch
    {
        if ($batch->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya batch yang diajukan yang bisa ditolak.']]);
        }

        return DB::transaction(function () use ($batch, $user, $note) {
            $batch = VendorPaymentBatch::query()->whereKey($batch->id)->lockForUpdate()->firstOrFail();

            if ($this->needApproval() && $batch->approvals()->count() > 0) {
                $level = (int) ($batch->current_approval_level ?: 1);
                $step = VendorPaymentBatchApproval::query()
                    ->where('vendor_payment_batch_id', $batch->id)
                    ->where('level', $level)
                    ->lockForUpdate()
                    ->first();

                if (! $step || $step->status !== 'pending') {
                    throw ValidationException::withMessages([
                        'approvals' => ['Tidak ada tahap approval yang menunggu di level ini.'],
                    ]);
                }
                if ((int) $step->user_id !== (int) $user->id) {
                    throw ValidationException::withMessages([
                        'approvals' => ['Hanya approver di level saat ini yang boleh menolak.'],
                    ]);
                }

                $step->update([
                    'status' => 'rejected',
                    'acted_by' => $user->id,
                    'acted_at' => now(),
                    'note' => $note,
                ]);
            }

            $batch->update([
                'status' => 'rejected',
                'current_approval_level' => null,
            ]);

            $loaded = $this->loadBatch($batch->fresh());
            $this->notifyCreator($loaded, 'notifPaymentBatchRejectedTitle', 'notifPaymentBatchRejectedBody', 'warning');

            return $loaded;
        });
    }

    public function pay(VendorPaymentBatch $batch, User $user): VendorPaymentBatch
    {
        $requiredStatus = $this->needApproval() ? 'approved' : 'submitted';
        if ($batch->status !== $requiredStatus) {
            throw ValidationException::withMessages([
                'status' => [$this->needApproval()
                    ? 'Hanya batch yang disetujui yang bisa dibayar.'
                    : 'Hanya batch yang diajukan yang bisa dibayar.'],
            ]);
        }
        if (! $batch->payment_method) {
            throw ValidationException::withMessages(['payment_method' => ['Pilih metode pembayaran.']]);
        }

        return DB::transaction(function () use ($batch, $user) {
            $batch = VendorPaymentBatch::query()->whereKey($batch->id)->lockForUpdate()->firstOrFail();
            $batch->load('items.vendorInvoice');

            $this->assertItemsPayable($batch);
            $paidAt = now();

            foreach ($batch->items as $item) {
                $invoice = VendorInvoice::query()->whereKey($item->vendor_invoice_id)->lockForUpdate()->firstOrFail();
                $due = $invoice->amountDue();

                if ((int) $item->amount > $due) {
                    throw ValidationException::withMessages([
                        'items' => ["Jumlah bayar melebihi sisa tagihan invoice {$invoice->number}."],
                    ]);
                }

                $invoice->payments()->create([
                    'company_id' => $invoice->company_id,
                    'outlet_id' => $batch->outlet_id ?? $invoice->outlet_id,
                    'user_id' => $user->id,
                    'direction' => 'out',
                    'method' => (string) $batch->payment_method,
                    'amount' => (int) $item->amount,
                    'paid_at' => $paidAt,
                    'client_uuid' => Str::uuid()->toString(),
                    'note' => $batch->note,
                ]);

                $invoice->update([
                    'amount_paid' => (int) $invoice->amount_paid + (int) $item->amount,
                ]);

                $this->withholdingTax->recordFromPayment($invoice, $batch, (int) $item->amount, $paidAt);
            }

            $batch->update([
                'status' => 'paid',
                'paid_at' => $paidAt,
            ]);

            $this->glPosting->postPaymentBatch($batch->fresh(), $user);

            return $this->loadBatch($batch->fresh());
        });
    }

    public function cancel(VendorPaymentBatch $batch): VendorPaymentBatch
    {
        if ($batch->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dibatalkan.']]);
        }

        $batch->update(['status' => 'cancelled']);

        return $this->loadBatch($batch->fresh());
    }

    public function serialize(VendorPaymentBatch $batch): array
    {
        $batch = $this->loadBatch($batch);
        $needApproval = $this->needApproval();
        $meId = auth()->id();
        $currentLevel = $batch->current_approval_level ? (int) $batch->current_approval_level : null;
        $currentStep = $currentLevel
            ? $batch->approvals->firstWhere('level', $currentLevel)
            : null;
        $canApprove = $batch->status === 'submitted' && (
            (! $needApproval || $batch->approvals->isEmpty())
                ? true
                : ($currentStep && (int) $currentStep->user_id === (int) $meId && $currentStep->status === 'pending')
        );
        $approvalPositions = $this->positionNamesForUsers(
            (int) $batch->company_id,
            $batch->approvals->pluck('user_id')->map(fn ($id) => (int) $id)->all(),
        );

        return [
            'id' => $batch->id,
            'number' => $batch->number,
            'client_uuid' => $batch->client_uuid,
            'status' => $batch->status,
            'payment_method' => $batch->payment_method,
            'total' => $batch->total,
            'note' => $batch->note,
            'paid_at' => $batch->paid_at?->toIso8601String(),
            'created_at' => $batch->created_at?->toIso8601String(),
            'user' => $batch->user?->only(['id', 'name']),
            'batch_need_approval' => $needApproval,
            'current_approval_level' => $currentLevel,
            'can_approve' => (bool) $canApprove,
            'approvals' => $batch->approvals->map(fn (VendorPaymentBatchApproval $row) => [
                'id' => $row->id,
                'level' => (int) $row->level,
                'user_id' => (int) $row->user_id,
                'user' => $this->serializeApprovalUser($row->user, $approvalPositions, (int) $row->user_id),
                'status' => $row->status,
                'acted_at' => $row->acted_at?->toIso8601String(),
                'is_current' => $batch->status === 'submitted' && $currentLevel === (int) $row->level,
            ])->values(),
            'items' => $batch->items->map(fn (VendorPaymentBatchItem $item) => [
                'id' => $item->id,
                'vendor_invoice_id' => $item->vendor_invoice_id,
                'amount' => $item->amount,
                'vendor_invoice' => $item->vendorInvoice ? [
                    'id' => $item->vendorInvoice->id,
                    'number' => $item->vendorInvoice->number,
                    'vendor_ref' => $item->vendorInvoice->vendor_ref,
                    'total' => $item->vendorInvoice->total,
                    'withholding_tax' => (int) $item->vendorInvoice->withholding_tax,
                    'amount_payable' => $item->vendorInvoice->payableTotal(),
                    'amount_paid' => $item->vendorInvoice->amount_paid,
                    'amount_due' => $item->vendorInvoice->amountDue(),
                    'payment_status' => $item->vendorInvoice->paymentStatus(),
                    'supplier' => $item->vendorInvoice->supplier?->only(['id', 'name']),
                ] : null,
            ])->values(),
        ];
    }

    public function loadBatch(VendorPaymentBatch $batch): VendorPaymentBatch
    {
        return $batch->load([
            'items.vendorInvoice.supplier:id,name',
            'user:id,name',
            'approvals.user:id,name',
        ]);
    }

    private function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'batch' => ['Modul payment batch tidak aktif. Aktifkan di Pengaturan Procurement.'],
            ]);
        }
    }

    private function writeBatch(array $payload, User $user): VendorPaymentBatch
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        $companyId = (int) $company->id;
        $outletId = (int) (Outlet::query()
            ->where('company_id', $companyId)
            ->orderByDesc('is_default')
            ->value('id') ?? 0);

        $batch = VendorPaymentBatch::query()->create([
            'company_id' => $companyId,
            'outlet_id' => $outletId,
            'user_id' => $user->id,
            'number' => $this->nextNumber($companyId),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'payment_method' => $payload['payment_method'] ?? null,
            'total' => 0,
            'note' => $payload['note'] ?? null,
        ]);

        $total = $this->attachItems($batch, $payload['items'] ?? []);
        $batch->update(['total' => $total]);

        if (array_key_exists('approvals', $payload) || $this->needApproval()) {
            $this->syncApprovals($batch, $payload['approvals'] ?? []);
        }

        return $this->loadBatch($batch->fresh());
    }

    /**
     * @param  list<array{vendor_invoice_id?: int, amount?: int}>  $items
     */
    private function attachItems(VendorPaymentBatch $batch, array $items): int
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 invoice.']]);
        }

        $total = 0;
        $seen = [];

        foreach ($items as $row) {
            $invoiceId = (int) ($row['vendor_invoice_id'] ?? 0);
            if ($invoiceId < 1) {
                throw ValidationException::withMessages(['items' => ['Invoice tidak valid.']]);
            }
            if (isset($seen[$invoiceId])) {
                throw ValidationException::withMessages(['items' => ['Invoice tidak boleh dobel dalam satu batch.']]);
            }
            $seen[$invoiceId] = true;

            $invoice = VendorInvoice::query()->findOrFail($invoiceId);
            $this->assertInvoicePayable($invoice);

            $amount = array_key_exists('amount', $row) ? (int) $row['amount'] : $invoice->amountDue();
            if ($amount < 1) {
                throw ValidationException::withMessages(['items' => ["Jumlah bayar invoice {$invoice->number} harus lebih dari 0."]]);
            }
            if ($amount > $invoice->amountDue()) {
                throw ValidationException::withMessages([
                    'items' => ["Jumlah bayar melebihi sisa tagihan invoice {$invoice->number}."],
                ]);
            }

            $batch->items()->create([
                'vendor_invoice_id' => $invoiceId,
                'amount' => $amount,
            ]);
            $total += $amount;
        }

        return $total;
    }

    private function assertItemsPayable(VendorPaymentBatch $batch): void
    {
        foreach ($batch->items as $item) {
            $invoice = VendorInvoice::query()->find($item->vendor_invoice_id);
            if (! $invoice) {
                throw ValidationException::withMessages(['items' => ['Invoice tidak ditemukan.']]);
            }
            $this->assertInvoicePayable($invoice);
            if ((int) $item->amount > $invoice->amountDue()) {
                throw ValidationException::withMessages([
                    'items' => ["Jumlah bayar melebihi sisa tagihan invoice {$invoice->number}."],
                ]);
            }

            $conflict = VendorPaymentBatchItem::query()
                ->where('vendor_invoice_id', $invoice->id)
                ->where('vendor_payment_batch_id', '!=', $batch->id)
                ->whereHas('batch', fn ($q) => $q->whereIn('status', ['submitted', 'approved', 'paid']))
                ->exists();

            if ($conflict) {
                throw ValidationException::withMessages([
                    'items' => ["Invoice {$invoice->number} sudah ada di batch lain yang diajukan/dibayar."],
                ]);
            }
        }
    }

    private function assertInvoicePayable(VendorInvoice $invoice): void
    {
        if ($invoice->status !== 'confirmed') {
            throw ValidationException::withMessages([
                'items' => ["Invoice {$invoice->number} harus sudah dikonfirmasi."],
            ]);
        }
        if ($invoice->amountDue() < 1) {
            throw ValidationException::withMessages([
                'items' => ["Invoice {$invoice->number} sudah lunas."],
            ]);
        }
    }

    /**
     * @param  list<array{user_id?: int}>  $approvals
     */
    private function syncApprovals(VendorPaymentBatch $batch, array $approvals): void
    {
        $batch->approvals()->delete();

        if ($approvals === []) {
            if ($this->needApproval()) {
                throw ValidationException::withMessages([
                    'approvals' => ['Pilih minimal satu approver dan urutkan levelnya.'],
                ]);
            }

            return;
        }

        $companyId = (int) $batch->company_id;
        $seen = [];
        $level = 1;
        foreach ($approvals as $row) {
            $userId = (int) ($row['user_id'] ?? 0);
            if ($userId < 1) {
                continue;
            }
            if (isset($seen[$userId])) {
                throw ValidationException::withMessages([
                    'approvals' => ['Approver tidak boleh dobel di beberapa level.'],
                ]);
            }
            $ok = CompanyUser::query()
                ->where('company_id', $companyId)
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->exists();
            if (! $ok) {
                throw ValidationException::withMessages([
                    'approvals' => ['Approver tidak valid / tidak aktif di perusahaan ini.'],
                ]);
            }
            $seen[$userId] = true;
            VendorPaymentBatchApproval::query()->create([
                'company_id' => $companyId,
                'vendor_payment_batch_id' => $batch->id,
                'level' => $level,
                'user_id' => $userId,
                'status' => 'pending',
            ]);
            $level++;
        }

        if ($this->needApproval() && $seen === []) {
            throw ValidationException::withMessages([
                'approvals' => ['Pilih minimal satu approver dan urutkan levelnya.'],
            ]);
        }
    }

    private function notifyCurrentApprover(VendorPaymentBatch $batch): void
    {
        $level = (int) ($batch->current_approval_level ?: 1);
        $step = $batch->approvals->firstWhere('level', $level);
        if (! $step) {
            return;
        }

        $this->notifications->notify(
            (int) $step->user_id,
            'notifPaymentBatchApprovalNeededTitle',
            'notifPaymentBatchApprovalNeededBody',
            [
                'number' => $batch->number,
                'requester' => $batch->user?->name ?? '-',
                'level' => (string) $step->level,
            ],
            [
                'type' => 'vendor_payment_batch',
                'id' => $batch->id,
                'app' => 'approvals',
            ],
            'info',
            (int) $batch->company_id,
        );
    }

    private function notifyCreator(VendorPaymentBatch $batch, string $titleKey, string $bodyKey, string $tone): void
    {
        if (! $batch->user_id) {
            return;
        }

        $this->notifications->notify(
            (int) $batch->user_id,
            $titleKey,
            $bodyKey,
            ['number' => $batch->number],
            [
                'type' => 'vendor_payment_batch',
                'id' => $batch->id,
                'app' => 'purchase',
            ],
            $tone,
            (int) $batch->company_id,
        );
    }

    private function nextNumber(int $companyId): string
    {
        $full = 'VPB-'.now()->format('ymd').'-';
        $last = VendorPaymentBatch::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('number', 'like', $full.'%')
            ->orderByDesc('number')
            ->lockForUpdate()
            ->value('number');

        $seq = $last ? ((int) substr((string) $last, -3)) + 1 : 1;

        return $full.str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
    }

    /**
     * @param  list<int>  $userIds
     * @return array<int, string>
     */
    private function positionNamesForUsers(int $companyId, array $userIds): array
    {
        $userIds = array_values(array_unique(array_filter($userIds)));
        if ($userIds === []) {
            return [];
        }

        return CompanyUser::query()
            ->where('company_id', $companyId)
            ->whereIn('user_id', $userIds)
            ->with('position:id,name')
            ->get()
            ->mapWithKeys(fn (CompanyUser $row) => [
                (int) $row->user_id => (string) ($row->position?->name ?? ''),
            ])
            ->filter(fn (string $name) => $name !== '')
            ->all();
    }

    /**
     * @param  array<int, string>  $positions
     * @return array{id: int, name: string, position?: string}|null
     */
    private function serializeApprovalUser(?User $user, array $positions, int $userId): ?array
    {
        if (! $user) {
            return null;
        }

        $payload = $user->only(['id', 'name']);
        if ($position = $positions[$userId] ?? null) {
            $payload['position'] = $position;
        }

        return $payload;
    }
}
