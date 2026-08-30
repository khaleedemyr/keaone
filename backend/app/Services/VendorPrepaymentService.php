<?php

namespace App\Services;

use App\Models\CompanyUser;
use App\Models\Outlet;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Models\VendorInvoice;
use App\Models\VendorPrepayment;
use App\Models\VendorPrepaymentApplication;
use App\Models\VendorPrepaymentApproval;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VendorPrepaymentService
{
    public function __construct(
        private NotificationService $notifications,
    ) {}

    public function enabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::vendorPrepaymentEnabled($company);
    }

    public function needApproval(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::vendorPrepaymentNeedApproval($company);
    }

    public function create(array $payload, User $user): VendorPrepayment
    {
        $this->assertEnabled();

        $existing = VendorPrepayment::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadPrepayment($existing);
        }

        try {
            return DB::transaction(fn () => $this->writePrepayment($payload, $user));
        } catch (UniqueConstraintViolationException) {
            $row = VendorPrepayment::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadPrepayment($row);
        }
    }

    public function update(VendorPrepayment $prepayment, array $payload): VendorPrepayment
    {
        if (! in_array($prepayment->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['Uang muka hanya bisa diubah saat draft atau ditolak.']]);
        }

        return DB::transaction(function () use ($prepayment, $payload) {
            $supplierId = array_key_exists('supplier_id', $payload)
                ? (int) $payload['supplier_id']
                : (int) $prepayment->supplier_id;
            $poId = array_key_exists('purchase_order_id', $payload)
                ? ($payload['purchase_order_id'] ? (int) $payload['purchase_order_id'] : null)
                : $prepayment->purchase_order_id;

            if ($poId) {
                $this->assertPurchaseOrder($poId, $supplierId);
            }

            $prepayment->update([
                'supplier_id' => $supplierId,
                'purchase_order_id' => $poId,
                'amount' => array_key_exists('amount', $payload) ? (int) $payload['amount'] : $prepayment->amount,
                'payment_method' => $payload['payment_method'] ?? $prepayment->payment_method,
                'note' => array_key_exists('note', $payload) ? $payload['note'] : $prepayment->note,
            ]);

            if (array_key_exists('approvals', $payload) || $this->needApproval()) {
                $this->syncApprovals($prepayment, $payload['approvals'] ?? []);
            }

            if (array_key_exists('items', $payload)) {
                $this->syncPlannedApplications($prepayment->fresh(), $payload['items'] ?? []);
            }

            return $this->loadPrepayment($prepayment->fresh());
        });
    }

    public function submit(VendorPrepayment $prepayment): VendorPrepayment
    {
        if (! in_array($prepayment->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['Uang muka tidak bisa diajukan.']]);
        }
        if ((int) $prepayment->amount < 1) {
            throw ValidationException::withMessages(['amount' => ['Jumlah uang muka harus lebih dari 0.']]);
        }

        $result = DB::transaction(function () use ($prepayment) {
            $prepayment = VendorPrepayment::query()->whereKey($prepayment->id)->lockForUpdate()->firstOrFail();

            if ($this->needApproval()) {
                $levels = $prepayment->approvals()->orderBy('level')->get();
                if ($levels->isEmpty()) {
                    throw ValidationException::withMessages([
                        'approvals' => ['Uang muka membutuhkan approval. Pilih minimal satu approver dan urutkan levelnya.'],
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
                $prepayment->update([
                    'status' => 'submitted',
                    'approved_by' => null,
                    'approved_at' => null,
                    'current_approval_level' => 1,
                ]);
            } else {
                $prepayment->approvals()->delete();
                $prepayment->update([
                    'status' => 'approved',
                    'approved_by' => null,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadPrepayment($prepayment->fresh());
        });

        if ($this->needApproval()) {
            $this->notifyCurrentApprover($result);
        }

        return $result;
    }

    public function approve(VendorPrepayment $prepayment, User $user): VendorPrepayment
    {
        if ($prepayment->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya uang muka yang diajukan yang bisa disetujui.']]);
        }

        $result = DB::transaction(function () use ($prepayment, $user) {
            $prepayment = VendorPrepayment::query()->whereKey($prepayment->id)->lockForUpdate()->firstOrFail();

            if (! $this->needApproval() || $prepayment->approvals()->count() === 0) {
                $prepayment->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);

                return $this->loadPrepayment($prepayment->fresh());
            }

            $level = (int) ($prepayment->current_approval_level ?: 1);
            $step = VendorPrepaymentApproval::query()
                ->where('vendor_prepayment_id', $prepayment->id)
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
            $hasNext = VendorPrepaymentApproval::query()
                ->where('vendor_prepayment_id', $prepayment->id)
                ->where('level', $nextLevel)
                ->exists();

            if ($hasNext) {
                $prepayment->update(['current_approval_level' => $nextLevel]);
            } else {
                $prepayment->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadPrepayment($prepayment->fresh());
        });

        if ($result->status === 'submitted') {
            $this->notifyCurrentApprover($result);
        } else {
            $this->notifyCreator($result, 'notifPrepaymentApprovedTitle', 'notifPrepaymentApprovedBody', 'success');
        }

        return $result;
    }

    public function reject(VendorPrepayment $prepayment, User $user, ?string $note = null): VendorPrepayment
    {
        if ($prepayment->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya uang muka yang diajukan yang bisa ditolak.']]);
        }

        return DB::transaction(function () use ($prepayment, $user, $note) {
            $prepayment = VendorPrepayment::query()->whereKey($prepayment->id)->lockForUpdate()->firstOrFail();

            if ($this->needApproval() && $prepayment->approvals()->count() > 0) {
                $level = (int) ($prepayment->current_approval_level ?: 1);
                $step = VendorPrepaymentApproval::query()
                    ->where('vendor_prepayment_id', $prepayment->id)
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

            $prepayment->update([
                'status' => 'rejected',
                'current_approval_level' => null,
            ]);

            $loaded = $this->loadPrepayment($prepayment->fresh());
            $this->notifyCreator($loaded, 'notifPrepaymentRejectedTitle', 'notifPrepaymentRejectedBody', 'warning');

            return $loaded;
        });
    }

    public function pay(VendorPrepayment $prepayment, User $user): VendorPrepayment
    {
        $allowedStatuses = $this->needApproval() ? ['approved'] : ['draft'];
        if (! in_array($prepayment->status, $allowedStatuses, true)) {
            throw ValidationException::withMessages([
                'status' => [$this->needApproval()
                    ? 'Hanya uang muka yang disetujui yang bisa dibayar.'
                    : 'Hanya draft yang bisa dibayar.'],
            ]);
        }
        if ((int) $prepayment->amount < 1) {
            throw ValidationException::withMessages(['amount' => ['Jumlah uang muka harus lebih dari 0.']]);
        }
        if (! $prepayment->payment_method) {
            throw ValidationException::withMessages(['payment_method' => ['Pilih metode pembayaran.']]);
        }

        return DB::transaction(function () use ($prepayment, $user) {
            $prepayment = VendorPrepayment::query()->whereKey($prepayment->id)->lockForUpdate()->firstOrFail();
            $paidAt = now();

            $prepayment->payments()->create([
                'company_id' => $prepayment->company_id,
                'outlet_id' => $prepayment->outlet_id,
                'user_id' => $user->id,
                'direction' => 'out',
                'method' => (string) $prepayment->payment_method,
                'amount' => (int) $prepayment->amount,
                'paid_at' => $paidAt,
                'client_uuid' => Str::uuid()->toString(),
                'note' => $prepayment->note,
            ]);

            $prepayment->update([
                'status' => 'paid',
                'paid_at' => $paidAt,
            ]);

            return $this->loadPrepayment($prepayment->fresh());
        });
    }

    /**
     * @param  list<array{vendor_invoice_id?: int, amount?: int}>  $items
     */
    public function apply(VendorPrepayment $prepayment, array $items): VendorPrepayment
    {
        if (! in_array($prepayment->status, ['paid'], true)) {
            throw ValidationException::withMessages(['status' => ['Hanya uang muka yang sudah dibayar yang bisa dialokasikan.']]);
        }
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 invoice.']]);
        }

        return DB::transaction(function () use ($prepayment, $items) {
            $prepayment = VendorPrepayment::query()->whereKey($prepayment->id)->lockForUpdate()->firstOrFail();
            $balance = $prepayment->amountBalance();
            $totalApply = 0;
            $appliedAt = now();

            foreach ($items as $row) {
                $invoiceId = (int) ($row['vendor_invoice_id'] ?? 0);
                $amount = (int) ($row['amount'] ?? 0);
                if ($invoiceId < 1 || $amount < 1) {
                    throw ValidationException::withMessages(['items' => ['Invoice atau jumlah tidak valid.']]);
                }

                $invoice = VendorInvoice::query()->whereKey($invoiceId)->lockForUpdate()->firstOrFail();
                $this->assertInvoiceApplicable($prepayment, $invoice);

                if ($amount > $invoice->amountDue()) {
                    throw ValidationException::withMessages([
                        'items' => ["Jumlah alokasi melebihi sisa tagihan invoice {$invoice->number}."],
                    ]);
                }

                $totalApply += $amount;

                $planned = VendorPrepaymentApplication::query()
                    ->where('vendor_prepayment_id', $prepayment->id)
                    ->where('vendor_invoice_id', $invoiceId)
                    ->whereNull('applied_at')
                    ->lockForUpdate()
                    ->first();

                if ($planned) {
                    $planned->update([
                        'amount' => $amount,
                        'applied_at' => $appliedAt,
                    ]);
                } else {
                    $prepayment->applications()->create([
                        'vendor_invoice_id' => $invoiceId,
                        'amount' => $amount,
                        'applied_at' => $appliedAt,
                    ]);
                }

                $invoice->update([
                    'amount_paid' => (int) $invoice->amount_paid + $amount,
                ]);
            }

            if ($totalApply > $balance) {
                throw ValidationException::withMessages([
                    'items' => ['Total alokasi melebihi saldo uang muka.'],
                ]);
            }

            $newApplied = (int) $prepayment->amount_applied + $totalApply;
            $prepayment->update([
                'amount_applied' => $newApplied,
                'status' => $newApplied >= (int) $prepayment->amount ? 'applied' : 'paid',
            ]);

            return $this->loadPrepayment($prepayment->fresh());
        });
    }

    public function cancel(VendorPrepayment $prepayment): VendorPrepayment
    {
        if ($prepayment->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dibatalkan.']]);
        }

        $prepayment->update(['status' => 'cancelled']);

        return $this->loadPrepayment($prepayment->fresh());
    }

    public function serialize(VendorPrepayment $prepayment): array
    {
        $prepayment = $this->loadPrepayment($prepayment);
        $needApproval = $this->needApproval();
        $meId = auth()->id();
        $currentLevel = $prepayment->current_approval_level ? (int) $prepayment->current_approval_level : null;
        $currentStep = $currentLevel
            ? $prepayment->approvals->firstWhere('level', $currentLevel)
            : null;
        $canApprove = $prepayment->status === 'submitted' && (
            (! $needApproval || $prepayment->approvals->isEmpty())
                ? true
                : ($currentStep && (int) $currentStep->user_id === (int) $meId && $currentStep->status === 'pending')
        );
        $approvalPositions = $this->positionNamesForUsers(
            (int) $prepayment->company_id,
            $prepayment->approvals->pluck('user_id')->map(fn ($id) => (int) $id)->all(),
        );

        return [
            'id' => $prepayment->id,
            'number' => $prepayment->number,
            'client_uuid' => $prepayment->client_uuid,
            'status' => $prepayment->status,
            'amount' => $prepayment->amount,
            'amount_applied' => $prepayment->amount_applied,
            'amount_balance' => $prepayment->amountBalance(),
            'payment_method' => $prepayment->payment_method,
            'note' => $prepayment->note,
            'paid_at' => $prepayment->paid_at?->toIso8601String(),
            'created_at' => $prepayment->created_at?->toIso8601String(),
            'user' => $prepayment->user?->only(['id', 'name']),
            'supplier' => $prepayment->supplier?->only(['id', 'name']),
            'purchase_order' => $prepayment->purchaseOrder ? [
                'id' => $prepayment->purchaseOrder->id,
                'number' => $prepayment->purchaseOrder->number,
            ] : null,
            'prepayment_need_approval' => $needApproval,
            'current_approval_level' => $currentLevel,
            'can_approve' => (bool) $canApprove,
            'approvals' => $prepayment->approvals->map(fn (VendorPrepaymentApproval $row) => [
                'id' => $row->id,
                'level' => (int) $row->level,
                'user_id' => (int) $row->user_id,
                'user' => $this->serializeApprovalUser($row->user, $approvalPositions, (int) $row->user_id),
                'status' => $row->status,
                'acted_at' => $row->acted_at?->toIso8601String(),
                'is_current' => $prepayment->status === 'submitted' && $currentLevel === (int) $row->level,
            ])->values(),
            'applications' => $prepayment->applications->map(fn (VendorPrepaymentApplication $row) => [
                'id' => $row->id,
                'vendor_invoice_id' => $row->vendor_invoice_id,
                'amount' => $row->amount,
                'applied_at' => $row->applied_at?->toIso8601String(),
                'is_planned' => $row->applied_at === null,
                'vendor_invoice' => $row->vendorInvoice ? [
                    'id' => $row->vendorInvoice->id,
                    'number' => $row->vendorInvoice->number,
                    'vendor_ref' => $row->vendorInvoice->vendor_ref,
                    'total' => $row->vendorInvoice->total,
                    'amount_paid' => $row->vendorInvoice->amount_paid,
                    'amount_due' => $row->vendorInvoice->amountDue(),
                ] : null,
            ])->values(),
        ];
    }

    public function loadPrepayment(VendorPrepayment $prepayment): VendorPrepayment
    {
        return $prepayment->load([
            'supplier:id,name',
            'purchaseOrder:id,number',
            'user:id,name',
            'approvals.user:id,name',
            'applications.vendorInvoice:id,number,vendor_ref,total,amount_paid',
        ]);
    }

    private function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'prepayment' => ['Modul uang muka supplier tidak aktif. Aktifkan di Pengaturan Procurement.'],
            ]);
        }
    }

    private function writePrepayment(array $payload, User $user): VendorPrepayment
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        $companyId = (int) $company->id;
        $supplierId = (int) ($payload['supplier_id'] ?? 0);
        if ($supplierId < 1) {
            throw ValidationException::withMessages(['supplier_id' => ['Pilih supplier.']]);
        }

        $amount = (int) ($payload['amount'] ?? 0);
        if ($amount < 1) {
            throw ValidationException::withMessages(['amount' => ['Jumlah uang muka harus lebih dari 0.']]);
        }

        $poId = ! empty($payload['purchase_order_id']) ? (int) $payload['purchase_order_id'] : null;
        if ($poId) {
            $this->assertPurchaseOrder($poId, $supplierId);
        }

        $outletId = (int) (Outlet::query()
            ->where('company_id', $companyId)
            ->orderByDesc('is_default')
            ->value('id') ?? 0);

        $prepayment = VendorPrepayment::query()->create([
            'company_id' => $companyId,
            'outlet_id' => $outletId,
            'user_id' => $user->id,
            'supplier_id' => $supplierId,
            'purchase_order_id' => $poId,
            'number' => $this->nextNumber($companyId),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'amount' => $amount,
            'amount_applied' => 0,
            'payment_method' => $payload['payment_method'] ?? null,
            'note' => $payload['note'] ?? null,
        ]);

        if (array_key_exists('approvals', $payload) || $this->needApproval()) {
            $this->syncApprovals($prepayment, $payload['approvals'] ?? []);
        }

        if (array_key_exists('items', $payload)) {
            $this->syncPlannedApplications($prepayment, $payload['items'] ?? []);
        }

        return $this->loadPrepayment($prepayment->fresh());
    }

    /**
     * @param  list<array{vendor_invoice_id?: int, amount?: int}>  $items
     */
    private function syncPlannedApplications(VendorPrepayment $prepayment, array $items): void
    {
        if (! in_array($prepayment->status, ['draft', 'rejected'], true)) {
            return;
        }

        $prepayment->applications()->whereNull('applied_at')->delete();

        foreach ($items as $row) {
            $invoiceId = (int) ($row['vendor_invoice_id'] ?? 0);
            $amount = (int) ($row['amount'] ?? 0);
            if ($invoiceId < 1 || $amount < 1) {
                continue;
            }

            $invoice = VendorInvoice::query()->find($invoiceId);
            if (! $invoice) {
                throw ValidationException::withMessages(['items' => ['Invoice tidak ditemukan.']]);
            }
            $this->assertInvoiceApplicable($prepayment, $invoice);

            if ($amount > $invoice->amountDue()) {
                throw ValidationException::withMessages([
                    'items' => ["Jumlah melebihi sisa tagihan invoice {$invoice->number}."],
                ]);
            }

            $prepayment->applications()->create([
                'vendor_invoice_id' => $invoiceId,
                'amount' => $amount,
                'applied_at' => null,
            ]);
        }
    }

    private function assertPurchaseOrder(int $poId, int $supplierId): void
    {
        $po = PurchaseOrder::query()->find($poId);
        if (! $po) {
            throw ValidationException::withMessages(['purchase_order_id' => ['PO tidak ditemukan.']]);
        }
        if ((int) $po->supplier_id !== $supplierId) {
            throw ValidationException::withMessages(['purchase_order_id' => ['PO harus dari supplier yang sama.']]);
        }
        if (! in_array($po->status, ['ordered', 'partial', 'received'], true)) {
            throw ValidationException::withMessages(['purchase_order_id' => ['PO harus sudah dipesan.']]);
        }
    }

    private function assertInvoiceApplicable(VendorPrepayment $prepayment, VendorInvoice $invoice): void
    {
        if ((int) $invoice->supplier_id !== (int) $prepayment->supplier_id) {
            throw ValidationException::withMessages([
                'items' => ["Invoice {$invoice->number} bukan milik supplier yang sama."],
            ]);
        }
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
    private function syncApprovals(VendorPrepayment $prepayment, array $approvals): void
    {
        $prepayment->approvals()->delete();

        if ($approvals === []) {
            if ($this->needApproval()) {
                throw ValidationException::withMessages([
                    'approvals' => ['Pilih minimal satu approver dan urutkan levelnya.'],
                ]);
            }

            return;
        }

        $companyId = (int) $prepayment->company_id;
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
            VendorPrepaymentApproval::query()->create([
                'company_id' => $companyId,
                'vendor_prepayment_id' => $prepayment->id,
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

    private function notifyCurrentApprover(VendorPrepayment $prepayment): void
    {
        $level = (int) ($prepayment->current_approval_level ?: 1);
        $step = $prepayment->approvals->firstWhere('level', $level);
        if (! $step) {
            return;
        }

        $this->notifications->notify(
            (int) $step->user_id,
            'notifPrepaymentApprovalNeededTitle',
            'notifPrepaymentApprovalNeededBody',
            [
                'number' => $prepayment->number,
                'requester' => $prepayment->user?->name ?? '-',
                'level' => (string) $step->level,
            ],
            [
                'type' => 'vendor_prepayment',
                'id' => $prepayment->id,
                'app' => 'approvals',
            ],
            'info',
            (int) $prepayment->company_id,
        );
    }

    private function notifyCreator(VendorPrepayment $prepayment, string $titleKey, string $bodyKey, string $tone): void
    {
        if (! $prepayment->user_id) {
            return;
        }

        $this->notifications->notify(
            (int) $prepayment->user_id,
            $titleKey,
            $bodyKey,
            ['number' => $prepayment->number],
            [
                'type' => 'vendor_prepayment',
                'id' => $prepayment->id,
                'app' => 'purchase',
            ],
            $tone,
            (int) $prepayment->company_id,
        );
    }

    private function nextNumber(int $companyId): string
    {
        $full = 'VPP-'.now()->format('ymd').'-';
        $last = VendorPrepayment::query()
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
