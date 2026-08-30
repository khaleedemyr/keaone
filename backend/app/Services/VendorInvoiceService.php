<?php

namespace App\Services;

use App\Models\CompanyUser;
use App\Models\Contact;
use App\Models\GoodsReceipt;
use App\Models\MatchException;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Models\VendorInvoice;
use App\Models\VendorInvoiceApproval;
use App\Models\VendorInvoiceItem;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VendorInvoiceService
{
    public function __construct(
        private ProductUnitService $productUnits,
        private NotificationService $notifications,
        private ProcurementMatchService $matchService,
        private WithholdingTaxService $withholdingTax,
        private GlPostingService $glPosting,
    ) {}

    public function enabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::vendorInvoiceEnabled($company);
    }

    public function needApproval(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::vendorInvoiceNeedApproval($company);
    }

    public function create(array $payload, User $user): VendorInvoice
    {
        $this->assertEnabled();

        $existing = VendorInvoice::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadInvoice($existing);
        }

        try {
            return DB::transaction(fn () => $this->writeInvoice($payload, $user));
        } catch (UniqueConstraintViolationException) {
            $row = VendorInvoice::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadInvoice($row);
        }
    }

    public function createFromPortal(array $payload, User $user): VendorInvoice
    {
        $this->assertEnabled();

        $existing = VendorInvoice::query()
            ->withoutGlobalScopes()
            ->where('client_uuid', $payload['client_uuid'])
            ->first();
        if ($existing) {
            return $this->loadInvoice($existing);
        }

        try {
            return DB::transaction(fn () => $this->writeInvoiceFromPortal($payload, $user));
        } catch (UniqueConstraintViolationException) {
            $row = VendorInvoice::query()
                ->withoutGlobalScopes()
                ->where('client_uuid', $payload['client_uuid'])
                ->firstOrFail();

            return $this->loadInvoice($row);
        }
    }

    public function update(VendorInvoice $invoice, array $payload): VendorInvoice
    {
        if (! in_array($invoice->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['Invoice hanya bisa diubah saat draft atau ditolak.']]);
        }

        return DB::transaction(function () use ($invoice, $payload) {
            $invoice->update([
                'supplier_id' => $payload['supplier_id'] ?? $invoice->supplier_id,
                'purchase_order_id' => array_key_exists('purchase_order_id', $payload)
                    ? $payload['purchase_order_id']
                    : $invoice->purchase_order_id,
                'goods_receipt_id' => array_key_exists('goods_receipt_id', $payload)
                    ? $payload['goods_receipt_id']
                    : $invoice->goods_receipt_id,
                'vendor_ref' => $payload['vendor_ref'] ?? $invoice->vendor_ref,
                'invoice_date' => $payload['invoice_date'] ?? $invoice->invoice_date,
                'due_date' => $payload['due_date'] ?? $invoice->due_date,
                'note' => $payload['note'] ?? $invoice->note,
            ]);

            if (isset($payload['items'])) {
                $invoice->items()->delete();
                $totals = $this->attachItems($invoice, $payload['items'], $payload);
                $invoice->update($totals);
            } elseif (array_key_exists('tax_percent', $payload) || array_key_exists('supplier_id', $payload)) {
                $invoice->update($this->recalcTotals($invoice, array_key_exists('tax_percent', $payload) ? (float) $payload['tax_percent'] : null));
            }

            if (array_key_exists('approvals', $payload) || $this->needApproval()) {
                $this->syncApprovals($invoice, $payload['approvals'] ?? []);
            }

            return $this->loadInvoice($invoice->fresh());
        });
    }

    public function submit(VendorInvoice $invoice): VendorInvoice
    {
        if (! in_array($invoice->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['Invoice tidak bisa diajukan.']]);
        }
        if ($invoice->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Invoice belum punya item.']]);
        }

        $result = DB::transaction(function () use ($invoice) {
            $invoice = VendorInvoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if ($this->needApproval()) {
                $levels = $invoice->approvals()->orderBy('level')->get();
                if ($levels->isEmpty()) {
                    throw ValidationException::withMessages([
                        'approvals' => ['Invoice membutuhkan approval. Pilih minimal satu approver dan urutkan levelnya.'],
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
                $invoice->update([
                    'status' => 'submitted',
                    'approved_by' => null,
                    'approved_at' => null,
                    'current_approval_level' => 1,
                    'match_status' => ProcurementSettings::matchEnabled() ? 'pending' : null,
                ]);
            } else {
                $invoice->approvals()->delete();
                $invoice->update([
                    'status' => 'approved',
                    'approved_by' => null,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                    'match_status' => ProcurementSettings::matchEnabled() ? 'pending' : null,
                ]);
            }

            return $this->loadInvoice($invoice->fresh());
        });

        if ($this->needApproval()) {
            $this->notifyCurrentApprover($result);
        }

        return $result;
    }

    public function approve(VendorInvoice $invoice, User $user): VendorInvoice
    {
        if ($invoice->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya invoice yang diajukan yang bisa disetujui.']]);
        }

        $result = DB::transaction(function () use ($invoice, $user) {
            $invoice = VendorInvoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if (! $this->needApproval() || $invoice->approvals()->count() === 0) {
                $invoice->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);

                return $this->loadInvoice($invoice->fresh());
            }

            $level = (int) ($invoice->current_approval_level ?: 1);
            $step = VendorInvoiceApproval::query()
                ->where('vendor_invoice_id', $invoice->id)
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
            $hasNext = VendorInvoiceApproval::query()
                ->where('vendor_invoice_id', $invoice->id)
                ->where('level', $nextLevel)
                ->exists();

            if ($hasNext) {
                $invoice->update(['current_approval_level' => $nextLevel]);
            } else {
                $invoice->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadInvoice($invoice->fresh());
        });

        if ($result->status === 'submitted') {
            $this->notifyCurrentApprover($result);
        } else {
            $this->notifyCreator($result, 'notifInvoiceApprovedTitle', 'notifInvoiceApprovedBody', 'success');
        }

        return $result;
    }

    public function reject(VendorInvoice $invoice, User $user, ?string $note = null): VendorInvoice
    {
        if ($invoice->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya invoice yang diajukan yang bisa ditolak.']]);
        }

        return DB::transaction(function () use ($invoice, $user, $note) {
            $invoice = VendorInvoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if ($this->needApproval() && $invoice->approvals()->count() > 0) {
                $level = (int) ($invoice->current_approval_level ?: 1);
                $step = VendorInvoiceApproval::query()
                    ->where('vendor_invoice_id', $invoice->id)
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
                    'acted_at' => now,
                    'note' => $note,
                ]);
            }

            $invoice->update([
                'status' => 'rejected',
                'current_approval_level' => null,
            ]);

            $loaded = $this->loadInvoice($invoice->fresh());
            $this->notifyCreator($loaded, 'notifInvoiceRejectedTitle', 'notifInvoiceRejectedBody', 'warning');

            return $loaded;
        });
    }

    public function confirm(VendorInvoice $invoice): VendorInvoice
    {
        if ($invoice->status !== 'approved') {
            throw ValidationException::withMessages(['status' => ['Invoice harus disetujui dulu sebelum dikonfirmasi.']]);
        }
        if ($invoice->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Invoice belum punya item.']]);
        }

        return DB::transaction(function () use ($invoice) {
            $invoice = VendorInvoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if (ProcurementSettings::matchEnabled()) {
                $this->matchService->match($invoice);
                $invoice->refresh();

                $openCount = MatchException::query()
                    ->where('vendor_invoice_id', $invoice->id)
                    ->where('status', 'open')
                    ->count();

                if ($openCount > 0) {
                    throw ValidationException::withMessages([
                        'match' => ['Invoice memiliki exception match yang belum diselesaikan. Selesaikan atau waive exception terlebih dahulu.'],
                    ]);
                }
            }

            $invoice->update([
                'status' => 'confirmed',
                'confirmed_at' => now(),
            ]);

            $this->glPosting->postVendorInvoice($invoice->fresh(), auth()->user());

            return $this->loadInvoice($invoice->fresh());
        });
    }

    public function cancel(VendorInvoice $invoice): VendorInvoice
    {
        if ($invoice->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dibatalkan.']]);
        }

        $invoice->update(['status' => 'cancelled']);

        return $this->loadInvoice($invoice->fresh());
    }

    public function runMatch(VendorInvoice $invoice): VendorInvoice
    {
        $this->assertEnabled();

        if (! ProcurementSettings::matchEnabled()) {
            throw ValidationException::withMessages([
                'match' => ['3-way match tidak aktif. Aktifkan di Pengaturan Procurement.'],
            ]);
        }

        return DB::transaction(function () use ($invoice) {
            $invoice = VendorInvoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            return $this->loadInvoice($this->matchService->match($invoice)->fresh());
        });
    }

    public function serialize(VendorInvoice $invoice): array
    {
        $invoice = $this->loadInvoice($invoice);
        $needApproval = $this->needApproval();
        $meId = auth()->id();
        $currentLevel = $invoice->current_approval_level ? (int) $invoice->current_approval_level : null;
        $currentStep = $currentLevel
            ? $invoice->approvals->firstWhere('level', $currentLevel)
            : null;
        $canApprove = $invoice->status === 'submitted' && (
            (! $needApproval || $invoice->approvals->isEmpty())
                ? true
                : ($currentStep && (int) $currentStep->user_id === (int) $meId && $currentStep->status === 'pending')
        );
        $approvalPositions = $this->positionNamesForUsers(
            (int) $invoice->company_id,
            $invoice->approvals->pluck('user_id')->map(fn ($id) => (int) $id)->all(),
        );

        $openExceptions = $invoice->matchExceptions->where('status', 'open')->count();

        return [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'client_uuid' => $invoice->client_uuid,
            'vendor_ref' => $invoice->vendor_ref,
            'status' => $invoice->status,
            'match_status' => $invoice->match_status,
            'match_exception_open' => $openExceptions,
            'invoice_date' => $invoice->invoice_date?->toDateString(),
            'due_date' => $invoice->due_date?->toDateString(),
            'subtotal' => $invoice->subtotal,
            'tax_percent' => $invoice->tax_percent,
            'tax' => $invoice->tax,
            'total' => $invoice->total,
            'withholding_tax_type' => $invoice->withholding_tax_type,
            'withholding_tax_rate' => $invoice->withholding_tax_rate,
            'withholding_tax_base' => $invoice->withholding_tax_base,
            'withholding_tax' => (int) $invoice->withholding_tax,
            'amount_payable' => $invoice->payableTotal(),
            'amount_paid' => (int) $invoice->amount_paid,
            'amount_due' => $invoice->amountDue(),
            'payment_status' => $invoice->paymentStatus(),
            'note' => $invoice->note,
            'confirmed_at' => $invoice->confirmed_at?->toIso8601String(),
            'approved_at' => $invoice->approved_at?->toIso8601String(),
            'created_at' => $invoice->created_at?->toIso8601String(),
            'supplier_id' => $invoice->supplier_id,
            'supplier' => $invoice->supplier?->only(['id', 'name']),
            'purchase_order_id' => $invoice->purchase_order_id,
            'purchase_order' => $invoice->purchaseOrder?->only(['id', 'number', 'status']),
            'goods_receipt_id' => $invoice->goods_receipt_id,
            'goods_receipt' => $invoice->goodsReceipt?->only(['id', 'number', 'status']),
            'user' => $invoice->user?->only(['id', 'name']),
            'invoice_need_approval' => $needApproval,
            'current_approval_level' => $currentLevel,
            'can_approve' => (bool) $canApprove,
            'approvals' => $invoice->approvals->map(fn (VendorInvoiceApproval $row) => [
                'id' => $row->id,
                'level' => (int) $row->level,
                'user_id' => (int) $row->user_id,
                'user' => $this->serializeApprovalUser($row->user, $approvalPositions, (int) $row->user_id),
                'status' => $row->status,
                'acted_at' => $row->acted_at?->toIso8601String(),
                'is_current' => $invoice->status === 'submitted' && $currentLevel === (int) $row->level,
            ])->values(),
            'items' => $invoice->items->map(fn (VendorInvoiceItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->product?->only(['id', 'name', 'sku', 'unit']),
                'purchase_order_item_id' => $item->purchase_order_item_id,
                'goods_receipt_item_id' => $item->goods_receipt_item_id,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'unit_cost' => $item->unit_cost,
                'discount' => $item->discount,
                'total' => $item->total,
                'name_snapshot' => $item->name_snapshot,
                'note' => $item->note,
            ])->values(),
        ];
    }

    public function loadInvoice(VendorInvoice $invoice): VendorInvoice
    {
        return $invoice->load([
            'items.product:id,name,sku,unit',
            'supplier:id,name',
            'purchaseOrder:id,number,status',
            'goodsReceipt:id,number,status',
            'user:id,name',
            'approvals.user:id,name',
            'matchExceptions',
        ]);
    }

    private function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'invoice' => ['Modul vendor invoice tidak aktif. Aktifkan di Pengaturan Procurement.'],
            ]);
        }
    }

    private function writeInvoice(array $payload, User $user): VendorInvoice
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        $companyId = (int) $company->id;
        $supplierId = (int) ($payload['supplier_id'] ?? 0);
        $this->assertSupplier($companyId, $supplierId);

        $poId = $payload['purchase_order_id'] ?? null;
        $grId = $payload['goods_receipt_id'] ?? null;

        if ($poId) {
            $po = PurchaseOrder::query()->findOrFail($poId);
            if ((int) $po->supplier_id !== $supplierId) {
                throw ValidationException::withMessages(['purchase_order_id' => ['Supplier PO tidak cocok.']]);
            }
        }

        if ($grId) {
            $gr = GoodsReceipt::query()->findOrFail($grId);
            if ((int) $gr->supplier_id !== $supplierId) {
                throw ValidationException::withMessages(['goods_receipt_id' => ['Supplier GR tidak cocok.']]);
            }
            if ($gr->status !== 'confirmed') {
                throw ValidationException::withMessages(['goods_receipt_id' => ['GR harus sudah dikonfirmasi.']]);
            }
            $poId = $poId ?? $gr->purchase_order_id;
        }

        $outletId = (int) (Outlet::query()
            ->where('company_id', $companyId)
            ->orderByDesc('is_default')
            ->value('id') ?? 0);

        $invoice = VendorInvoice::query()->create([
            'company_id' => $companyId,
            'outlet_id' => $outletId,
            'user_id' => $user->id,
            'supplier_id' => $supplierId,
            'purchase_order_id' => $poId,
            'goods_receipt_id' => $grId,
            'vendor_ref' => $payload['vendor_ref'] ?? null,
            'number' => $this->nextNumber($companyId),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'match_status' => null,
            'invoice_date' => $payload['invoice_date'] ?? now()->toDateString(),
            'due_date' => $payload['due_date'] ?? null,
            'subtotal' => 0,
            'tax_percent' => 0,
            'tax' => 0,
            'total' => 0,
            'note' => $payload['note'] ?? null,
        ]);

        $totals = $this->attachItems($invoice, $payload['items'] ?? [], $payload);
        $invoice->update($totals);

        if (array_key_exists('approvals', $payload) || $this->needApproval()) {
            $this->syncApprovals($invoice, $payload['approvals'] ?? []);
        }

        return $this->loadInvoice($invoice->fresh());
    }

    private function writeInvoiceFromPortal(array $payload, User $user): VendorInvoice
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        $companyId = (int) $company->id;
        $supplierId = (int) ($payload['supplier_id'] ?? 0);
        $this->assertSupplier($companyId, $supplierId);

        $poId = $payload['purchase_order_id'] ?? null;
        abort_unless($poId, 422, 'PO wajib untuk invoice portal.');

        $po = PurchaseOrder::query()->withoutGlobalScopes()->findOrFail($poId);
        if ((int) $po->supplier_id !== $supplierId) {
            throw ValidationException::withMessages(['purchase_order_id' => ['Supplier PO tidak cocok.']]);
        }

        $outletId = (int) ($po->outlet_id ?: Outlet::query()
            ->where('company_id', $companyId)
            ->orderByDesc('is_default')
            ->value('id') ?? 0);

        $invoice = VendorInvoice::query()->create([
            'company_id' => $companyId,
            'outlet_id' => $outletId,
            'user_id' => $user->id,
            'supplier_id' => $supplierId,
            'purchase_order_id' => $poId,
            'goods_receipt_id' => null,
            'vendor_ref' => $payload['vendor_ref'] ?? null,
            'number' => $this->nextNumber($companyId),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'submitted',
            'match_status' => ProcurementSettings::matchEnabled() ? 'pending' : null,
            'invoice_date' => $payload['invoice_date'] ?? now()->toDateString(),
            'due_date' => $payload['due_date'] ?? null,
            'subtotal' => 0,
            'tax_percent' => 0,
            'tax' => 0,
            'total' => 0,
            'note' => $payload['note'] ?? null,
        ]);

        $totals = $this->attachItems($invoice, $payload['items'] ?? [], $payload);
        $invoice->update($totals);

        return $this->loadInvoice($invoice->fresh());
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, mixed>  $payload
     * @return array{subtotal: int, tax_percent: float, tax: int, total: int}
     */
    private function attachItems(VendorInvoice $invoice, array $items, array $payload = []): array
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item.']]);
        }

        $subtotal = 0;
        foreach ($items as $row) {
            $product = Product::query()->findOrFail($row['product_id']);
            $resolved = $this->productUnits->resolveLine(
                $product,
                isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );
            $qty = (int) $row['qty'];
            $unitCost = (int) ($row['unit_cost'] ?? $product->cost_price ?? 0);
            $discount = max(0, (int) ($row['discount'] ?? 0));
            $lineTotal = max(0, ($qty * $unitCost) - $discount);
            $subtotal += $lineTotal;

            $invoice->items()->create([
                'company_id' => $invoice->company_id,
                'product_id' => $product->id,
                'purchase_order_item_id' => $row['purchase_order_item_id'] ?? null,
                'goods_receipt_item_id' => $row['goods_receipt_item_id'] ?? null,
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'discount' => $discount,
                'total' => $lineTotal,
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'note' => $row['note'] ?? null,
            ]);
        }

        return $this->resolveTotals($invoice, $subtotal, $payload);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{subtotal: int, tax_percent: float, tax: int, total: int, withholding_tax_type: ?string, withholding_tax_rate: float, withholding_tax_base: ?string, withholding_tax: int, amount_payable: int}
     */
    private function resolveTotals(VendorInvoice $invoice, int $subtotal, array $payload = []): array
    {
        $taxPercent = 0.0;

        if (array_key_exists('tax_percent', $payload)) {
            $taxPercent = (float) $payload['tax_percent'];
        } elseif ($invoice->purchase_order_id) {
            $po = PurchaseOrder::query()->find($invoice->purchase_order_id);
            $taxPercent = (float) ($po?->tax_percent ?? 0);
        } else {
            $supplier = Contact::query()->find($invoice->supplier_id);
            if ($supplier && $supplier->is_taxable && $supplier->tax_percent > 0) {
                $taxPercent = (float) $supplier->tax_percent;
            }
        }

        $tax = (int) round($subtotal * $taxPercent / 100);
        $total = $subtotal + $tax;
        $supplier = Contact::query()->find($invoice->supplier_id);

        return array_merge(
            [
                'subtotal' => $subtotal,
                'tax_percent' => $taxPercent,
                'tax' => $tax,
                'total' => $total,
            ],
            $this->withholdingTax->applyToTotals($subtotal, $total, $supplier),
        );
    }

    /**
     * @return array{subtotal: int, tax_percent: float, tax: int, total: int, withholding_tax_type: ?string, withholding_tax_rate: float, withholding_tax_base: ?string, withholding_tax: int, amount_payable: int}
     */
    private function recalcTotals(VendorInvoice $invoice, ?float $taxPercent = null): array
    {
        $subtotal = (int) $invoice->items()->sum('total');
        $taxPercent ??= (float) $invoice->tax_percent;
        $tax = (int) round($subtotal * $taxPercent / 100);
        $total = $subtotal + $tax;
        $supplier = Contact::query()->find($invoice->supplier_id);

        return array_merge(
            [
                'subtotal' => $subtotal,
                'tax_percent' => $taxPercent,
                'tax' => $tax,
                'total' => $total,
            ],
            $this->withholdingTax->applyToTotals($subtotal, $total, $supplier),
        );
    }

    /**
     * @param  list<array{user_id?: int}>  $approvals
     */
    private function syncApprovals(VendorInvoice $invoice, array $approvals): void
    {
        $invoice->approvals()->delete();

        if ($approvals === []) {
            if ($this->needApproval()) {
                throw ValidationException::withMessages([
                    'approvals' => ['Pilih minimal satu approver dan urutkan levelnya.'],
                ]);
            }

            return;
        }

        $companyId = (int) $invoice->company_id;
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
            VendorInvoiceApproval::query()->create([
                'company_id' => $companyId,
                'vendor_invoice_id' => $invoice->id,
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

    private function notifyCurrentApprover(VendorInvoice $invoice): void
    {
        $level = (int) ($invoice->current_approval_level ?: 1);
        $step = $invoice->approvals->firstWhere('level', $level);
        if (! $step) {
            return;
        }

        $this->notifications->notify(
            (int) $step->user_id,
            'notifInvoiceApprovalNeededTitle',
            'notifInvoiceApprovalNeededBody',
            [
                'number' => $invoice->number,
                'requester' => $invoice->user?->name ?? '-',
                'level' => (string) $step->level,
            ],
            [
                'type' => 'vendor_invoice',
                'id' => $invoice->id,
                'app' => 'approvals',
            ],
            'info',
            (int) $invoice->company_id,
        );
    }

    private function notifyCreator(VendorInvoice $invoice, string $titleKey, string $bodyKey, string $tone): void
    {
        if (! $invoice->user_id) {
            return;
        }

        $this->notifications->notify(
            (int) $invoice->user_id,
            $titleKey,
            $bodyKey,
            ['number' => $invoice->number],
            [
                'type' => 'vendor_invoice',
                'id' => $invoice->id,
                'app' => 'purchase',
            ],
            $tone,
            (int) $invoice->company_id,
        );
    }

    private function nextNumber(int $companyId): string
    {
        $full = 'VIN-'.now()->format('ymd').'-';
        $last = VendorInvoice::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('number', 'like', $full.'%')
            ->orderByDesc('number')
            ->lockForUpdate()
            ->value('number');

        $seq = $last ? ((int) substr((string) $last, -3)) + 1 : 1;

        return $full.str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
    }

    private function assertSupplier(int $companyId, int $supplierId): void
    {
        $ok = Contact::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($supplierId)
            ->whereIn('type', ['supplier', 'both'])
            ->where('is_active', true)
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages(['supplier_id' => ['Supplier tidak valid.']]);
        }
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
