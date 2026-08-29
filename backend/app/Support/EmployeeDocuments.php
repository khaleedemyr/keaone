<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class EmployeeDocuments
{
    public const TYPE_PHOTO = 'photo';

    public const TYPE_KTP = 'ktp';

    public const TYPE_KK = 'kk';

    /** @var list<string> */
    public const TYPES = [self::TYPE_PHOTO, self::TYPE_KTP, self::TYPE_KK];

    public static function column(string $type): string
    {
        return match ($type) {
            self::TYPE_PHOTO => 'employee_photo',
            self::TYPE_KTP => 'ktp_document',
            self::TYPE_KK => 'kk_document',
            default => abort(422, 'Jenis dokumen tidak valid.'),
        };
    }

    public static function requestKey(string $type): string
    {
        return match ($type) {
            self::TYPE_PHOTO => 'employee_photo',
            self::TYPE_KTP => 'ktp_document',
            self::TYPE_KK => 'kk_document',
            default => abort(422, 'Jenis dokumen tidak valid.'),
        };
    }

    /**
     * @return array<string, mixed>
     */
    public static function uploadRules(string $type, bool $required = false): array
    {
        $req = $required ? 'required' : 'nullable';

        return match ($type) {
            self::TYPE_PHOTO => [
                self::requestKey($type) => [$req, 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            ],
            self::TYPE_KTP, self::TYPE_KK => [
                self::requestKey($type) => [$req, 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            ],
            default => abort(422, 'Jenis dokumen tidak valid.'),
        };
    }

    /**
     * @return array<string, mixed>
     */
    public static function allUploadRules(bool $required = false): array
    {
        return array_merge(
            self::uploadRules(self::TYPE_PHOTO, $required),
            self::uploadRules(self::TYPE_KTP, $required),
            self::uploadRules(self::TYPE_KK, $required),
        );
    }

    public function store(User $user, UploadedFile $file, string $type): void
    {
        abort_unless(in_array($type, self::TYPES, true), 422, 'Jenis dokumen tidak valid.');
        abort_unless($file->isValid(), 422, 'Unggahan dokumen gagal.');

        $column = self::column($type);
        $this->deleteStored($user, $column);

        $dir = storage_path('app/private/employee-docs/'.$user->id);
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder dokumen.');
        }

        $ext = $this->resolveExtension($file, $type);
        abort_unless($ext, 422, 'Format file tidak didukung.');

        $name = $type.'_'.Str::uuid().'.'.$ext;
        $file->move($dir, $name);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$name), 422, 'Tidak bisa menyimpan dokumen.');

        $user->forceFill([$column => 'employee-docs/'.$user->id.'/'.$name])->save();
    }

    public function path(User $user, string $type): ?string
    {
        $column = self::column($type);
        $stored = $user->{$column};

        if (! is_string($stored) || $stored === '') {
            return null;
        }

        $path = storage_path('app/private/'.$stored);
        if (! is_file($path)) {
            return null;
        }

        return $path;
    }

    public function mimeType(?string $path): string
    {
        if (! $path) {
            return 'application/octet-stream';
        }

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return match ($ext) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'pdf' => 'application/pdf',
            default => 'application/octet-stream',
        };
    }

    /**
     * @return array{has_employee_photo: bool, has_ktp_document: bool, has_kk_document: bool}
     */
    public function flags(User $user): array
    {
        return [
            'has_employee_photo' => $this->path($user, self::TYPE_PHOTO) !== null,
            'has_ktp_document' => $this->path($user, self::TYPE_KTP) !== null,
            'has_kk_document' => $this->path($user, self::TYPE_KK) !== null,
        ];
    }

    private function deleteStored(User $user, string $column): void
    {
        $stored = $user->{$column};
        if (! is_string($stored) || $stored === '') {
            return;
        }

        $path = storage_path('app/private/'.$stored);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function resolveExtension(UploadedFile $file, string $type): ?string
    {
        if ($type === self::TYPE_PHOTO) {
            $info = @getimagesize($file->getRealPath() ?: $file->getPathname());
            abort_unless($info !== false, 422, 'File bukan gambar yang valid.');

            return match ($info[2] ?? 0) {
                IMAGETYPE_JPEG => 'jpg',
                IMAGETYPE_PNG => 'png',
                IMAGETYPE_WEBP => 'webp',
                default => null,
            };
        }

        $mime = $file->getMimeType();

        return match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
            default => null,
        };
    }
}
