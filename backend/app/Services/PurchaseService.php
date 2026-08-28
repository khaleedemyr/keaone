<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Contact;
use App\Models\GoodsReceipt;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderApproval;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseRequisitionApproval;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PurchaseService
{
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
        private NotificationService $notifications,
    ) {}

    public function purchaseFlow(?Company $company = null): string
    {
        $company ??= CurrentCompany::company();
        $settings = array_merge($company?->defaultSettings() ?? [], $company?->settings ?? []);
        $flow = (string) ($settings['purchase_flow'] ?? 'direct');

        return in_array($flow, ['strict_pr_po_gr', 'po_gr', 'direct'], true) ? $flow : 'direct';
    }

    public function updateCostEnabled(?Company $company = null): bool
    {
        $company ??= CurrentCompany::company();
        $settings = array_merge($company?->defaultSettings() ?? [], $company?->settings ?? []);

        return (bool) ($settings['purchase_update_cost'] ?? true);
    }

    public function prNeedApproval(?Company $company = null): bool
    {
        $company ??= CurrentCompany::company();
        $settings = array_merge($company?->defaultSettings() ?? [], $company?->settings ?? []);

        return (bool) ($settings['pr_need_approval'] ?? false);
    }

    public function poNeedApproval(?Company $company = null): bool
    {
        $company ??= CurrentCompany::company();
        $settings = array_merge($company?->defaultSettings() ?? [], $company?->settings ?? []);

        return (bool) ($settings['po_need_approval'] ?? false);
    }

    public function canSharePo(PurchaseOrder $po): bool
    {
        if (in_array($po->status, ['cancelled', 'draft', 'rejected', 'submitted'], true)) {
            return false;
        }

        return in_array($po->status, ['approved', 'ordered', 'partial', 'received'], true);
    }

    public function canSharePr(PurchaseRequisition $pr): bool
    {
        if (in_array($pr->status, ['cancelled', 'draft', 'rejected'], true)) {
            return false;
        }

        if ($this->prNeedApproval()) {
            return $pr->status === 'approved';
        }

        return in_array($pr->status, ['submitted', 'approved'], true);
    }

    // ─── PR ───────────────────────────────────────────────

    public function createRequisition(array $payload, User $user): PurchaseRequisition
    {
        $existing = PurchaseRequisition::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadPr($existing);
        }

        $flow = $this->purchaseFlow();
        if ($flow === 'direct' || $flow === 'po_gr') {
            throw ValidationException::withMessages([
                'purchase_flow' => ['Mode pembelian saat ini tidak memakai PR.'],
            ]);
        }

        try {
            return DB::transaction(fn () => $this->writeRequisition($payload, $user));
        } catch (UniqueConstraintViolationException) {
            $row = PurchaseRequisition::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadPr($row);
        }
    }

    public function updateRequisition(PurchaseRequisition $pr, array $payload): PurchaseRequisition
    {
        if (! in_array($pr->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['PR hanya bisa diubah saat draft/rejected.']]);
        }

        return DB::transaction(function () use ($pr, $payload) {
            $pr->update([
                'warehouse_id' => $payload['warehouse_id'] ?? $pr->warehouse_id,
                'needed_at' => $payload['needed_at'] ?? $pr->needed_at,
                'note' => $payload['note'] ?? $pr->note,
                'status' => 'draft',
                'approved_by' => null,
                'approved_at' => null,
                'current_approval_level' => null,
            ]);

            if (isset($payload['items'])) {
                $pr->items()->delete();
                $this->attachPrItems($pr, $payload['items']);
            }

            if (array_key_exists('approvals', $payload)) {
                $this->syncPrApprovals($pr, $payload['approvals'] ?? []);
            } else {
                $pr->approvals()->update([
                    'status' => 'pending',
                    'acted_by' => null,
                    'acted_at' => null,
                    'note' => null,
                ]);
            }

            return $this->loadPr($pr->fresh());
        });
    }

    public function submitRequisition(PurchaseRequisition $pr): PurchaseRequisition
    {
        if ($pr->status !== 'draft' && $pr->status !== 'rejected') {
            throw ValidationException::withMessages(['status' => ['PR tidak bisa diajukan.']]);
        }
        if ($pr->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['PR belum punya item.']]);
        }

        $result = DB::transaction(function () use ($pr) {
            $pr = PurchaseRequisition::query()->whereKey($pr->id)->lockForUpdate()->firstOrFail();

            if ($this->prNeedApproval()) {
                $levels = $pr->approvals()->orderBy('level')->get();
                if ($levels->isEmpty()) {
                    throw ValidationException::withMessages([
                        'approvals' => ['PR membutuhkan approval. Pilih minimal satu approver (dari jabatan terendah ke tertinggi).'],
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
                $pr->update([
                    'status' => 'submitted',
                    'approved_by' => null,
                    'approved_at' => null,
                    'current_approval_level' => 1,
                ]);
            } else {
                $pr->approvals()->delete();
                $pr->update([
                    'status' => 'submitted',
                    'approved_by' => null,
                    'approved_at' => null,
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadPr($pr->fresh());
        });

        $this->notifyCurrentPrApprover($result);

        return $result;
    }

    public function approveRequisition(PurchaseRequisition $pr, User $user, array $payload = []): PurchaseRequisition
    {
        if ($pr->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya PR yang diajukan yang bisa disetujui.']]);
        }

        $result = DB::transaction(function () use ($pr, $user, $payload) {
            $pr = PurchaseRequisition::query()->whereKey($pr->id)->lockForUpdate()->firstOrFail();

            if (! $this->prNeedApproval() || $pr->approvals()->count() === 0) {
                if (array_key_exists('items', $payload)) {
                    $this->revisePrItemsDuringApproval($pr, $payload['items'] ?? []);
                }
                $pr->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);

                return $this->loadPr($pr->fresh());
            }

            $level = (int) ($pr->current_approval_level ?: 1);
            $step = PurchaseRequisitionApproval::query()
                ->where('purchase_requisition_id', $pr->id)
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
                    'approvals' => ['Belum giliran Anda. Approval harus berurutan dari level terendah ke tertinggi.'],
                ]);
            }

            if (array_key_exists('items', $payload)) {
                $this->revisePrItemsDuringApproval($pr, $payload['items'] ?? []);
            }

            $step->update([
                'status' => 'approved',
                'acted_by' => $user->id,
                'acted_at' => now(),
            ]);

            $next = PurchaseRequisitionApproval::query()
                ->where('purchase_requisition_id', $pr->id)
                ->where('level', '>', $level)
                ->orderBy('level')
                ->first();

            if ($next) {
                $pr->update([
                    'current_approval_level' => (int) $next->level,
                ]);
            } else {
                $pr->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadPr($pr->fresh());
        });

        if ($result->status === 'approved') {
            $this->notifyPrCreator($result, 'notifPrApprovedTitle', 'notifPrApprovedBody', 'success');
        } else {
            $this->notifyCurrentPrApprover($result);
        }

        return $result;
    }

    public function rejectRequisition(PurchaseRequisition $pr, User $user): PurchaseRequisition
    {
        if ($pr->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya PR yang diajukan yang bisa ditolak.']]);
        }

        $result = DB::transaction(function () use ($pr, $user) {
            $pr = PurchaseRequisition::query()->whereKey($pr->id)->lockForUpdate()->firstOrFail();

            if ($this->prNeedApproval() && $pr->approvals()->count() > 0) {
                $level = (int) ($pr->current_approval_level ?: 1);
                $step = PurchaseRequisitionApproval::query()
                    ->where('purchase_requisition_id', $pr->id)
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
                ]);

                PurchaseRequisitionApproval::query()
                    ->where('purchase_requisition_id', $pr->id)
                    ->where('level', '>', $level)
                    ->where('status', 'pending')
                    ->update(['status' => 'skipped']);
            }

            $pr->update([
                'status' => 'rejected',
                'approved_by' => $user->id,
                'approved_at' => now(),
                'current_approval_level' => null,
            ]);

            return $this->loadPr($pr->fresh());
        });

        $this->notifyPrCreator($result, 'notifPrRejectedTitle', 'notifPrRejectedBody', 'warning');

        return $result;
    }

    private function notifyCurrentPrApprover(PurchaseRequisition $pr): void
    {
        if ($pr->status !== 'submitted' || ! $pr->current_approval_level) {
            return;
        }
        $step = $pr->approvals->firstWhere('level', (int) $pr->current_approval_level)
            ?? PurchaseRequisitionApproval::query()
                ->where('purchase_requisition_id', $pr->id)
                ->where('level', (int) $pr->current_approval_level)
                ->first();
        if (! $step || $step->status !== 'pending') {
            return;
        }

        $this->notifications->notify(
            (int) $step->user_id,
            'notifPrApprovalNeededTitle',
            'notifPrApprovalNeededBody',
            [
                'number' => $pr->number,
                'requester' => $pr->user?->name ?? '-',
                'level' => (string) $step->level,
            ],
            [
                'type' => 'purchase_requisition',
                'id' => $pr->id,
                'app' => 'approvals',
            ],
            'info',
            (int) $pr->company_id,
        );
    }

    private function notifyPrCreator(PurchaseRequisition $pr, string $titleKey, string $bodyKey, string $tone): void
    {
        if (! $pr->user_id) {
            return;
        }
        $this->notifications->notify(
            (int) $pr->user_id,
            $titleKey,
            $bodyKey,
            [
                'number' => $pr->number,
                'actor' => $pr->approver?->name ?? '-',
            ],
            [
                'type' => 'purchase_requisition',
                'id' => $pr->id,
                'app' => 'purchase',
            ],
            $tone,
            (int) $pr->company_id,
        );
    }

    public function cancelRequisition(PurchaseRequisition $pr): PurchaseRequisition
    {
        if (in_array($pr->status, ['cancelled', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => ['PR tidak bisa dibatalkan.']]);
        }
        $pr->update(['status' => 'cancelled']);

        return $this->loadPr($pr->fresh());
    }

    // ─── PO ───────────────────────────────────────────────

    public function createOrder(array $payload, User $user): PurchaseOrder
    {
        $existing = PurchaseOrder::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadPo($existing);
        }

        $flow = $this->purchaseFlow();
        if ($flow === 'direct') {
            throw ValidationException::withMessages([
                'purchase_flow' => ['Mode pembelian langsung tidak memakai PO. Gunakan penerimaan barang.'],
            ]);
        }

        try {
            return DB::transaction(fn () => $this->writeOrder($payload, $user, $flow));
        } catch (UniqueConstraintViolationException) {
            $row = PurchaseOrder::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadPo($row);
        }
    }

    public function updateOrder(PurchaseOrder $po, array $payload): PurchaseOrder
    {
        if (! in_array($po->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['PO hanya bisa diubah saat draft/rejected.']]);
        }

        return DB::transaction(function () use ($po, $payload) {
            $po->update([
                'supplier_id' => $payload['supplier_id'] ?? $po->supplier_id,
                'warehouse_id' => $payload['warehouse_id'] ?? $po->warehouse_id,
                'expected_at' => $payload['expected_at'] ?? $po->expected_at,
                'note' => $payload['note'] ?? $po->note,
                'status' => 'draft',
                'approved_by' => null,
                'approved_at' => null,
                'current_approval_level' => null,
            ]);

            if (isset($payload['items'])) {
                $po->items()->delete();
                $totals = $this->attachPoItems($po, $payload['items']);
                $po->update($totals);
            } elseif (array_key_exists('supplier_id', $payload)) {
                $subtotal = (int) $po->items()->sum('total');
                $po->update($this->resolvePoTotals($po, $subtotal));
            }

            if (array_key_exists('approvals', $payload)) {
                $this->syncPoApprovals($po, $payload['approvals'] ?? []);
            } else {
                $po->approvals()->update([
                    'status' => 'pending',
                    'acted_by' => null,
                    'acted_at' => null,
                    'note' => null,
                ]);
            }

            return $this->loadPo($po->fresh());
        });
    }

    public function submitOrder(PurchaseOrder $po): PurchaseOrder
    {
        if ($po->status !== 'draft' && $po->status !== 'rejected') {
            throw ValidationException::withMessages(['status' => ['PO tidak bisa diajukan.']]);
        }
        if ($po->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['PO belum punya item.']]);
        }

        $result = DB::transaction(function () use ($po) {
            $po = PurchaseOrder::query()->whereKey($po->id)->lockForUpdate()->firstOrFail();

            if ($this->poNeedApproval()) {
                $levels = $po->approvals()->orderBy('level')->get();
                if ($levels->isEmpty()) {
                    throw ValidationException::withMessages([
                        'approvals' => ['PO membutuhkan approval. Pilih minimal satu approver (dari jabatan terendah ke tertinggi).'],
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
                $po->update([
                    'status' => 'submitted',
                    'approved_by' => null,
                    'approved_at' => null,
                    'current_approval_level' => 1,
                ]);
            } else {
                $po->approvals()->delete();
                $po->update([
                    'status' => 'submitted',
                    'approved_by' => null,
                    'approved_at' => null,
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadPo($po->fresh());
        });

        $this->notifyCurrentPoApprover($result);

        return $result;
    }

    public function approveOrder(PurchaseOrder $po, User $user, array $payload = []): PurchaseOrder
    {
        if ($po->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya PO yang diajukan yang bisa disetujui.']]);
        }

        $result = DB::transaction(function () use ($po, $user, $payload) {
            $po = PurchaseOrder::query()->whereKey($po->id)->lockForUpdate()->firstOrFail();

            if (! $this->poNeedApproval() || $po->approvals()->count() === 0) {
                if (array_key_exists('items', $payload)) {
                    $this->revisePoItemsDuringApproval($po, $payload['items'] ?? []);
                }
                $po->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);

                return $this->loadPo($po->fresh());
            }

            $level = (int) ($po->current_approval_level ?: 1);
            $step = PurchaseOrderApproval::query()
                ->where('purchase_order_id', $po->id)
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
                    'approvals' => ['Belum giliran Anda. Approval harus berurutan dari level terendah ke tertinggi.'],
                ]);
            }

            if (array_key_exists('items', $payload)) {
                $this->revisePoItemsDuringApproval($po, $payload['items'] ?? []);
            }

            $step->update([
                'status' => 'approved',
                'acted_by' => $user->id,
                'acted_at' => now(),
            ]);

            $next = PurchaseOrderApproval::query()
                ->where('purchase_order_id', $po->id)
                ->where('level', '>', $level)
                ->orderBy('level')
                ->first();

            if ($next) {
                $po->update([
                    'current_approval_level' => (int) $next->level,
                ]);
            } else {
                $po->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadPo($po->fresh());
        });

        if ($result->status === 'approved') {
            $this->notifyPoCreator($result, 'notifPoApprovedTitle', 'notifPoApprovedBody', 'success');
        } else {
            $this->notifyCurrentPoApprover($result);
        }

        return $result;
    }

    public function rejectOrder(PurchaseOrder $po, User $user): PurchaseOrder
    {
        if ($po->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya PO yang diajukan yang bisa ditolak.']]);
        }

        $result = DB::transaction(function () use ($po, $user) {
            $po = PurchaseOrder::query()->whereKey($po->id)->lockForUpdate()->firstOrFail();

            if ($this->poNeedApproval() && $po->approvals()->count() > 0) {
                $level = (int) ($po->current_approval_level ?: 1);
                $step = PurchaseOrderApproval::query()
                    ->where('purchase_order_id', $po->id)
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
                ]);

                PurchaseOrderApproval::query()
                    ->where('purchase_order_id', $po->id)
                    ->where('level', '>', $level)
                    ->where('status', 'pending')
                    ->update(['status' => 'skipped']);
            }

            $po->update([
                'status' => 'rejected',
                'approved_by' => $user->id,
                'approved_at' => now(),
                'current_approval_level' => null,
            ]);

            return $this->loadPo($po->fresh());
        });

        $this->notifyPoCreator($result, 'notifPoRejectedTitle', 'notifPoRejectedBody', 'warning');

        return $result;
    }

    private function notifyCurrentPoApprover(PurchaseOrder $po): void
    {
        if ($po->status !== 'submitted' || ! $po->current_approval_level) {
            return;
        }
        $step = $po->approvals->firstWhere('level', (int) $po->current_approval_level)
            ?? PurchaseOrderApproval::query()
                ->where('purchase_order_id', $po->id)
                ->where('level', (int) $po->current_approval_level)
                ->first();
        if (! $step || $step->status !== 'pending') {
            return;
        }

        $this->notifications->notify(
            (int) $step->user_id,
            'notifPoApprovalNeededTitle',
            'notifPoApprovalNeededBody',
            [
                'number' => $po->number,
                'requester' => $po->user?->name ?? '-',
                'level' => (string) $step->level,
            ],
            [
                'type' => 'purchase_order',
                'id' => $po->id,
                'app' => 'approvals',
            ],
            'info',
            (int) $po->company_id,
        );
    }

    private function notifyPoCreator(PurchaseOrder $po, string $titleKey, string $bodyKey, string $tone): void
    {
        if (! $po->user_id) {
            return;
        }
        $this->notifications->notify(
            (int) $po->user_id,
            $titleKey,
            $bodyKey,
            [
                'number' => $po->number,
                'actor' => $po->approver?->name ?? '-',
            ],
            [
                'type' => 'purchase_order',
                'id' => $po->id,
                'app' => 'purchase',
            ],
            $tone,
            (int) $po->company_id,
        );
    }

    public function orderPurchaseOrder(PurchaseOrder $po): PurchaseOrder
    {
        $needApproval = $this->poNeedApproval();
        $allowed = $needApproval ? ['approved'] : ['draft', 'approved'];
        if (! in_array($po->status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => $needApproval
                    ? ['PO harus disetujui dulu sebelum dipesan.']
                    : ['PO tidak bisa dipesan.'],
            ]);
        }
        if ($po->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['PO belum punya item.']]);
        }
        $po->update([
            'status' => 'ordered',
            'ordered_at' => now()->toDateString(),
        ]);

        return $this->loadPo($po->fresh());
    }

    public function cancelOrder(PurchaseOrder $po): PurchaseOrder
    {
        if (! in_array($po->status, ['draft', 'submitted', 'rejected', 'approved', 'ordered'], true)) {
            throw ValidationException::withMessages(['status' => ['PO tidak bisa dibatalkan.']]);
        }
        if ((int) $po->items()->sum('qty_received') > 0) {
            throw ValidationException::withMessages(['status' => ['PO sudah ada penerimaan.']]);
        }
        $po->update(['status' => 'cancelled']);

        return $this->loadPo($po->fresh());
    }

    // ─── GR ───────────────────────────────────────────────

    public function createReceipt(array $payload, User $user): GoodsReceipt
    {
        $existing = GoodsReceipt::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadGr($existing);
        }

        $flow = $this->purchaseFlow();

        try {
            return DB::transaction(fn () => $this->writeReceipt($payload, $user, $flow));
        } catch (UniqueConstraintViolationException) {
            $row = GoodsReceipt::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadGr($row);
        }
    }

    public function updateReceipt(GoodsReceipt $gr, array $payload): GoodsReceipt
    {
        if ($gr->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Penerimaan hanya bisa diubah saat draft.']]);
        }

        return DB::transaction(function () use ($gr, $payload) {
            $gr->update([
                'supplier_id' => $payload['supplier_id'] ?? $gr->supplier_id,
                'warehouse_id' => $payload['warehouse_id'] ?? $gr->warehouse_id,
                'note' => $payload['note'] ?? $gr->note,
            ]);

            if (isset($payload['items'])) {
                $gr->items()->delete();
                $totals = $this->attachGrItems($gr, $payload['items']);
                $gr->update($totals);
            }

            return $this->loadGr($gr->fresh());
        });
    }

    public function confirmReceipt(GoodsReceipt $gr): GoodsReceipt
    {
        if ($gr->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Penerimaan tidak bisa dikonfirmasi.']]);
        }
        if ($gr->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Penerimaan belum punya item.']]);
        }

        return DB::transaction(function () use ($gr) {
            $gr = GoodsReceipt::query()->whereKey($gr->id)->lockForUpdate()->firstOrFail();
            $gr->load(['items', 'purchaseOrder.items']);

            $flow = $this->purchaseFlow();
            if ($flow !== 'direct' && ! $gr->purchase_order_id) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => ['Mode saat ini mewajibkan PO pada penerimaan.'],
                ]);
            }
            if ($flow === 'direct' && $gr->purchase_order_id) {
                // allow linking but not required
            }

            $company = Company::query()->findOrFail($gr->company_id);
            $updateCost = $this->updateCostEnabled($company);

            foreach ($gr->items as $item) {
                $product = Product::query()->withoutGlobalScopes()->find($item->product_id);
                $factor = max(1, (int) ($item->factor_to_base ?: 1));
                $baseQty = $this->productUnits->toBaseQty((int) $item->qty, $factor);

                if ($product?->track_stock) {
                    $this->inventory->adjust(
                        (int) $gr->company_id,
                        (int) $gr->warehouse_id,
                        (int) $item->product_id,
                        $baseQty,
                        'purchase',
                        'goods_receipt',
                        (int) $gr->id,
                        'Penerimaan '.$gr->number,
                        (int) $gr->outlet_id,
                        [
                            'qty_input' => (int) $item->qty,
                            'unit_level' => $item->unit_level,
                            'unit' => $item->unit,
                            'factor_to_base' => $factor,
                        ],
                    );
                }
                if ($updateCost && $product && (int) $item->unit_cost > 0) {
                    $costPerBase = (int) round((int) $item->unit_cost / $factor);
                    if ($costPerBase > 0) {
                        $product->forceFill(['cost_price' => $costPerBase])->save();
                    }
                }

                if ($item->purchase_order_item_id) {
                    $poItem = PurchaseOrderItem::query()->whereKey($item->purchase_order_item_id)->lockForUpdate()->first();
                    if ($poItem) {
                        $poFactor = max(1, (int) ($poItem->factor_to_base ?: 1));
                        $addInPoUnit = (int) round($baseQty / $poFactor);
                        if ($addInPoUnit < 1) {
                            throw ValidationException::withMessages([
                                'items' => ["Qty terima tidak cocok dengan satuan PO untuk {$item->name_snapshot}."],
                            ]);
                        }
                        $poItem->qty_received = (int) $poItem->qty_received + $addInPoUnit;
                        if ($poItem->qty_received > $poItem->qty) {
                            throw ValidationException::withMessages([
                                'items' => ["Qty terima melebihi PO untuk {$item->name_snapshot}."],
                            ]);
                        }
                        $poItem->save();
                    }
                }
            }

            if ($gr->purchase_order_id) {
                $this->refreshPoStatus($gr->purchase_order_id);
            }

            $gr->update([
                'status' => 'confirmed',
                'received_at' => now(),
            ]);

            return $this->loadGr($gr->fresh());
        });
    }

    public function cancelReceipt(GoodsReceipt $gr): GoodsReceipt
    {
        if ($gr->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dibatalkan.']]);
        }
        $gr->update(['status' => 'cancelled']);

        return $this->loadGr($gr->fresh());
    }

    // ─── Serialize ────────────────────────────────────────

    public function serializePr(PurchaseRequisition $pr): array
    {
        $pr = $this->loadPr($pr);
        $needApproval = $this->prNeedApproval();
        $meId = auth()->id();
        $currentLevel = $pr->current_approval_level ? (int) $pr->current_approval_level : null;
        $currentStep = $currentLevel
            ? $pr->approvals->firstWhere('level', $currentLevel)
            : null;
        $canApprove = $pr->status === 'submitted' && (
            (! $needApproval || $pr->approvals->isEmpty())
                ? true
                : ($currentStep && (int) $currentStep->user_id === (int) $meId && $currentStep->status === 'pending')
        );

        return [
            'id' => $pr->id,
            'number' => $pr->number,
            'client_uuid' => $pr->client_uuid,
            'status' => $pr->status,
            'needed_at' => $pr->needed_at?->toDateString(),
            'note' => $pr->note,
            'outlet_id' => $pr->outlet_id,
            'outlet' => $pr->outlet?->only(['id', 'name']),
            'warehouse_id' => $pr->warehouse_id,
            'warehouse' => $pr->warehouse?->only(['id', 'name']),
            'user' => $pr->user?->only(['id', 'name']),
            'approver' => $pr->approver?->only(['id', 'name']),
            'approved_at' => $pr->approved_at?->toIso8601String(),
            'created_at' => $pr->created_at?->toIso8601String(),
            'pr_need_approval' => $needApproval,
            'current_approval_level' => $currentLevel,
            'can_approve' => (bool) $canApprove,
            'has_purchase_order' => $pr->relationLoaded('orders')
                ? $pr->orders->isNotEmpty()
                : $pr->orders()->exists(),
            'share_token' => $pr->share_token,
            'can_share' => $this->canSharePr($pr),
            'approvals' => $pr->approvals->map(fn (PurchaseRequisitionApproval $row) => [
                'id' => $row->id,
                'level' => (int) $row->level,
                'user_id' => (int) $row->user_id,
                'user' => $row->user?->only(['id', 'name']),
                'status' => $row->status,
                'acted_at' => $row->acted_at?->toIso8601String(),
                'is_current' => $pr->status === 'submitted' && $currentLevel === (int) $row->level,
            ])->values(),
            'items' => $pr->items->map(function ($item) {
                $factor = max(1, (int) ($item->factor_to_base ?: 1));
                $hints = $this->costHintsForProduct((int) $item->product_id, $factor);

                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product' => $item->product?->only(['id', 'name', 'sku', 'unit', 'cost_price']),
                    'qty' => $item->qty,
                    'unit' => $item->unit,
                    'unit_level' => $item->unit_level,
                    'factor_to_base' => $factor,
                    'name_snapshot' => $item->name_snapshot,
                    'note' => $item->note,
                    'cost_last' => $hints['last'],
                    'cost_min' => $hints['min'],
                    'cost_max' => $hints['max'],
                    'suggested_unit_cost' => $hints['last'] > 0
                        ? $hints['last']
                        : (int) ($item->product?->cost_price ?? 0) * $factor,
                ];
            })->values(),
        ];
    }

    public function serializePo(PurchaseOrder $po): array
    {
        $po = $this->loadPo($po);
        $needApproval = $this->poNeedApproval();
        $meId = auth()->id();
        $currentLevel = $po->current_approval_level ? (int) $po->current_approval_level : null;
        $currentStep = $currentLevel
            ? $po->approvals->firstWhere('level', $currentLevel)
            : null;
        $canApprove = $po->status === 'submitted' && (
            (! $needApproval || $po->approvals->isEmpty())
                ? true
                : ($currentStep && (int) $currentStep->user_id === (int) $meId && $currentStep->status === 'pending')
        );

        return [
            'id' => $po->id,
            'number' => $po->number,
            'client_uuid' => $po->client_uuid,
            'share_token' => $po->share_token,
            'status' => $po->status,
            'ordered_at' => $po->ordered_at?->toDateString(),
            'expected_at' => $po->expected_at?->toDateString(),
            'subtotal' => $po->subtotal,
            'tax_percent' => (float) ($po->tax_percent ?? 0),
            'tax' => $po->tax,
            'total' => $po->total,
            'note' => $po->note,
            'payment_term' => $po->payment_term,
            'payment_days' => $po->payment_days,
            'outlet_id' => $po->outlet_id,
            'warehouse_id' => $po->warehouse_id,
            'warehouse' => $po->warehouse?->only(['id', 'name']),
            'supplier_id' => $po->supplier_id,
            'supplier' => $po->supplier?->only([
                'id', 'name', 'phone', 'is_taxable', 'tax_percent', 'payment_term', 'payment_days',
            ]),
            'purchase_requisition_id' => $po->purchase_requisition_id,
            'requisition' => $po->requisition?->only(['id', 'number', 'status']),
            'user' => $po->user?->only(['id', 'name']),
            'approver' => $po->approver?->only(['id', 'name']),
            'approved_at' => $po->approved_at?->toIso8601String(),
            'created_at' => $po->created_at?->toIso8601String(),
            'po_need_approval' => $needApproval,
            'can_share' => $this->canSharePo($po),
            'current_approval_level' => $currentLevel,
            'can_approve' => (bool) $canApprove,
            'approvals' => $po->approvals->map(fn (PurchaseOrderApproval $row) => [
                'id' => $row->id,
                'level' => (int) $row->level,
                'user_id' => (int) $row->user_id,
                'user' => $row->user?->only(['id', 'name']),
                'status' => $row->status,
                'acted_at' => $row->acted_at?->toIso8601String(),
                'is_current' => $po->status === 'submitted' && $currentLevel === (int) $row->level,
            ])->values(),
            'items' => $po->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->product?->only(['id', 'name', 'sku', 'unit', 'cost_price']),
                'qty' => $item->qty,
                'qty_received' => $item->qty_received,
                'qty_remaining' => max(0, (int) $item->qty - (int) $item->qty_received),
                'unit_cost' => $item->unit_cost,
                'discount' => (int) ($item->discount ?? 0),
                'total' => $item->total,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'factor_to_base' => $item->factor_to_base,
                'name_snapshot' => $item->name_snapshot,
                'note' => $item->note,
                'purchase_requisition_item_id' => $item->purchase_requisition_item_id,
            ])->values(),
        ];
    }

    public function ensureShareToken(PurchaseOrder $po): string
    {
        abort_unless($this->canSharePo($po), 422, 'PO belum bisa dibagikan.');

        if ($po->share_token) {
            return $po->share_token;
        }

        $token = Str::random(48);
        $po->update(['share_token' => $token]);

        return $token;
    }

    public function ensurePrShareToken(PurchaseRequisition $pr): string
    {
        abort_unless($this->canSharePr($pr), 422, 'PR belum bisa dibagikan.');

        if ($pr->share_token) {
            return $pr->share_token;
        }

        $token = Str::random(48);
        $pr->update(['share_token' => $token]);

        return $token;
    }

    public function serializePrPublic(PurchaseRequisition $pr): array
    {
        $pr = $this->loadPr($pr->load('company:id,name,phone,address'));

        return [
            'number' => $pr->number,
            'status' => $pr->status,
            'needed_at' => $pr->needed_at?->toDateString(),
            'note' => $pr->note,
            'created_at' => $pr->created_at?->toIso8601String(),
            'approved_at' => $pr->approved_at?->toIso8601String(),
            'company' => $pr->company?->only(['name', 'phone', 'address']),
            'warehouse' => $pr->warehouse?->only(['name']),
            'outlet' => $pr->outlet?->only(['name']),
            'user' => $pr->user?->only(['name']),
            'approver' => $pr->approver?->only(['name']),
            'approvals' => $pr->approvals->map(fn (PurchaseRequisitionApproval $row) => [
                'level' => (int) $row->level,
                'user' => $row->user?->only(['name']),
                'status' => $row->status,
                'acted_at' => $row->acted_at?->toIso8601String(),
            ])->values(),
            'items' => $pr->items->map(function ($item) {
                $factor = max(1, (int) ($item->factor_to_base ?: 1));
                $hints = $this->costHintsForProduct((int) $item->product_id, $factor);

                return [
                    'name' => $item->name_snapshot ?: $item->product?->name,
                    'sku' => $item->product?->sku,
                    'qty' => $item->qty,
                    'unit' => $item->unit,
                    'suggested_unit_cost' => $hints['last'] > 0
                        ? $hints['last']
                        : (int) ($item->product?->cost_price ?? 0) * $factor,
                    'note' => $item->note,
                ];
            })->values(),
        ];
    }

    public function serializePoPublic(PurchaseOrder $po): array
    {
        $po = $this->loadPo($po->load('company:id,name,phone,address'));

        return [
            'number' => $po->number,
            'status' => $po->status,
            'ordered_at' => $po->ordered_at?->toDateString(),
            'expected_at' => $po->expected_at?->toDateString(),
            'subtotal' => $po->subtotal,
            'tax_percent' => (float) ($po->tax_percent ?? 0),
            'tax' => $po->tax,
            'total' => $po->total,
            'note' => $po->note,
            'payment_term' => $po->payment_term,
            'payment_days' => $po->payment_days,
            'company' => $po->company?->only(['name', 'phone', 'address']),
            'warehouse' => $po->warehouse?->only(['name']),
            'supplier' => $po->supplier?->only(['name', 'phone', 'payment_term', 'payment_days']),
            'created_at' => $po->created_at?->toIso8601String(),
            'items' => $po->items->map(fn ($item) => [
                'name' => $item->name_snapshot ?: $item->product?->name,
                'sku' => $item->product?->sku,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'unit_cost' => $item->unit_cost,
                'discount' => (int) ($item->discount ?? 0),
                'total' => $item->total,
                'note' => $item->note,
            ])->values(),
        ];
    }

    public function serializeGr(GoodsReceipt $gr): array
    {
        $gr = $this->loadGr($gr);

        return [
            'id' => $gr->id,
            'number' => $gr->number,
            'client_uuid' => $gr->client_uuid,
            'status' => $gr->status,
            'received_at' => $gr->received_at?->toIso8601String(),
            'subtotal' => $gr->subtotal,
            'tax' => $gr->tax,
            'total' => $gr->total,
            'note' => $gr->note,
            'outlet_id' => $gr->outlet_id,
            'warehouse_id' => $gr->warehouse_id,
            'warehouse' => $gr->warehouse?->only(['id', 'name']),
            'supplier_id' => $gr->supplier_id,
            'supplier' => $gr->supplier?->only(['id', 'name', 'phone']),
            'purchase_order_id' => $gr->purchase_order_id,
            'purchase_order' => $gr->purchaseOrder?->only(['id', 'number', 'status']),
            'user' => $gr->user?->only(['id', 'name']),
            'created_at' => $gr->created_at?->toIso8601String(),
            'is_direct' => $gr->purchase_order_id === null,
            'items' => $gr->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->product?->only(['id', 'name', 'sku', 'unit', 'cost_price']),
                'qty' => $item->qty,
                'unit_cost' => $item->unit_cost,
                'total' => $item->total,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'factor_to_base' => (int) ($item->factor_to_base ?: 1),
                'name_snapshot' => $item->name_snapshot,
                'note' => $item->note,
                'purchase_order_item_id' => $item->purchase_order_item_id,
            ])->values(),
        ];
    }

    // ─── Writers ──────────────────────────────────────────

    private function writeRequisition(array $payload, User $user): PurchaseRequisition
    {
        $company = CurrentCompany::company();
        $outlet = CurrentCompany::outlet();
        abort_unless($company && $outlet, 422, 'Pilih perusahaan/outlet dulu.');

        $warehouseId = $payload['warehouse_id'] ?? $this->inventory->resolveDefaultWarehouse($company->id, $outlet->id)->id;
        $this->assertWarehouse($company->id, (int) $warehouseId);

        $pr = PurchaseRequisition::query()->create([
            'company_id' => $company->id,
            'outlet_id' => $outlet->id,
            'warehouse_id' => $warehouseId,
            'user_id' => $user->id,
            'number' => $this->nextNumber('PR', $company->id),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'needed_at' => $payload['needed_at'] ?? null,
            'note' => $payload['note'] ?? null,
        ]);

        $this->attachPrItems($pr, $payload['items'] ?? []);

        if (array_key_exists('approvals', $payload) || $this->prNeedApproval()) {
            $this->syncPrApprovals($pr, $payload['approvals'] ?? []);
        }

        return $this->loadPr($pr->fresh());
    }

    /**
     * @param  list<array{user_id?: int}>  $approvals
     */
    private function syncPrApprovals(PurchaseRequisition $pr, array $approvals): void
    {
        $pr->approvals()->delete();

        if ($approvals === []) {
            if ($this->prNeedApproval()) {
                throw ValidationException::withMessages([
                    'approvals' => ['Pilih minimal satu approver, urut dari jabatan terendah ke tertinggi.'],
                ]);
            }

            return;
        }

        $companyId = (int) $pr->company_id;
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
            PurchaseRequisitionApproval::query()->create([
                'company_id' => $companyId,
                'purchase_requisition_id' => $pr->id,
                'level' => $level,
                'user_id' => $userId,
                'status' => 'pending',
            ]);
            $level++;
        }

        if ($this->prNeedApproval() && $seen === []) {
            throw ValidationException::withMessages([
                'approvals' => ['Pilih minimal satu approver, urut dari jabatan terendah ke tertinggi.'],
            ]);
        }
    }

    /**
     * @param  list<array{user_id?: int}>  $approvals
     */
    private function syncPoApprovals(PurchaseOrder $po, array $approvals): void
    {
        $po->approvals()->delete();

        if ($approvals === []) {
            if ($this->poNeedApproval()) {
                throw ValidationException::withMessages([
                    'approvals' => ['Pilih minimal satu approver, urut dari jabatan terendah ke tertinggi.'],
                ]);
            }

            return;
        }

        $companyId = (int) $po->company_id;
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
            PurchaseOrderApproval::query()->create([
                'company_id' => $companyId,
                'purchase_order_id' => $po->id,
                'level' => $level,
                'user_id' => $userId,
                'status' => 'pending',
            ]);
            $level++;
        }

        if ($this->poNeedApproval() && $seen === []) {
            throw ValidationException::withMessages([
                'approvals' => ['Pilih minimal satu approver, urut dari jabatan terendah ke tertinggi.'],
            ]);
        }
    }

    private function writeOrder(array $payload, User $user, string $flow): PurchaseOrder
    {
        $company = CurrentCompany::company();
        $outlet = CurrentCompany::outlet();
        abort_unless($company && $outlet, 422, 'Pilih perusahaan/outlet dulu.');

        $this->assertSupplier($company->id, (int) $payload['supplier_id']);

        $prId = $payload['purchase_requisition_id'] ?? null;
        $pr = null;
        if ($flow === 'strict_pr_po_gr') {
            if (! $prId) {
                throw ValidationException::withMessages([
                    'purchase_requisition_id' => ['Mode ketat mewajibkan PR yang sudah disetujui.'],
                ]);
            }
            $pr = PurchaseRequisition::query()->findOrFail($prId);
            if ($pr->status !== 'approved') {
                throw ValidationException::withMessages([
                    'purchase_requisition_id' => ['PR harus berstatus approved.'],
                ]);
            }
        } elseif ($prId) {
            $pr = PurchaseRequisition::query()->findOrFail($prId);
            if ($pr->status !== 'approved') {
                throw ValidationException::withMessages([
                    'purchase_requisition_id' => ['PR harus berstatus approved.'],
                ]);
            }
        }

        $warehouseId = $payload['warehouse_id']
            ?? ($pr?->warehouse_id)
            ?? $this->inventory->resolveDefaultWarehouse($company->id, $outlet->id)->id;
        $this->assertWarehouse($company->id, (int) $warehouseId);

        $po = PurchaseOrder::query()->create([
            'company_id' => $company->id,
            'outlet_id' => $outlet->id,
            'warehouse_id' => $warehouseId,
            'user_id' => $user->id,
            'supplier_id' => $payload['supplier_id'],
            'purchase_requisition_id' => $prId,
            'number' => $this->nextNumber('PO', $company->id),
            'client_uuid' => $payload['client_uuid'],
            'share_token' => Str::random(48),
            'status' => 'draft',
            'expected_at' => $payload['expected_at'] ?? null,
            'note' => $payload['note'] ?? null,
            'subtotal' => 0,
            'tax' => 0,
            'total' => 0,
        ]);

        $items = $payload['items'] ?? null;
        if ((! $items || $items === []) && $prId) {
            $items = PurchaseRequisition::query()->findOrFail($prId)->items->map(fn ($item) => [
                'product_id' => $item->product_id,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'unit_cost' => (int) ($item->product?->cost_price ?? 0) * max(1, (int) ($item->factor_to_base ?: 1)),
                'purchase_requisition_item_id' => $item->id,
                'note' => $item->note,
            ])->all();
        }

        $totals = $this->attachPoItems($po, $items ?? []);
        $po->update($totals);

        if (array_key_exists('approvals', $payload) || $this->poNeedApproval()) {
            $this->syncPoApprovals($po, $payload['approvals'] ?? []);
        }

        return $this->loadPo($po->fresh());
    }

    private function writeReceipt(array $payload, User $user, string $flow): GoodsReceipt
    {
        $company = CurrentCompany::company();
        $outlet = CurrentCompany::outlet();
        abort_unless($company && $outlet, 422, 'Pilih perusahaan/outlet dulu.');

        $poId = $payload['purchase_order_id'] ?? null;
        $po = null;

        if ($flow === 'direct') {
            // PO optional
        } else {
            if (! $poId) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => ['Mode saat ini mewajibkan PO.'],
                ]);
            }
        }

        if ($poId) {
            $po = PurchaseOrder::query()->with('items')->findOrFail($poId);
            if (! in_array($po->status, ['ordered', 'partial'], true)) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => ['PO harus berstatus ordered/partial.'],
                ]);
            }
            if ($flow === 'strict_pr_po_gr' && ! $po->purchase_requisition_id) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => ['Mode ketat mewajibkan PO yang berasal dari PR.'],
                ]);
            }
        }

        $supplierId = $payload['supplier_id'] ?? $po?->supplier_id;
        if ($supplierId) {
            $this->assertSupplier($company->id, (int) $supplierId);
        } elseif ($flow === 'direct') {
            throw ValidationException::withMessages([
                'supplier_id' => ['Supplier wajib diisi.'],
            ]);
        }

        $warehouseId = $payload['warehouse_id']
            ?? $po?->warehouse_id
            ?? $this->inventory->resolveDefaultWarehouse($company->id, $outlet->id)->id;
        $this->assertWarehouse($company->id, (int) $warehouseId);

        $gr = GoodsReceipt::query()->create([
            'company_id' => $company->id,
            'outlet_id' => $outlet->id,
            'warehouse_id' => $warehouseId,
            'user_id' => $user->id,
            'supplier_id' => $supplierId,
            'purchase_order_id' => $poId,
            'number' => $this->nextNumber('GR', $company->id),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'note' => $payload['note'] ?? null,
            'subtotal' => 0,
            'tax' => 0,
            'total' => 0,
        ]);

        $items = $payload['items'] ?? null;
        if ((! $items || $items === []) && $po) {
            $items = $po->items
                ->filter(fn ($item) => (int) $item->qty - (int) $item->qty_received > 0)
                ->map(fn ($item) => [
                    'product_id' => $item->product_id,
                    'qty' => (int) $item->qty - (int) $item->qty_received,
                    'unit_cost' => $item->unit_cost,
                    'unit' => $item->unit,
                    'unit_level' => $item->unit_level,
                    'purchase_order_item_id' => $item->id,
                    'note' => $item->note,
                ])->values()->all();
        }

        $totals = $this->attachGrItems($gr, $items ?? []);
        $gr->update($totals);

        return $this->loadGr($gr->fresh());
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function attachPrItems(PurchaseRequisition $pr, array $items): void
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item.']]);
        }

        foreach ($items as $row) {
            $product = Product::query()->findOrFail($row['product_id']);
            $resolved = $this->productUnits->resolveLine(
                $product,
                isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );
            $pr->items()->create([
                'company_id' => $pr->company_id,
                'product_id' => $product->id,
                'qty' => (int) $row['qty'],
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'note' => $row['note'] ?? null,
            ]);
        }
    }

    /**
     * Approver boleh mengurangi qty atau menghapus baris; tidak boleh menambah produk / menaikkan qty.
     *
     * @param  list<array{id?: int, qty?: int}>  $items
     */
    private function revisePrItemsDuringApproval(PurchaseRequisition $pr, array $items): void
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item harus tetap ada.']]);
        }

        $current = $pr->items()->get()->keyBy('id');
        $keepIds = [];

        foreach ($items as $index => $row) {
            $id = (int) ($row['id'] ?? 0);
            $item = $current->get($id);
            if (! $item) {
                throw ValidationException::withMessages([
                    "items.$index.id" => ['Item tidak valid untuk PR ini.'],
                ]);
            }

            $qty = (int) ($row['qty'] ?? 0);
            if ($qty < 1) {
                throw ValidationException::withMessages([
                    "items.$index.qty" => ['Qty minimal 1.'],
                ]);
            }
            if ($qty > (int) $item->qty) {
                throw ValidationException::withMessages([
                    "items.$index.qty" => ['Approver tidak boleh menaikkan qty di atas permintaan.'],
                ]);
            }

            if ($qty !== (int) $item->qty) {
                $item->update(['qty' => $qty]);
            }
            $keepIds[] = $id;
        }

        $pr->items()->whereNotIn('id', $keepIds)->delete();

        if ($pr->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item harus tetap ada.']]);
        }
    }

    /**
     * @param  list<array{id?: int, qty?: int}>  $items
     */
    private function revisePoItemsDuringApproval(PurchaseOrder $po, array $items): void
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item harus tetap ada.']]);
        }

        $keepIds = [];
        foreach ($items as $index => $row) {
            $id = (int) ($row['id'] ?? 0);
            $item = PurchaseOrderItem::query()
                ->where('purchase_order_id', $po->id)
                ->whereKey($id)
                ->first();
            if (! $item) {
                throw ValidationException::withMessages([
                    "items.$index.id" => ['Item PO tidak ditemukan.'],
                ]);
            }

            $qty = (int) ($row['qty'] ?? 0);
            if ($qty < 1) {
                throw ValidationException::withMessages([
                    "items.$index.qty" => ['Qty minimal 1.'],
                ]);
            }
            if ($qty > (int) $item->qty) {
                throw ValidationException::withMessages([
                    "items.$index.qty" => ['Approver tidak boleh menaikkan qty di atas PO.'],
                ]);
            }

            if ($qty !== (int) $item->qty) {
                $lineTotal = max(0, ($qty * (int) $item->unit_cost) - (int) ($item->discount ?? 0));
                $item->update([
                    'qty' => $qty,
                    'total' => $lineTotal,
                ]);
            }
            $keepIds[] = $id;
        }

        $po->items()->whereNotIn('id', $keepIds)->delete();

        if ($po->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item harus tetap ada.']]);
        }

        $subtotal = (int) $po->items()->sum('total');
        $po->update($this->resolvePoTotals($po, $subtotal));
    }

    /**
     * @return array{subtotal: int, tax_percent: float, tax: int, total: int, payment_term: ?string, payment_days: ?int}
     */
    private function resolvePoTotals(PurchaseOrder $po, int $subtotal, ?Contact $supplier = null): array
    {
        $supplier ??= $po->supplier_id
            ? Contact::query()->find($po->supplier_id)
            : null;

        $taxPercent = 0.0;
        if ($supplier && $supplier->is_taxable && $supplier->tax_percent > 0) {
            $taxPercent = (float) $supplier->tax_percent;
        }

        $tax = (int) round($subtotal * $taxPercent / 100);

        return [
            'subtotal' => $subtotal,
            'tax_percent' => $taxPercent,
            'tax' => $tax,
            'total' => $subtotal + $tax,
            'payment_term' => $supplier?->payment_term,
            'payment_days' => $supplier?->payment_days,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return array{subtotal: int, tax_percent: float, tax: int, total: int, payment_term: ?string, payment_days: ?int}
     */
    private function attachPoItems(PurchaseOrder $po, array $items): array
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

            $po->items()->create([
                'company_id' => $po->company_id,
                'product_id' => $product->id,
                'purchase_requisition_item_id' => $row['purchase_requisition_item_id'] ?? null,
                'qty' => $qty,
                'qty_received' => 0,
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

        return $this->resolvePoTotals($po, $subtotal);
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return array{subtotal: int, tax: int, total: int}
     */
    private function attachGrItems(GoodsReceipt $gr, array $items): array
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
            $lineTotal = $qty * $unitCost;
            $subtotal += $lineTotal;

            $gr->items()->create([
                'company_id' => $gr->company_id,
                'product_id' => $product->id,
                'purchase_order_item_id' => $row['purchase_order_item_id'] ?? null,
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'total' => $lineTotal,
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'note' => $row['note'] ?? null,
            ]);
        }

        return ['subtotal' => $subtotal, 'tax' => 0, 'total' => $subtotal];
    }

    private function refreshPoStatus(int $poId): void
    {
        $po = PurchaseOrder::query()->with('items')->whereKey($poId)->lockForUpdate()->first();
        if (! $po || $po->status === 'cancelled') {
            return;
        }

        $allReceived = $po->items->every(fn ($item) => (int) $item->qty_received >= (int) $item->qty);
        $anyReceived = $po->items->contains(fn ($item) => (int) $item->qty_received > 0);

        $po->update([
            'status' => $allReceived ? 'received' : ($anyReceived ? 'partial' : $po->status),
        ]);
    }

    private function nextNumber(string $prefix, int $companyId): string
    {
        $full = $prefix.'-'.now()->format('ymd').'-';
        $model = match ($prefix) {
            'PR' => PurchaseRequisition::class,
            'PO' => PurchaseOrder::class,
            default => GoodsReceipt::class,
        };

        $last = $model::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('number', 'like', $full.'%')
            ->orderByDesc('number')
            ->lockForUpdate()
            ->value('number');

        $seq = $last ? ((int) substr((string) $last, -3)) + 1 : 1;

        return $full.str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
    }

    private function assertWarehouse(int $companyId, int $warehouseId): void
    {
        $ok = Warehouse::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($warehouseId)
            ->where('is_active', true)
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages(['warehouse_id' => ['Gudang tidak valid.']]);
        }
    }

    private function assertSupplier(int $companyId, int $supplierId): void
    {
        $ok = Contact::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($supplierId)
            ->whereIn('type', ['supplier', 'both'])
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages(['supplier_id' => ['Supplier tidak valid.']]);
        }
    }

    private function loadPr(PurchaseRequisition $pr): PurchaseRequisition
    {
        return $pr->load([
            'items.product:id,name,sku,unit,cost_price',
            'outlet:id,name',
            'warehouse:id,name',
            'user:id,name',
            'approver:id,name',
            'approvals.user:id,name',
            'orders:id,purchase_requisition_id,number,status',
        ]);
    }

    /**
     * Harga beli historis dari GR confirmed, dinormalisasi ke unit baris (× factor_to_base).
     *
     * @return array{last: int, min: int, max: int}
     */
    private function costHintsForProduct(int $productId, int $factorToBase): array
    {
        static $cache = [];

        if (! isset($cache[$productId])) {
            $rows = DB::table('goods_receipt_items as gri')
                ->join('goods_receipts as gr', 'gr.id', '=', 'gri.goods_receipt_id')
                ->where('gri.product_id', $productId)
                ->where('gr.status', 'confirmed')
                ->where('gri.unit_cost', '>', 0)
                ->orderByDesc('gr.id')
                ->get(['gri.unit_cost', 'gri.factor_to_base']);

            $bases = [];
            foreach ($rows as $row) {
                $f = max(1, (int) ($row->factor_to_base ?: 1));
                $bases[] = (int) round((int) $row->unit_cost / $f);
            }

            $cache[$productId] = [
                'last_base' => $bases[0] ?? 0,
                'min_base' => $bases === [] ? 0 : min($bases),
                'max_base' => $bases === [] ? 0 : max($bases),
            ];
        }

        $factor = max(1, $factorToBase);
        $hit = $cache[$productId];

        return [
            'last' => (int) $hit['last_base'] * $factor,
            'min' => (int) $hit['min_base'] * $factor,
            'max' => (int) $hit['max_base'] * $factor,
        ];
    }

    private function loadPo(PurchaseOrder $po): PurchaseOrder
    {
        return $po->load([
            'items.product:id,name,sku,unit,cost_price',
            'warehouse:id,name',
            'supplier:id,name,phone,is_taxable,tax_percent,payment_term,payment_days',
            'requisition:id,number,status',
            'user:id,name',
            'approver:id,name',
            'approvals.user:id,name',
        ]);
    }

    private function loadGr(GoodsReceipt $gr): GoodsReceipt
    {
        return $gr->load([
            'items.product:id,name,sku,unit,cost_price',
            'warehouse:id,name',
            'supplier:id,name,phone',
            'purchaseOrder:id,number,status',
            'user:id,name',
        ]);
    }
}
