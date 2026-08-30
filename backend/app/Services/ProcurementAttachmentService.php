<?php

namespace App\Services;

use App\Models\GoodsReceipt;
use App\Models\ProcurementAttachment;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\User;
use App\Models\VendorInvoice;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProcurementAttachmentService
{
    private const MAX_BYTES = 10 * 1024 * 1024;

    public function enabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_attachments_enabled', $company);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function list(string $documentType, int $documentId): array
    {
        $this->assertEnabled();
        $this->resolveDocument($documentType, $documentId);

        return ProcurementAttachment::query()
            ->with('uploader:id,name')
            ->where('document_type', $documentType)
            ->where('document_id', $documentId)
            ->orderByDesc('id')
            ->get()
            ->map(fn (ProcurementAttachment $row) => $this->serialize($row))
            ->values()
            ->all();
    }

    public function store(string $documentType, int $documentId, UploadedFile $file, User $user, array $payload = []): ProcurementAttachment
    {
        $this->assertEnabled();
        $this->resolveDocument($documentType, $documentId);

        abort_unless($file->isValid(), 422, 'Unggahan file gagal.');

        $size = (int) $file->getSize();
        if ($size < 1 || $size > self::MAX_BYTES) {
            throw ValidationException::withMessages([
                'file' => ['Ukuran file maksimal 10 MB.'],
            ]);
        }

        $ext = $this->resolveExtension($file);
        if (! $ext) {
            throw ValidationException::withMessages([
                'file' => ['Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.'],
            ]);
        }

        $category = (string) ($payload['category'] ?? 'other');
        if (! in_array($category, ProcurementAttachment::CATEGORIES, true)) {
            $category = 'other';
        }

        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');
        $companyId = (int) $company->id;
        $dir = storage_path('app/private/procurement-attachments/'.$companyId);
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder lampiran.');
        }

        $storedName = Str::uuid().'.'.$ext;
        $file->move($dir, $storedName);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$storedName), 422, 'Tidak bisa menyimpan file.');

        $row = ProcurementAttachment::query()->create([
            'company_id' => $companyId,
            'document_type' => $documentType,
            'document_id' => $documentId,
            'category' => $category,
            'original_name' => $this->sanitizeOriginalName($file->getClientOriginalName()),
            'stored_path' => 'procurement-attachments/'.$companyId.'/'.$storedName,
            'mime_type' => $this->mimeFromExtension($ext),
            'size_bytes' => $size,
            'note' => isset($payload['note']) ? (string) $payload['note'] : null,
            'uploaded_by' => $user->id,
        ]);

        return $row->fresh(['uploader:id,name']);
    }

    public function storeVendorInvoicePortal(int $companyId, int $vendorInvoiceId, UploadedFile $file): ProcurementAttachment
    {
        abort_unless(
            VendorInvoice::query()->withoutGlobalScopes()->where('company_id', $companyId)->whereKey($vendorInvoiceId)->exists(),
            404,
        );

        abort_unless($file->isValid(), 422, 'Unggahan file gagal.');

        $size = (int) $file->getSize();
        if ($size < 1 || $size > self::MAX_BYTES) {
            throw ValidationException::withMessages([
                'file' => ['Ukuran file maksimal 10 MB.'],
            ]);
        }

        $ext = $this->resolveExtension($file);
        if (! $ext) {
            throw ValidationException::withMessages([
                'file' => ['Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.'],
            ]);
        }

        $dir = storage_path('app/private/procurement-attachments/'.$companyId);
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder lampiran.');
        }

        $storedName = Str::uuid().'.'.$ext;
        $file->move($dir, $storedName);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$storedName), 422, 'Tidak bisa menyimpan file.');

        return ProcurementAttachment::query()->create([
            'company_id' => $companyId,
            'document_type' => 'vendor_invoice',
            'document_id' => $vendorInvoiceId,
            'category' => 'invoice',
            'original_name' => $this->sanitizeOriginalName($file->getClientOriginalName()),
            'stored_path' => 'procurement-attachments/'.$companyId.'/'.$storedName,
            'mime_type' => $this->mimeFromExtension($ext),
            'size_bytes' => $size,
            'note' => null,
            'uploaded_by' => null,
        ]);
    }

    public function path(ProcurementAttachment $attachment): ?string
    {
        if (! is_string($attachment->stored_path) || $attachment->stored_path === '') {
            return null;
        }

        $path = storage_path('app/private/'.$attachment->stored_path);

        return is_file($path) ? $path : null;
    }

    public function delete(ProcurementAttachment $attachment): void
    {
        $this->assertEnabled();

        $path = $this->path($attachment);
        if ($path) {
            @unlink($path);
        }

        $attachment->delete();
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(ProcurementAttachment $row): array
    {
        $row->loadMissing('uploader:id,name');

        return [
            'id' => $row->id,
            'document_type' => $row->document_type,
            'document_id' => $row->document_id,
            'category' => $row->category,
            'original_name' => $row->original_name,
            'mime_type' => $row->mime_type,
            'size_bytes' => $row->size_bytes,
            'note' => $row->note,
            'uploaded_by' => $row->uploaded_by,
            'uploader' => $row->uploader?->only(['id', 'name']),
            'created_at' => $row->created_at?->toIso8601String(),
        ];
    }

    public function menuForDocumentType(string $documentType): string
    {
        return match ($documentType) {
            'purchase_requisition' => 'purchaserequisitions',
            'purchase_order' => 'purchaseorders',
            'goods_receipt' => 'goodsreceipts',
            'vendor_invoice' => 'vendorinvoices',
            default => abort(422, 'Jenis dokumen tidak valid.'),
        };
    }

    public function resolveDocument(string $documentType, int $documentId): PurchaseRequisition|PurchaseOrder|GoodsReceipt|VendorInvoice
    {
        abort_unless(in_array($documentType, ProcurementAttachment::DOCUMENT_TYPES, true), 422, 'Jenis dokumen tidak valid.');

        return match ($documentType) {
            'purchase_requisition' => PurchaseRequisition::query()->findOrFail($documentId),
            'purchase_order' => PurchaseOrder::query()->findOrFail($documentId),
            'goods_receipt' => GoodsReceipt::query()->findOrFail($documentId),
            'vendor_invoice' => VendorInvoice::query()->findOrFail($documentId),
        };
    }

    private function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'attachment' => ['Lampiran procurement tidak aktif. Aktifkan di Pengaturan Pengadaan.'],
            ]);
        }
    }

    private function sanitizeOriginalName(string $name): string
    {
        $base = basename(str_replace('\\', '/', $name));
        $base = preg_replace('/[^\w.\-() ]+/u', '_', $base) ?? 'file';

        return Str::limit(trim($base) ?: 'file', 180, '');
    }

    private function resolveExtension(UploadedFile $file): ?string
    {
        $mime = $file->getMimeType();

        return match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
            default => null,
        };
    }

    private function mimeFromExtension(string $ext): string
    {
        return match ($ext) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'pdf' => 'application/pdf',
            default => 'application/octet-stream',
        };
    }
}
