<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Contact;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnApproval;
use App\Models\PurchaseReturnItem;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProcurementReturnService
{
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
        private NotificationService $notifications,
    ) {}

    public function returnEnabled(?Company $company = null): bool
    {
        return ProcurementSettings::returnEnabled($company);
    }

    public function returnNeedApproval(?Company $company = null): bool
    {
        return ProcurementSettings::returnNeedApproval($company);
    }

    public function create(array $payload, User $user): PurchaseReturn
    {
        if (! $this->returnEnabled()) {
            throw ValidationException::withMessages([
                'return' => ['Modul retur pembelian tidak aktif. Aktifkan di Pengaturan Procurement.'],
            ]);
        }

        $existing = PurchaseReturn::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadReturn($existing);
        }

        try {
            return DB::transaction(fn () => $this->writeReturn($payload, $user));
        } catch (UniqueConstraintViolationException) {
            $row = PurchaseReturn::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadReturn($row);
        }
    }

    public function update(PurchaseReturn $return, array $payload): PurchaseReturn
    {
        if (! in_array($return->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['Retur hanya bisa diubah saat draft atau ditolak.']]);
        }

        return DB::transaction(function () use ($return, $payload) {
            $return->update([
                'supplier_id' => $payload['supplier_id'] ?? $return->supplier_id,
                'warehouse_id' => $payload['warehouse_id'] ?? $return->warehouse_id,
                'goods_receipt_id' => $payload['goods_receipt_id'] ?? $return->goods_receipt_id,
                'reason' => $payload['reason'] ?? $return->reason,
                'note' => $payload['note'] ?? $return->note,
            ]);

            if (isset($payload['items'])) {
                $return->items()->delete();
                $this->attachItems($return, $payload['items']);
            }

            if (array_key_exists('approvals', $payload) || $this->returnNeedApproval()) {
                $this->syncApprovals($return, $payload['approvals'] ?? []);
            }

            return $this->loadReturn($return->fresh());
        });
    }

    public function submit(PurchaseReturn $return): PurchaseReturn
    {
        if (! in_array($return->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['Retur tidak bisa diajukan.']]);
        }
        if ($return->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Retur belum punya item.']]);
        }

        $result = DB::transaction(function () use ($return) {
            $return = PurchaseReturn::query()->whereKey($return->id)->lockForUpdate()->firstOrFail();

            if ($this->returnNeedApproval()) {
                $levels = $return->approvals()->orderBy('level')->get();
                if ($levels->isEmpty()) {
                    throw ValidationException::withMessages([
                        'approvals' => ['Retur membutuhkan approval. Pilih minimal satu approver dan urutkan levelnya.'],
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
                $return->update([
                    'status' => 'submitted',
                    'approved_by' => null,
                    'approved_at' => null,
                    'current_approval_level' => 1,
                ]);
            } else {
                $return->approvals()->delete();
                $return->update([
                    'status' => 'approved',
                    'approved_by' => null,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadReturn($return->fresh());
        });

        if ($this->returnNeedApproval()) {
            $this->notifyCurrentApprover($result);
        }

        return $result;
    }

    public function approve(PurchaseReturn $return, User $user): PurchaseReturn
    {
        if ($return->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya retur yang diajukan yang bisa disetujui.']]);
        }

        $result = DB::transaction(function () use ($return, $user) {
            $return = PurchaseReturn::query()->whereKey($return->id)->lockForUpdate()->firstOrFail();

            if (! $this->returnNeedApproval() || $return->approvals()->count() === 0) {
                $return->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);

                return $this->loadReturn($return->fresh());
            }

            $level = (int) ($return->current_approval_level ?: 1);
            $step = PurchaseReturnApproval::query()
                ->where('purchase_return_id', $return->id)
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
            $hasNext = PurchaseReturnApproval::query()
                ->where('purchase_return_id', $return->id)
                ->where('level', $nextLevel)
                ->exists();

            if ($hasNext) {
                $return->update(['current_approval_level' => $nextLevel]);
            } else {
                $return->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'current_approval_level' => null,
                ]);
            }

            return $this->loadReturn($return->fresh());
        });

        if ($result->status === 'submitted') {
            $this->notifyCurrentApprover($result);
        } else {
            $this->notifyCreator($result, 'notifReturnApprovedTitle', 'notifReturnApprovedBody', 'success');
        }

        return $result;
    }

    public function reject(PurchaseReturn $return, User $user, ?string $note = null): PurchaseReturn
    {
        if ($return->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya retur yang diajukan yang bisa ditolak.']]);
        }

        return DB::transaction(function () use ($return, $user, $note) {
            $return = PurchaseReturn::query()->whereKey($return->id)->lockForUpdate()->firstOrFail();

            if ($this->returnNeedApproval() && $return->approvals()->count() > 0) {
                $level = (int) ($return->current_approval_level ?: 1);
                $step = PurchaseReturnApproval::query()
                    ->where('purchase_return_id', $return->id)
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

            $return->update([
                'status' => 'rejected',
                'current_approval_level' => null,
            ]);

            $loaded = $this->loadReturn($return->fresh());
            $this->notifyCreator($loaded, 'notifReturnRejectedTitle', 'notifReturnRejectedBody', 'warning');

            return $loaded;
        });
    }

    public function confirm(PurchaseReturn $return): PurchaseReturn
    {
        if ($return->status !== 'approved') {
            throw ValidationException::withMessages(['status' => ['Retur harus disetujui dulu sebelum dikonfirmasi.']]);
        }
        if ($return->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Retur belum punya item.']]);
        }

        return DB::transaction(function () use ($return) {
            $return = PurchaseReturn::query()->whereKey($return->id)->lockForUpdate()->firstOrFail();
            $return->load('items');

            foreach ($return->items as $item) {
                $product = Product::query()->withoutGlobalScopes()->find($item->product_id);
                $factor = max(1, (int) ($item->factor_to_base ?: 1));
                $baseQty = $this->productUnits->toBaseQty((int) $item->qty, $factor);

                if ($product?->track_stock) {
                    $this->inventory->adjust(
                        (int) $return->company_id,
                        (int) $return->warehouse_id,
                        (int) $item->product_id,
                        -$baseQty,
                        'purchase_return',
                        'purchase_return',
                        (int) $return->id,
                        'Retur '.$return->number,
                        (int) $return->outlet_id,
                        [
                            'qty_input' => (int) $item->qty,
                            'unit_level' => $item->unit_level,
                            'unit' => $item->unit,
                            'factor_to_base' => $factor,
                        ],
                    );
                }
            }

            $return->update([
                'status' => 'confirmed',
                'returned_at' => now(),
            ]);

            return $this->loadReturn($return->fresh());
        });
    }

    public function cancel(PurchaseReturn $return): PurchaseReturn
    {
        if (! in_array($return->status, ['draft', 'submitted', 'rejected', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => ['Retur tidak bisa dibatalkan.']]);
        }

        $return->update(['status' => 'cancelled']);

        return $this->loadReturn($return->fresh());
    }

    public function serialize(PurchaseReturn $return): array
    {
        $return = $this->loadReturn($return);
        $needApproval = $this->returnNeedApproval();
        $meId = auth()->id();
        $currentLevel = $return->current_approval_level ? (int) $return->current_approval_level : null;
        $currentStep = $currentLevel
            ? $return->approvals->firstWhere('level', $currentLevel)
            : null;
        $canApprove = $return->status === 'submitted' && (
            (! $needApproval || $return->approvals->isEmpty())
                ? true
                : ($currentStep && (int) $currentStep->user_id === (int) $meId && $currentStep->status === 'pending')
        );
        $approvalPositions = $this->positionNamesForUsers(
            (int) $return->company_id,
            $return->approvals->pluck('user_id')->map(fn ($id) => (int) $id)->all(),
        );

        return [
            'id' => $return->id,
            'number' => $return->number,
            'client_uuid' => $return->client_uuid,
            'status' => $return->status,
            'reason' => $return->reason,
            'note' => $return->note,
            'returned_at' => $return->returned_at?->toIso8601String(),
            'created_at' => $return->created_at?->toIso8601String(),
            'supplier' => $return->supplier?->only(['id', 'name']),
            'warehouse' => $return->warehouse?->only(['id', 'name']),
            'goods_receipt' => $return->goodsReceipt?->only(['id', 'number']),
            'user' => $return->user?->only(['id', 'name']),
            'return_need_approval' => $needApproval,
            'current_approval_level' => $currentLevel,
            'can_approve' => (bool) $canApprove,
            'approvals' => $return->approvals->map(fn (PurchaseReturnApproval $row) => [
                'id' => $row->id,
                'level' => (int) $row->level,
                'user_id' => (int) $row->user_id,
                'user' => $this->serializeApprovalUser($row->user, $approvalPositions, (int) $row->user_id),
                'status' => $row->status,
                'acted_at' => $row->acted_at?->toIso8601String(),
                'is_current' => $return->status === 'submitted' && $currentLevel === (int) $row->level,
            ])->values(),
            'items' => $return->items->map(fn (PurchaseReturnItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->product?->only(['id', 'name', 'sku', 'unit']),
                'qty' => $item->qty,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'unit_cost' => $item->unit_cost,
                'name_snapshot' => $item->name_snapshot,
                'note' => $item->note,
            ])->values(),
        ];
    }

    public function loadReturn(PurchaseReturn $return): PurchaseReturn
    {
        return $return->load([
            'items.product:id,name,sku,unit',
            'supplier:id,name',
            'warehouse:id,name',
            'goodsReceipt:id,number',
            'user:id,name',
            'approvals.user:id,name',
        ]);
    }

    private function writeReturn(array $payload, User $user): PurchaseReturn
    {
        $company = CurrentCompany::company();
        $companyId = (int) $company->id;
        $warehouseId = (int) ($payload['warehouse_id'] ?? 0);
        $supplierId = (int) ($payload['supplier_id'] ?? 0);

        $this->assertWarehouse($companyId, $warehouseId);
        $this->assertSupplier($companyId, $supplierId);

        $warehouse = Warehouse::query()->withoutGlobalScopes()->findOrFail($warehouseId);
        $outletId = (int) ($warehouse->outlet_id ?: Outlet::query()
            ->where('company_id', $companyId)
            ->orderByDesc('is_default')
            ->value('id'));

        $return = PurchaseReturn::query()->create([
            'company_id' => $companyId,
            'outlet_id' => $outletId,
            'warehouse_id' => $warehouseId,
            'user_id' => $user->id,
            'supplier_id' => $supplierId,
            'goods_receipt_id' => $payload['goods_receipt_id'] ?? null,
            'number' => $this->nextNumber($companyId),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'reason' => $payload['reason'] ?? null,
            'note' => $payload['note'] ?? null,
        ]);

        $this->attachItems($return, $payload['items'] ?? []);

        if (array_key_exists('approvals', $payload) || $this->returnNeedApproval()) {
            $this->syncApprovals($return, $payload['approvals'] ?? []);
        }

        return $this->loadReturn($return->fresh());
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function attachItems(PurchaseReturn $return, array $items): void
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

            $return->items()->create([
                'company_id' => $return->company_id,
                'product_id' => $product->id,
                'goods_receipt_item_id' => $row['goods_receipt_item_id'] ?? null,
                'qty' => (int) $row['qty'],
                'unit_cost' => (int) ($row['unit_cost'] ?? $product->cost_price ?? 0),
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'note' => $row['note'] ?? null,
            ]);
        }
    }

    /**
     * @param  list<array{user_id?: int}>  $approvals
     */
    private function syncApprovals(PurchaseReturn $return, array $approvals): void
    {
        $return->approvals()->delete();

        if ($approvals === []) {
            if ($this->returnNeedApproval()) {
                throw ValidationException::withMessages([
                    'approvals' => ['Pilih minimal satu approver dan urutkan levelnya.'],
                ]);
            }

            return;
        }

        $companyId = (int) $return->company_id;
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
            PurchaseReturnApproval::query()->create([
                'company_id' => $companyId,
                'purchase_return_id' => $return->id,
                'level' => $level,
                'user_id' => $userId,
                'status' => 'pending',
            ]);
            $level++;
        }

        if ($this->returnNeedApproval() && $seen === []) {
            throw ValidationException::withMessages([
                'approvals' => ['Pilih minimal satu approver dan urutkan levelnya.'],
            ]);
        }
    }

    private function notifyCurrentApprover(PurchaseReturn $return): void
    {
        $level = (int) ($return->current_approval_level ?: 1);
        $step = $return->approvals->firstWhere('level', $level);
        if (! $step) {
            return;
        }

        $this->notifications->notify(
            (int) $step->user_id,
            'notifReturnApprovalNeededTitle',
            'notifReturnApprovalNeededBody',
            [
                'number' => $return->number,
                'requester' => $return->user?->name ?? '-',
                'level' => (string) $step->level,
            ],
            [
                'type' => 'purchase_return',
                'id' => $return->id,
                'app' => 'approvals',
            ],
            'info',
            (int) $return->company_id,
        );
    }

    private function notifyCreator(PurchaseReturn $return, string $titleKey, string $bodyKey, string $tone): void
    {
        if (! $return->user_id) {
            return;
        }

        $this->notifications->notify(
            (int) $return->user_id,
            $titleKey,
            $bodyKey,
            ['number' => $return->number],
            [
                'type' => 'purchase_return',
                'id' => $return->id,
                'app' => 'purchase',
            ],
            $tone,
            (int) $return->company_id,
        );
    }

    private function nextNumber(int $companyId): string
    {
        $full = 'PRN-'.now()->format('ymd').'-';
        $last = PurchaseReturn::query()
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
