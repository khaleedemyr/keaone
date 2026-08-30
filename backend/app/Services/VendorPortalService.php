<?php

namespace App\Services;

use App\Models\CompanyUser;
use App\Models\Contact;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Models\VendorInvoice;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VendorPortalService
{
    public function __construct(
        private VendorInvoiceService $invoices,
        private ProcurementAttachmentService $attachments,
    ) {}

    /**
     * @return array{id: int, number: string, vendor_ref: ?string, status: string}|null
     */
    public function invoiceStateForPo(PurchaseOrder $po, int $supplierId): ?array
    {
        $invoice = VendorInvoice::query()
            ->withoutGlobalScopes()
            ->where('company_id', $po->company_id)
            ->where('purchase_order_id', $po->id)
            ->where('supplier_id', $supplierId)
            ->whereNotIn('status', ['cancelled'])
            ->orderByDesc('id')
            ->first();

        if (! $invoice) {
            return null;
        }

        return [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'vendor_ref' => $invoice->vendor_ref,
            'status' => $invoice->status,
        ];
    }

    /**
     * @param  array{client_uuid: string, vendor_ref: string, invoice_date: string, due_date?: ?string, note?: ?string}  $payload
     * @return array{id: int, number: string, vendor_ref: ?string, status: string}
     */
    public function storeInvoice(Contact $supplier, PurchaseOrder $po, array $payload, UploadedFile $file): array
    {
        return $this->runInCompanyContext((int) $supplier->company_id, function () use ($supplier, $po, $payload, $file) {
            $companyId = (int) $supplier->company_id;

            if (! ProcurementSettings::vendorInvoiceEnabled()) {
                throw ValidationException::withMessages([
                    'invoice' => ['Modul vendor invoice belum aktif di perusahaan ini.'],
                ]);
            }

            if (! in_array($po->status, ['ordered', 'partial', 'received'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['PO belum bisa ditagihkan dari portal.'],
                ]);
            }

            $exists = VendorInvoice::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('purchase_order_id', $po->id)
                ->where('supplier_id', $supplier->id)
                ->whereNotIn('status', ['cancelled', 'rejected'])
                ->exists();

            if ($exists) {
                throw ValidationException::withMessages([
                    'invoice' => ['Invoice untuk PO ini sudah pernah diajukan.'],
                ]);
            }

            $actor = $this->resolvePortalActor($companyId);
            $items = $po->items()
                ->get()
                ->map(fn ($row) => [
                    'product_id' => $row->product_id,
                    'purchase_order_item_id' => $row->id,
                    'qty' => $row->qty,
                    'unit_cost' => $row->unit_cost,
                    'discount' => $row->discount,
                    'unit_level' => $row->unit_level,
                    'unit' => $row->unit,
                ])
                ->values()
                ->all();

            $note = trim((string) ($payload['note'] ?? ''));
            $note = $note !== '' ? '[Portal] '.$note : '[Portal] Upload invoice supplier';

            $invoice = DB::transaction(function () use ($payload, $supplier, $po, $actor, $items, $note, $file, $companyId) {
                $invoice = $this->invoices->createFromPortal([
                    'client_uuid' => $payload['client_uuid'],
                    'supplier_id' => $supplier->id,
                    'purchase_order_id' => $po->id,
                    'vendor_ref' => $payload['vendor_ref'],
                    'invoice_date' => $payload['invoice_date'],
                    'due_date' => $payload['due_date'] ?? null,
                    'note' => $note,
                    'items' => $items,
                ], $actor);

                $this->attachments->storeVendorInvoicePortal($companyId, $invoice->id, $file);

                return $invoice;
            });

            return [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'vendor_ref' => $invoice->vendor_ref,
                'status' => $invoice->status,
            ];
        });
    }

    private function runInCompanyContext(int $companyId, callable $callback): mixed
    {
        request()->headers->set('X-Company-Id', (string) $companyId);
        CurrentCompany::flush();

        return $callback();
    }

    private function resolvePortalActor(int $companyId): User
    {
        $userId = CompanyUser::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->orderByRaw("CASE WHEN role = 'owner' THEN 0 WHEN role = 'admin' THEN 1 ELSE 2 END")
            ->orderBy('id')
            ->value('user_id');

        $user = $userId ? User::query()->find($userId) : null;
        abort_unless($user, 422, 'Perusahaan belum punya pengguna aktif untuk menerima invoice portal.');

        return $user;
    }
}
