<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Contact;
use App\Models\PurchaseOrder;
use App\Models\SupplierDocument;
use App\Services\VendorManagementService;
use App\Support\CurrentCompany;
use App\Support\SupplierDocuments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SupplierController extends TypedContactController
{
    public function __construct(private VendorManagementService $vendors) {}

    protected function menuKey(): string
    {
        return 'suppliers';
    }

    protected function contactType(): string
    {
        return 'supplier';
    }

    public function top(Request $request): JsonResponse
    {
        $this->ensureCanAny([
            [$this->menuKey(), 'view'],
            ['purchaseorders', 'view'],
            ['goodsreceipts', 'view'],
            ['purchaserequisitions', 'view'],
        ]);

        $limit = min(10, max(1, (int) $request->input('limit', 5)));
        $companyId = CurrentCompany::id();
        abort_unless($companyId, 422, 'Pilih perusahaan dulu.');

        $topIds = PurchaseOrder::query()
            ->where('company_id', $companyId)
            ->whereNotIn('status', ['cancelled', 'draft'])
            ->select('supplier_id', DB::raw('COUNT(*) as order_count'))
            ->groupBy('supplier_id')
            ->orderByDesc('order_count')
            ->limit($limit)
            ->pluck('supplier_id');

        if ($topIds->isEmpty()) {
            return $this->ok([]);
        }

        $type = $this->contactType();
        $contacts = Contact::query()
            ->whereIn('id', $topIds)
            ->where(function ($q) use ($type) {
                $q->where('type', $type)->orWhere('type', 'both');
            })
            ->where('is_active', true)
            ->where('vendor_status', 'active')
            ->get()
            ->keyBy('id');

        $items = $topIds
            ->map(fn ($id) => $contacts->get($id))
            ->filter()
            ->values();

        return $this->ok($items);
    }

    public function complianceAlerts(Request $request): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'view');
        $companyId = CurrentCompany::id();
        abort_unless($companyId, 422, 'Pilih perusahaan dulu.');

        $days = min(365, max(1, (int) $request->input('within_days', 30)));

        return $this->ok($this->vendors->complianceAlerts($companyId, $days));
    }

    public function show(Contact $contact): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'view');
        $this->assertSupplierType($contact);

        return $this->ok($this->vendors->serializeVendor($contact));
    }

    public function suspend(Request $request, Contact $contact): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'edit');
        $this->assertSupplierType($contact);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        return $this->ok($this->vendors->serializeVendor($this->vendors->suspend($contact, $data['reason'] ?? null)));
    }

    public function blacklist(Request $request, Contact $contact): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'edit');
        $this->assertSupplierType($contact);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        return $this->ok($this->vendors->serializeVendor($this->vendors->blacklist($contact, $data['reason'] ?? null)));
    }

    public function reactivate(Contact $contact): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'edit');
        $this->assertSupplierType($contact);

        return $this->ok($this->vendors->serializeVendor($this->vendors->reactivate($contact)));
    }

    public function approveOnboarding(Contact $contact): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'edit');
        $this->assertSupplierType($contact);

        return $this->ok($this->vendors->serializeVendor($this->vendors->approveOnboarding($contact)));
    }

    public function portalToken(Contact $contact): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'edit');
        $this->assertSupplierType($contact);
        $token = $this->vendors->ensurePortalToken($contact);

        return $this->ok(['portal_token' => $token]);
    }

    public function storeDocument(Request $request, Contact $contact, string $type): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'edit');
        $this->assertSupplierType($contact);
        abort_unless(in_array($type, SupplierDocuments::TYPES, true), 404);

        $data = $request->validate(SupplierDocuments::uploadRules());
        $doc = app(SupplierDocuments::class)->store(
            $contact,
            $request->file('document'),
            $type,
            $data['expires_at'] ?? null,
            auth()->id(),
        );

        return $this->ok($this->vendors->serializeDocument($doc), [], 201);
    }

    public function showDocument(Contact $contact, string $type)
    {
        $this->ensureCan($this->menuKey(), 'view');
        $this->assertSupplierType($contact);

        $document = SupplierDocument::query()
            ->where('contact_id', $contact->id)
            ->where('doc_type', $type)
            ->firstOrFail();

        $path = app(SupplierDocuments::class)->absolutePath($document);
        abort_unless($path, 404);

        return response()->file($path, [
            'Content-Type' => app(SupplierDocuments::class)->mimeType($path),
        ]);
    }

    public function destroyDocument(Contact $contact, string $type): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'edit');
        $this->assertSupplierType($contact);

        $document = SupplierDocument::query()
            ->where('contact_id', $contact->id)
            ->where('doc_type', $type)
            ->firstOrFail();

        app(SupplierDocuments::class)->deleteDocument($document);

        return $this->ok(['deleted' => true]);
    }

    protected function extraRules(bool $update = false): array
    {
        $sometimes = $update ? 'sometimes' : 'nullable';

        return [
            'vendor_tier' => [$sometimes, 'nullable', Rule::in(VendorManagementService::TIERS)],
            'onboarding_status' => [$sometimes, Rule::in(VendorManagementService::ONBOARDING)],
        ];
    }

    protected function afterValidate(array &$data, bool $update): void
    {
        if (array_key_exists('vendor_tier', $data) && ! $data['vendor_tier']) {
            $data['vendor_tier'] = null;
        }
        if (! $update && empty($data['onboarding_status'])) {
            $data['onboarding_status'] = 'approved';
            $data['vendor_status'] = 'active';
            $data['vendor_approved_at'] = now();
        }
    }

    private function assertSupplierType(Contact $contact): void
    {
        abort_unless(in_array($contact->type, ['supplier', 'both'], true), 404);
    }
}
