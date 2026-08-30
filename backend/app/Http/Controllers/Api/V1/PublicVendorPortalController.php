<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\PurchaseOrder;
use App\Services\PurchaseService;
use App\Services\VendorPortalService;
use App\Support\ProcurementSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PublicVendorPortalController extends Controller
{
    public function __construct(
        private PurchaseService $purchases,
        private VendorPortalService $portal,
    ) {}

    public function show(string $portalToken): JsonResponse
    {
        $supplier = $this->findSupplier($portalToken);
        $company = $supplier->company;

        return $this->ok([
            'supplier' => $supplier->only(['id', 'name', 'email', 'phone']),
            'company' => $company?->only(['id', 'name']),
            'vendor_invoice_enabled' => ProcurementSettings::vendorInvoiceEnabled($company),
        ]);
    }

    public function purchaseOrders(string $portalToken): JsonResponse
    {
        $supplier = $this->findSupplier($portalToken);
        $invoiceEnabled = ProcurementSettings::vendorInvoiceEnabled($supplier->company);

        $orders = PurchaseOrder::query()
            ->withoutGlobalScopes()
            ->where('company_id', $supplier->company_id)
            ->where('supplier_id', $supplier->id)
            ->whereIn('status', ['approved', 'ordered', 'partial', 'received'])
            ->with('items')
            ->orderByDesc('ordered_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return $this->ok($orders->map(function (PurchaseOrder $po) use ($supplier, $invoiceEnabled) {
            $portalInvoice = $this->portal->invoiceStateForPo($po, (int) $supplier->id);
            $canUploadInvoice = $invoiceEnabled
                && ! $portalInvoice
                && in_array($po->status, ['ordered', 'partial', 'received'], true);

            return [
                'id' => $po->id,
                'number' => $po->number,
                'status' => $po->status,
                'expected_at' => $po->expected_at?->toDateString(),
                'total' => (int) $po->total,
                'share_token' => $po->share_token,
                'vendor_confirmed_at' => $po->vendor_confirmed_at?->toIso8601String(),
                'portal_invoice' => $portalInvoice,
                'can_upload_invoice' => $canUploadInvoice,
            ];
        })->values());
    }

    public function confirmPurchaseOrder(string $portalToken, string $shareToken): JsonResponse
    {
        $supplier = $this->findSupplier($portalToken);

        $po = $this->findPo($supplier, $shareToken);

        if (! in_array($po->status, ['approved', 'ordered', 'partial'], true)) {
            throw ValidationException::withMessages(['status' => ['PO tidak bisa dikonfirmasi supplier.']]);
        }

        $po->update(['vendor_confirmed_at' => now()]);

        return $this->ok($this->purchases->serializePoPublic($po->fresh()));
    }

    public function storeInvoice(Request $request, string $portalToken, string $shareToken): JsonResponse
    {
        $supplier = $this->findSupplier($portalToken);
        $po = $this->findPo($supplier, $shareToken);

        $data = $request->validate([
            'client_uuid' => ['nullable', 'uuid'],
            'vendor_ref' => ['required', 'string', 'max:100'],
            'invoice_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:invoice_date'],
            'note' => ['nullable', 'string', 'max:500'],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
        ]);

        $data['client_uuid'] = $data['client_uuid'] ?? (string) Str::uuid();

        $invoice = $this->portal->storeInvoice(
            $supplier,
            $po->load('items'),
            $data,
            $request->file('file'),
        );

        return $this->ok($invoice, [], 201);
    }

    private function findSupplier(string $portalToken): Contact
    {
        $supplier = Contact::query()
            ->withoutGlobalScopes()
            ->where('portal_token', $portalToken)
            ->whereIn('type', ['supplier', 'both'])
            ->where('vendor_status', 'active')
            ->with('company')
            ->first();

        abort_unless($supplier, 404);

        return $supplier;
    }

    private function findPo(Contact $supplier, string $shareToken): PurchaseOrder
    {
        return PurchaseOrder::query()
            ->withoutGlobalScopes()
            ->where('share_token', $shareToken)
            ->where('supplier_id', $supplier->id)
            ->where('company_id', $supplier->company_id)
            ->firstOrFail();
    }
}
