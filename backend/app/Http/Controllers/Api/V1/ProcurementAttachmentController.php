<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ProcurementAttachment;
use App\Services\ProcurementAttachmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProcurementAttachmentController extends Controller
{
    public function __construct(private ProcurementAttachmentService $attachments) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');

        $data = $request->validate([
            'document_type' => ['required', 'in:purchase_requisition,purchase_order,goods_receipt'],
            'document_id' => ['required', 'integer', 'min:1'],
        ]);

        $menu = $this->attachments->menuForDocumentType($data['document_type']);
        $this->ensureCan($menu, 'view');

        return $this->ok($this->attachments->list($data['document_type'], (int) $data['document_id']));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureBilling();

        $data = $request->validate([
            'document_type' => ['required', 'in:purchase_requisition,purchase_order,goods_receipt'],
            'document_id' => ['required', 'integer', 'min:1'],
            'category' => ['nullable', 'in:quotation,photo,other'],
            'note' => ['nullable', 'string', 'max:255'],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        $menu = $this->attachments->menuForDocumentType($data['document_type']);
        $this->ensureCan($menu, 'edit');

        $file = $request->file('file');
        abort_unless($file instanceof \Illuminate\Http\UploadedFile, 422, 'File wajib diunggah.');

        $row = $this->attachments->store(
            $data['document_type'],
            (int) $data['document_id'],
            $file,
            $request->user(),
            $data,
        );

        return $this->ok($this->attachments->serialize($row), [], 201);
    }

    public function file(ProcurementAttachment $procurementAttachment): BinaryFileResponse
    {
        $this->ensureModule('purchase');

        $menu = $this->attachments->menuForDocumentType($procurementAttachment->document_type);
        $this->ensureCan($menu, 'view');

        $path = $this->attachments->path($procurementAttachment);
        abort_unless($path, 404);

        return response()->file($path, [
            'Content-Type' => $procurementAttachment->mime_type ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.addslashes($procurementAttachment->original_name).'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function destroy(ProcurementAttachment $procurementAttachment): JsonResponse
    {
        $this->ensureModule('purchase');

        $menu = $this->attachments->menuForDocumentType($procurementAttachment->document_type);
        $this->ensureCanAny([[$menu, 'edit'], [$menu, 'delete']]);

        $this->attachments->delete($procurementAttachment);

        return $this->ok(['deleted' => true]);
    }
}
