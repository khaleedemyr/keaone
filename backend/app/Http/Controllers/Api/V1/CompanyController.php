<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Support\CurrentCompany;
use App\Support\ReceiptLayout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CompanyController extends Controller
{
    public function show(): JsonResponse
    {
        $this->ensureCan('company', 'view');

        $company = CurrentCompany::company();

        return $this->ok($this->serialize($company));
    }

    public function update(Request $request): JsonResponse
    {
        $this->ensureCan('company', 'edit');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'business_type' => ['sometimes', Rule::exists('business_types', 'slug')->where('is_active', true)],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string'],
        ]);

        $company = CurrentCompany::company();
        $company->update($data);

        return $this->ok($this->serialize($company->fresh()));
    }

    public function settings(): JsonResponse
    {
        $company = CurrentCompany::company();

        return $this->ok([
            'modules' => $company->resolvedModules(),
            'settings' => $this->withLayout($company->mergedSettings()),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'modules' => ['sometimes', 'array'],
            'settings' => ['sometimes', 'array'],
            'settings.tax_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'settings.allow_credit' => ['sometimes', 'boolean'],
            'settings.receipt_width' => ['sometimes', 'integer'],
            'settings.receipt_footer' => ['nullable', 'string'],
            'settings.receipt_layout' => ['sometimes', 'array'],
            'settings.pos_mode' => ['sometimes', Rule::in(['retail', 'restaurant', 'cafe'])],
        ]);

        $settingsInput = $data['settings'] ?? [];
        $posKeys = ['pos_mode'];
        $incoming = array_keys($settingsInput);
        $hasPos = array_intersect($incoming, $posKeys) !== [];
        $hasOps = array_diff($incoming, $posKeys) !== [];

        if (isset($data['modules'])) {
            $this->ensureCan('modules', 'edit');
        }
        if ($hasPos) {
            $this->ensureCan('possettings', 'edit');
        }
        if ($hasOps) {
            $this->ensureCan('ops', 'edit');
        }
        if (! isset($data['modules']) && ! $hasPos && ! $hasOps) {
            $this->ensureCan('ops', 'edit');
        }

        $company = CurrentCompany::company();

        if (isset($data['modules'])) {
            $plan = $company->subscription?->plan;
            $next = \App\Support\ModuleCatalog::resolve(array_merge($company->modules ?? [], $data['modules']));
            if ($plan) {
                foreach ($next as $key => $on) {
                    if ($on && ! $plan->allows((string) $key)) {
                        $next[$key] = false;
                    }
                }
            }
            $company->modules = $next;
        }

        if (isset($data['settings'])) {
            $merged = array_merge($company->defaultSettings(), $company->settings ?? [], $data['settings']);
            if (isset($data['settings']['receipt_layout'])) {
                $merged['receipt_layout'] = ReceiptLayout::normalize($data['settings']['receipt_layout'], $merged);
                $merged['receipt_width'] = $merged['receipt_layout']['width'];
                $footer = collect($merged['receipt_layout']['blocks'])->firstWhere('kind', 'footer');
                if (is_array($footer) && array_key_exists('text', $footer) && $footer['text'] !== null) {
                    $merged['receipt_footer'] = (string) $footer['text'];
                }
            }
            $company->settings = $merged;
        }

        $company->save();

        return $this->ok([
            'modules' => $company->resolvedModules(),
            'settings' => $this->withLayout($company->mergedSettings()),
        ]);
    }

    public function storeLogo(Request $request): JsonResponse
    {
        $this->ensureCanAny([['company', 'edit'], ['ops', 'edit']]);

        $request->validate([
            'file' => ['required', 'file', 'image', 'max:4096'],
        ]);

        $uploaded = $request->file('file');
        abort_unless($uploaded && $uploaded->isValid(), 422, 'Unggahan logo gagal.');

        $info = @getimagesize($uploaded->getRealPath() ?: $uploaded->getPathname());
        abort_unless($info !== false, 422, 'File bukan gambar yang valid.');

        $ext = match ($info[2] ?? 0) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        };
        abort_unless($ext, 422, 'Format gambar tidak didukung. Pakai JPG, PNG, atau WebP.');

        $company = CurrentCompany::company();
        abort_unless($company, 404, 'Perusahaan tidak ditemukan.');

        $dir = storage_path('app/public/logos');
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder logo.');
        }

        foreach (glob($dir.DIRECTORY_SEPARATOR.$company->id.'_*') ?: [] as $old) {
            @unlink($old);
        }

        $name = $company->id.'_'.\Illuminate\Support\Str::uuid().'.'.$ext;
        $uploaded->move($dir, $name);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$name), 422, 'Tidak bisa menyimpan logo.');

        $company->forceFill(['logo_path' => 'logos/'.$name])->save();

        return $this->ok($this->serialize($company->fresh()));
    }

    public function destroyLogo(): JsonResponse
    {
        $this->ensureCanAny([['company', 'edit'], ['ops', 'edit']]);

        $company = CurrentCompany::company();
        abort_unless($company, 404, 'Perusahaan tidak ditemukan.');

        if (is_string($company->logo_path) && $company->logo_path !== '') {
            $file = basename($company->logo_path);
            if (preg_match('/^[A-Za-z0-9._-]+$/', $file) === 1) {
                $path = storage_path('app/public/logos/'.$file);
                if (is_file($path)) {
                    @unlink($path);
                }
            }
        }

        $company->forceFill(['logo_path' => null])->save();

        return $this->ok($this->serialize($company->fresh()));
    }

    private function serialize(Company $company): array
    {
        $company->loadMissing('businessType');

        return [
            'id' => $company->id,
            'name' => $company->name,
            'business_type' => $company->business_type,
            'business_type_name' => $company->businessType?->name,
            'phone' => $company->phone,
            'address' => $company->address,
            'logo' => $company->logoUrl(),
            'status' => $company->status,
            'modules' => $company->resolvedModules(),
            'settings' => $this->withLayout($company->mergedSettings()),
        ];
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private function withLayout(array $settings): array
    {
        $settings['receipt_layout'] = ReceiptLayout::normalize($settings['receipt_layout'] ?? null, $settings);

        return $settings;
    }
}
