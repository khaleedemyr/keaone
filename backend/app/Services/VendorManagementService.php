<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\GoodsReceipt;
use App\Models\PurchaseOrder;
use App\Models\SupplierDocument;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VendorManagementService
{
    public const TIERS = ['strategic', 'preferred', 'one_time'];

    public const ONBOARDING = ['draft', 'pending', 'approved', 'rejected'];

    public const STATUSES = ['active', 'suspended', 'blacklisted'];

    public function assertCanPurchase(Contact $supplier): void
    {
        if (! in_array($supplier->type, ['supplier', 'both'], true)) {
            throw ValidationException::withMessages(['supplier_id' => ['Supplier tidak valid.']]);
        }

        if ($supplier->onboarding_status !== 'approved') {
            throw ValidationException::withMessages([
                'supplier_id' => ['Supplier belum disetujui (onboarding).'],
            ]);
        }

        if ($supplier->vendor_status === 'suspended') {
            throw ValidationException::withMessages([
                'supplier_id' => ['Supplier sedang disuspend — tidak bisa dipakai di PO baru.'],
            ]);
        }

        if ($supplier->vendor_status === 'blacklisted') {
            throw ValidationException::withMessages([
                'supplier_id' => ['Supplier masuk blacklist — tidak bisa dipakai di PO baru.'],
            ]);
        }

        if (! $supplier->is_active) {
            throw ValidationException::withMessages(['supplier_id' => ['Supplier tidak aktif.']]);
        }
    }

    public function serializeVendor(Contact $contact): array
    {
        $docs = SupplierDocument::query()
            ->where('contact_id', $contact->id)
            ->orderBy('doc_type')
            ->get();

        $evaluation = app(VendorEvaluationService::class)->forSupplier($contact);

        return array_merge($contact->only([
            'id', 'type', 'name', 'phone', 'email', 'address', 'city', 'province', 'postal_code',
            'npwp', 'bank_name', 'bank_account', 'bank_account_name', 'payment_term', 'payment_days',
            'is_taxable', 'tax_percent', 'withholding_tax_enabled', 'withholding_tax_type',
            'withholding_tax_rate', 'withholding_tax_base', 'custom_fields', 'is_active',
        ]), [
            'vendor_tier' => $contact->vendor_tier,
            'onboarding_status' => $contact->onboarding_status ?? 'approved',
            'vendor_status' => $contact->vendor_status ?? 'active',
            'vendor_block_reason' => $contact->vendor_block_reason,
            'vendor_approved_at' => $contact->vendor_approved_at?->toIso8601String(),
            'has_portal_token' => filled($contact->portal_token),
            'documents' => $docs->map(fn (SupplierDocument $row) => $this->serializeDocument($row))->values(),
            'evaluation' => $evaluation,
            'compliance' => $this->complianceSummary($docs),
        ]);
    }

    public function serializeDocument(SupplierDocument $document): array
    {
        $expiresAt = $document->expires_at;
        $daysLeft = $expiresAt ? now()->startOfDay()->diffInDays($expiresAt, false) : null;

        return [
            'id' => $document->id,
            'doc_type' => $document->doc_type,
            'original_name' => $document->original_name,
            'expires_at' => $expiresAt?->toDateString(),
            'is_expired' => $expiresAt ? $expiresAt->isPast() : false,
            'days_until_expiry' => $daysLeft,
            'uploaded_at' => $document->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function complianceAlerts(int $companyId, int $withinDays = 30): array
    {
        $docs = SupplierDocument::query()
            ->where('company_id', $companyId)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now()->addDays($withinDays))
            ->with('contact:id,name')
            ->orderBy('expires_at')
            ->get();

        return $docs->map(function (SupplierDocument $doc) {
            return [
                'supplier_id' => $doc->contact_id,
                'supplier_name' => $doc->contact?->name,
                'doc_type' => $doc->doc_type,
                'expires_at' => $doc->expires_at?->toDateString(),
                'is_expired' => $doc->expires_at?->isPast() ?? false,
            ];
        })->values()->all();
    }

    public function ensurePortalToken(Contact $contact): string
    {
        if ($contact->portal_token) {
            return $contact->portal_token;
        }

        $token = Str::random(48);
        $contact->update(['portal_token' => $token]);

        return $token;
    }

    public function suspend(Contact $contact, ?string $reason = null): Contact
    {
        $contact->update([
            'vendor_status' => 'suspended',
            'vendor_block_reason' => $reason,
        ]);

        return $contact->fresh();
    }

    public function blacklist(Contact $contact, ?string $reason = null): Contact
    {
        $contact->update([
            'vendor_status' => 'blacklisted',
            'vendor_block_reason' => $reason,
            'is_active' => false,
        ]);

        return $contact->fresh();
    }

    public function reactivate(Contact $contact): Contact
    {
        $contact->update([
            'vendor_status' => 'active',
            'vendor_block_reason' => null,
            'is_active' => true,
        ]);

        return $contact->fresh();
    }

    public function approveOnboarding(Contact $contact): Contact
    {
        $contact->update([
            'onboarding_status' => 'approved',
            'vendor_approved_at' => now(),
            'vendor_status' => 'active',
        ]);

        return $contact->fresh();
    }

    public function submitOnboarding(Contact $contact): Contact
    {
        $contact->update(['onboarding_status' => 'pending']);

        return $contact->fresh();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, SupplierDocument>  $docs
     * @return array{expired: int, expiring_soon: int, complete: bool}
     */
    private function complianceSummary($docs): array
    {
        $expired = 0;
        $expiringSoon = 0;
        foreach ($docs as $doc) {
            if (! $doc->expires_at) {
                continue;
            }
            if ($doc->expires_at->isPast()) {
                $expired++;
            } elseif ($doc->expires_at->lte(now()->addDays(30))) {
                $expiringSoon++;
            }
        }

        $required = ['siup', 'npwp'];
        $uploaded = $docs->pluck('doc_type')->all();
        $complete = count(array_intersect($required, $uploaded)) === count($required);

        return [
            'expired' => $expired,
            'expiring_soon' => $expiringSoon,
            'complete' => $complete,
        ];
    }
}
