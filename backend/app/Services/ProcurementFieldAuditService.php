<?php

namespace App\Services;

use App\Models\ProcurementFieldAudit;
use App\Models\User;

class ProcurementFieldAuditService
{
    public function __construct(private ApprovalGovernanceService $governance) {}

    public function log(
        int $companyId,
        string $documentType,
        int $documentId,
        string $field,
        mixed $oldValue,
        mixed $newValue,
        ?int $itemId = null,
        string $context = 'approval',
        ?User $user = null,
    ): void {
        if (! $this->governance->fieldAuditEnabled()) {
            return;
        }

        $old = $this->stringify($oldValue);
        $new = $this->stringify($newValue);
        if ($old === $new) {
            return;
        }

        ProcurementFieldAudit::query()->create([
            'company_id' => $companyId,
            'document_type' => $documentType,
            'document_id' => $documentId,
            'item_id' => $itemId,
            'field' => $field,
            'old_value' => $old,
            'new_value' => $new,
            'change_context' => $context,
            'changed_by' => $user?->id ?? auth()->id(),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listForDocument(int $companyId, string $documentType, int $documentId): array
    {
        return ProcurementFieldAudit::query()
            ->where('company_id', $companyId)
            ->where('document_type', $documentType)
            ->where('document_id', $documentId)
            ->with('changer:id,name')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (ProcurementFieldAudit $row) => [
                'id' => $row->id,
                'document_type' => $row->document_type,
                'document_id' => $row->document_id,
                'item_id' => $row->item_id,
                'field' => $row->field,
                'old_value' => $row->old_value,
                'new_value' => $row->new_value,
                'change_context' => $row->change_context,
                'changed_by' => $row->changed_by,
                'changer' => $row->changer?->only(['id', 'name']),
                'created_at' => $row->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    private function stringify(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        return (string) $value;
    }
}
