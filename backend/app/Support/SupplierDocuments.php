<?php

namespace App\Support;

use App\Models\Contact;
use App\Models\SupplierDocument;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class SupplierDocuments
{
    /** @var list<string> */
    public const TYPES = SupplierDocument::TYPES;

    public static function requestKey(string $type): string
    {
        abort_unless(in_array($type, self::TYPES, true), 422, 'Jenis dokumen tidak valid.');

        return 'document';
    }

    /**
     * @return array<string, mixed>
     */
    public static function uploadRules(): array
    {
        return [
            'document' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            'expires_at' => ['nullable', 'date'],
        ];
    }

    public function store(Contact $contact, UploadedFile $file, string $type, ?string $expiresAt, ?int $userId): SupplierDocument
    {
        abort_unless(in_array($type, self::TYPES, true), 422, 'Jenis dokumen tidak valid.');
        abort_unless($file->isValid(), 422, 'Unggahan dokumen gagal.');

        $existing = SupplierDocument::query()
            ->where('contact_id', $contact->id)
            ->where('doc_type', $type)
            ->first();
        if ($existing) {
            $this->deleteFile($existing->file_path);
            $existing->delete();
        }

        $dir = storage_path('app/private/supplier-docs/'.$contact->id);
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder dokumen.');
        }

        $ext = $this->resolveExtension($file);
        abort_unless($ext, 422, 'Format file tidak didukung.');

        $name = $type.'_'.Str::uuid().'.'.$ext;
        $file->move($dir, $name);
        $relative = 'supplier-docs/'.$contact->id.'/'.$name;
        abort_unless(is_file(storage_path('app/private/'.$relative)), 422, 'Tidak bisa menyimpan dokumen.');

        return SupplierDocument::query()->create([
            'company_id' => $contact->company_id,
            'contact_id' => $contact->id,
            'doc_type' => $type,
            'file_path' => $relative,
            'original_name' => $file->getClientOriginalName(),
            'expires_at' => $expiresAt ?: null,
            'uploaded_by' => $userId,
        ]);
    }

    public function absolutePath(SupplierDocument $document): ?string
    {
        $path = storage_path('app/private/'.$document->file_path);

        return is_file($path) ? $path : null;
    }

    public function mimeType(?string $path): string
    {
        if (! $path) {
            return 'application/octet-stream';
        }

        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'pdf' => 'application/pdf',
            default => 'application/octet-stream',
        };
    }

    public function deleteDocument(SupplierDocument $document): void
    {
        $this->deleteFile($document->file_path);
        $document->delete();
    }

    private function deleteFile(string $relative): void
    {
        $path = storage_path('app/private/'.$relative);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function resolveExtension(UploadedFile $file): ?string
    {
        return match ($file->getMimeType()) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
            default => null,
        };
    }
}
