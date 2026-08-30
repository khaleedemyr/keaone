<?php

namespace App\Services;

use App\Models\ApprovalDelegation;
use App\Models\ApprovalMatrixRule;
use App\Models\CompanyUser;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderApproval;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseRequisitionApproval;
use App\Models\User;
use App\Support\ProcurementSettings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ApprovalGovernanceService
{
    public const DOC_PR = 'pr';

    public const DOC_PO = 'po';

    public function approvalMode(?\App\Models\Company $company = null): string
    {
        $mode = (string) ProcurementSettings::get('procurement_approval_mode', 'manual', $company);

        return in_array($mode, ['manual', 'matrix'], true) ? $mode : 'manual';
    }

    public function matrixEnabled(?\App\Models\Company $company = null): bool
    {
        return $this->approvalMode($company) === 'matrix';
    }

    public function parallelEnabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_approval_parallel_enabled', $company);
    }

    public function delegationEnabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_approval_delegation_enabled', $company);
    }

    public function escalationEnabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_approval_escalation_enabled', $company);
    }

    public function slaDays(?\App\Models\Company $company = null): int
    {
        return max(1, (int) ProcurementSettings::get('procurement_approval_sla_days', 3, $company));
    }

    public function sodCreatorApprover(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_sod_creator_approver', $company);
    }

    public function sodApproverReceiver(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_sod_approver_receiver', $company);
    }

    public function fieldAuditEnabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_field_audit_enabled', $company);
    }

    /**
     * @return list<int>
     */
    public function delegateUserIdsFor(int $companyId, int $userId): array
    {
        if (! $this->delegationEnabled()) {
            return [];
        }

        $today = now()->toDateString();

        return ApprovalDelegation::query()
            ->where('company_id', $companyId)
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->whereDate('starts_at', '<=', $today)
            ->whereDate('ends_at', '>=', $today)
            ->pluck('delegate_user_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    public function canUserActOnApproval(Model $step, int $actorUserId): bool
    {
        $assignedUserId = (int) $step->user_id;
        if ($assignedUserId === $actorUserId) {
            return true;
        }

        return in_array($actorUserId, $this->delegateUserIdsFor((int) $step->company_id, $assignedUserId), true);
    }

    /**
     * @param  list<int>  $approverUserIds
     */
    public function assertApproversValid(int $companyId, int $creatorUserId, array $approverUserIds): void
    {
        if (! $this->sodCreatorApprover()) {
            return;
        }

        if (in_array($creatorUserId, $approverUserIds, true)) {
            throw ValidationException::withMessages([
                'approvals' => ['Pembuat dokumen tidak boleh menjadi approver (segregation of duties).'],
            ]);
        }
    }

    public function assertReceiverNotPoApprover(PurchaseOrder $po, int $receiverUserId): void
    {
        if (! $this->sodApproverReceiver()) {
            return;
        }

        $approved = PurchaseOrderApproval::query()
            ->where('purchase_order_id', $po->id)
            ->where('status', 'approved')
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (in_array($receiverUserId, $approved, true)) {
            throw ValidationException::withMessages([
                'user_id' => ['Approver PO tidak boleh menerima GR yang sama (segregation of duties).'],
            ]);
        }
    }

    /**
     * @return list<array{level: int, user_id: int}>
     */
    public function resolveMatrixChain(string $docType, int $companyId, ?int $departmentId, int $amount): array
    {
        $rules = ApprovalMatrixRule::query()
            ->where('company_id', $companyId)
            ->where('doc_type', $docType)
            ->where('is_active', true)
            ->orderBy('level')
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get()
            ->filter(function (ApprovalMatrixRule $rule) use ($departmentId, $amount) {
                if ($rule->department_id !== null && (int) $rule->department_id !== (int) ($departmentId ?? 0)) {
                    return false;
                }
                if ($amount < (int) $rule->min_amount) {
                    return false;
                }
                if ($rule->max_amount !== null && $amount > (int) $rule->max_amount) {
                    return false;
                }

                return true;
            });

        $byLevel = [];
        foreach ($rules as $rule) {
            $level = (int) $rule->level;
            if (! isset($byLevel[$level])) {
                $byLevel[$level] = $rule;
            }
        }

        ksort($byLevel);

        $chain = [];
        $seenUsers = [];
        foreach ($byLevel as $level => $rule) {
            $userIds = $this->resolveRuleToUserIds($rule, $companyId);
            if ($userIds === []) {
                continue;
            }

            if (! $this->parallelEnabled()) {
                $userIds = [reset($userIds)];
            }

            foreach ($userIds as $userId) {
                if (isset($seenUsers[$userId])) {
                    continue;
                }
                $seenUsers[$userId] = true;
                $chain[] = [
                    'level' => (int) $level,
                    'user_id' => (int) $userId,
                ];
            }
        }

        return $chain;
    }

    /**
     * @return list<int>
     */
    private function resolveRuleToUserIds(ApprovalMatrixRule $rule, int $companyId): array
    {
        $type = (string) $rule->approver_type;
        $refId = (int) ($rule->approver_ref_id ?? 0);

        if ($type === 'user') {
            return $refId > 0 && $this->isActiveMember($companyId, $refId) ? [$refId] : [];
        }

        $query = CompanyUser::query()
            ->where('company_id', $companyId)
            ->where('is_active', true);

        $query = match ($type) {
            'role' => $query->where('role_id', $refId),
            'position' => $query->where('position_id', $refId),
            'job_level' => $query->where('job_level_id', $refId),
            default => null,
        };

        if (! $query) {
            return [];
        }

        return $query->orderBy('user_id')->pluck('user_id')->map(fn ($id) => (int) $id)->all();
    }

    private function isActiveMember(int $companyId, int $userId): bool
    {
        return CompanyUser::query()
            ->where('company_id', $companyId)
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->exists();
    }

    public function applyMatrixToPr(PurchaseRequisition $pr): void
    {
        $amount = $this->estimatePrAmount($pr);
        $chain = $this->resolveMatrixChain(self::DOC_PR, (int) $pr->company_id, $pr->department_id, $amount);

        if ($chain === []) {
            throw ValidationException::withMessages([
                'approvals' => ['Tidak ada aturan approval matrix yang cocok untuk PR ini. Periksa matrix di pengaturan.'],
            ]);
        }

        $this->assertApproversValid((int) $pr->company_id, (int) $pr->user_id, array_column($chain, 'user_id'));
        $this->syncPrApprovalRows($pr, $chain);
    }

    public function applyMatrixToPo(PurchaseOrder $po): void
    {
        $amount = (int) $po->total;
        $chain = $this->resolveMatrixChain(self::DOC_PO, (int) $po->company_id, $po->department_id, $amount);

        if ($chain === []) {
            throw ValidationException::withMessages([
                'approvals' => ['Tidak ada aturan approval matrix yang cocok untuk PO ini. Periksa matrix di pengaturan.'],
            ]);
        }

        $this->assertApproversValid((int) $po->company_id, (int) $po->user_id, array_column($chain, 'user_id'));
        $this->syncPoApprovalRows($po, $chain);
    }

    /**
     * @param  list<array{level: int, user_id: int}>  $chain
     */
    public function syncPrApprovalRows(PurchaseRequisition $pr, array $chain): void
    {
        $pr->approvals()->delete();
        $companyId = (int) $pr->company_id;

        foreach ($chain as $row) {
            PurchaseRequisitionApproval::query()->create([
                'company_id' => $companyId,
                'purchase_requisition_id' => $pr->id,
                'level' => (int) $row['level'],
                'user_id' => (int) $row['user_id'],
                'status' => 'pending',
            ]);
        }
    }

    /**
     * @param  list<array{level: int, user_id: int}>  $chain
     */
    public function syncPoApprovalRows(PurchaseOrder $po, array $chain): void
    {
        $po->approvals()->delete();
        $companyId = (int) $po->company_id;

        foreach ($chain as $row) {
            PurchaseOrderApproval::query()->create([
                'company_id' => $companyId,
                'purchase_order_id' => $po->id,
                'level' => (int) $row['level'],
                'user_id' => (int) $row['user_id'],
                'status' => 'pending',
            ]);
        }
    }

    public function estimatePrAmount(PurchaseRequisition $pr): int
    {
        $pr->loadMissing('items.product');
        $total = 0;

        foreach ($pr->items as $item) {
            $cost = (int) ($item->product?->cost_price ?? 0);
            $factor = max(1, (int) ($item->factor_to_base ?: 1));
            $total += (int) $item->qty * $cost * $factor;
        }

        return $total;
    }

    public function markApprovalRowsPending(Collection $rows): void
    {
        $now = now();
        foreach ($rows as $row) {
            $row->update([
                'status' => 'pending',
                'acted_by' => null,
                'acted_at' => null,
                'note' => null,
                'pending_since' => $now,
                'escalated_at' => null,
            ]);
        }
    }

    public function levelHasPendingApprovals(string $docKind, int $docId, int $level): bool
    {
        if ($docKind === self::DOC_PR) {
            return PurchaseRequisitionApproval::query()
                ->where('purchase_requisition_id', $docId)
                ->where('level', $level)
                ->where('status', 'pending')
                ->exists();
        }

        return PurchaseOrderApproval::query()
            ->where('purchase_order_id', $docId)
            ->where('level', $level)
            ->where('status', 'pending')
            ->exists();
    }

    public function nextApprovalLevel(string $docKind, int $docId, int $afterLevel): ?int
    {
        if ($docKind === self::DOC_PR) {
            $next = PurchaseRequisitionApproval::query()
                ->where('purchase_requisition_id', $docId)
                ->where('level', '>', $afterLevel)
                ->orderBy('level')
                ->value('level');
        } else {
            $next = PurchaseOrderApproval::query()
                ->where('purchase_order_id', $docId)
                ->where('level', '>', $afterLevel)
                ->orderBy('level')
                ->value('level');
        }

        return $next !== null ? (int) $next : null;
    }

    public function findPendingStepForUser(string $docKind, int $docId, int $level, User $user): ?Model
    {
        if ($docKind === self::DOC_PR) {
            $steps = PurchaseRequisitionApproval::query()
                ->where('purchase_requisition_id', $docId)
                ->where('level', $level)
                ->where('status', 'pending')
                ->get();
        } else {
            $steps = PurchaseOrderApproval::query()
                ->where('purchase_order_id', $docId)
                ->where('level', $level)
                ->where('status', 'pending')
                ->get();
        }

        return $steps->first(fn (Model $step) => $this->canUserActOnApproval($step, (int) $user->id));
    }

    public function canUserApproveDocument(string $docKind, int $docId, int $currentLevel, int $userId): bool
    {
        if ($docKind === self::DOC_PR) {
            $steps = PurchaseRequisitionApproval::query()
                ->where('purchase_requisition_id', $docId)
                ->where('level', $currentLevel)
                ->where('status', 'pending')
                ->get();
        } else {
            $steps = PurchaseOrderApproval::query()
                ->where('purchase_order_id', $docId)
                ->where('level', $currentLevel)
                ->where('status', 'pending')
                ->get();
        }

        return $steps->contains(fn (Model $step) => $this->canUserActOnApproval($step, $userId));
    }

    public function escalateStaleApprovals(): int
    {
        if (! $this->escalationEnabled()) {
            return 0;
        }

        $count = 0;
        $defaultSla = $this->slaDays();

        foreach ([PurchaseRequisitionApproval::class => 'requisition', PurchaseOrderApproval::class => 'order'] as $modelClass => $relation) {
            /** @var class-string<Model> $modelClass */
            $pending = $modelClass::query()
                ->where('status', 'pending')
                ->whereNotNull('pending_since')
                ->with([$relation])
                ->get();

            foreach ($pending as $step) {
                $doc = $step->{$relation};
                if (! $doc || $doc->status !== 'submitted') {
                    continue;
                }
                if ((int) $doc->current_approval_level !== (int) $step->level) {
                    continue;
                }

                $docType = $step instanceof PurchaseRequisitionApproval ? self::DOC_PR : self::DOC_PO;
                $rule = $this->matchingMatrixRule(
                    $docType,
                    (int) $step->company_id,
                    $doc->department_id,
                    $step instanceof PurchaseRequisitionApproval
                        ? $this->estimatePrAmount($doc)
                        : (int) $doc->total,
                    (int) $step->level,
                );

                $slaDays = (int) ($rule?->escalate_after_days ?? $defaultSla);
                $deadline = $step->pending_since?->copy()->addDays($slaDays);
                if (! $deadline || now()->lt($deadline)) {
                    continue;
                }

                $targetUserId = (int) ($rule?->escalate_to_user_id ?? 0);
                if ($targetUserId < 1 || ! $this->isActiveMember((int) $step->company_id, $targetUserId)) {
                    continue;
                }

                if ((int) $step->user_id === $targetUserId) {
                    continue;
                }

                $step->update([
                    'delegated_from_user_id' => $step->user_id,
                    'user_id' => $targetUserId,
                    'pending_since' => now(),
                    'escalated_at' => now(),
                ]);
                $count++;
            }
        }

        return $count;
    }

    private function matchingMatrixRule(
        string $docType,
        int $companyId,
        ?int $departmentId,
        int $amount,
        int $level,
    ): ?ApprovalMatrixRule {
        return ApprovalMatrixRule::query()
            ->where('company_id', $companyId)
            ->where('doc_type', $docType)
            ->where('level', $level)
            ->where('is_active', true)
            ->orderByDesc('priority')
            ->get()
            ->first(function (ApprovalMatrixRule $rule) use ($departmentId, $amount) {
                if ($rule->department_id !== null && (int) $rule->department_id !== (int) ($departmentId ?? 0)) {
                    return false;
                }
                if ($amount < (int) $rule->min_amount) {
                    return false;
                }
                if ($rule->max_amount !== null && $amount > (int) $rule->max_amount) {
                    return false;
                }

                return true;
            });
    }

    /**
     * User IDs whose pending approvals this delegate may act on.
     *
     * @return list<int>
     */
    public function delegatorUserIdsFor(int $companyId, int $delegateUserId): array
    {
        if (! $this->delegationEnabled()) {
            return [];
        }

        $today = now()->toDateString();

        return ApprovalDelegation::query()
            ->where('company_id', $companyId)
            ->where('delegate_user_id', $delegateUserId)
            ->where('is_active', true)
            ->whereDate('starts_at', '<=', $today)
            ->whereDate('ends_at', '>=', $today)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return list<int>
     */
    public function inboxAssigneeUserIds(int $companyId, int $userId): array
    {
        return array_values(array_unique(array_merge(
            [$userId],
            $this->delegatorUserIdsFor($companyId, $userId),
        )));
    }

    public function serializeMatrixRule(ApprovalMatrixRule $rule): array
    {
        $rule->loadMissing(['department:id,name,code', 'escalateTo:id,name']);

        return [
            'id' => $rule->id,
            'doc_type' => $rule->doc_type,
            'department_id' => $rule->department_id,
            'department' => $rule->department?->only(['id', 'name', 'code']),
            'min_amount' => (int) $rule->min_amount,
            'max_amount' => $rule->max_amount !== null ? (int) $rule->max_amount : null,
            'level' => (int) $rule->level,
            'approver_type' => $rule->approver_type,
            'approver_ref_id' => $rule->approver_ref_id !== null ? (int) $rule->approver_ref_id : null,
            'priority' => (int) $rule->priority,
            'escalate_after_days' => $rule->escalate_after_days !== null ? (int) $rule->escalate_after_days : null,
            'escalate_to_user_id' => $rule->escalate_to_user_id,
            'escalate_to' => $rule->escalateTo?->only(['id', 'name']),
            'is_active' => (bool) $rule->is_active,
            'created_at' => $rule->created_at?->toIso8601String(),
        ];
    }

    public function serializeDelegation(ApprovalDelegation $row): array
    {
        $row->loadMissing(['user:id,name', 'delegate:id,name']);

        return [
            'id' => $row->id,
            'user_id' => (int) $row->user_id,
            'user' => $row->user?->only(['id', 'name']),
            'delegate_user_id' => (int) $row->delegate_user_id,
            'delegate' => $row->delegate?->only(['id', 'name']),
            'starts_at' => $row->starts_at?->toDateString(),
            'ends_at' => $row->ends_at?->toDateString(),
            'note' => $row->note,
            'is_active' => (bool) $row->is_active,
            'created_at' => $row->created_at?->toIso8601String(),
        ];
    }
}
