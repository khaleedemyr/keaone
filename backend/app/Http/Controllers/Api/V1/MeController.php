<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\User;
use App\Services\ProvisionCompany;
use App\Support\LangCatalog;
use App\Support\MePayload;
use App\Support\PasswordRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return $this->ok(MePayload::make($request->user()));
    }

    public function companies(Request $request): JsonResponse
    {
        return $this->ok(MePayload::make($request->user())['memberships']);
    }

    public function switchCompany(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $companyId = $data['company_id'] ?? null;

        if ($companyId) {
            $member = $user->memberships()
                ->where('company_id', $companyId)
                ->where('is_active', true)
                ->exists();

            abort_unless($member || $user->is_platform, 403, 'Tidak punya akses ke perusahaan itu.');

            $company = Company::query()->find($companyId);
            abort_unless($company, 404, 'Perusahaan tidak ditemukan.');

            if ($company->status !== 'active' && ! $user->is_platform) {
                return $this->error('Perusahaan ini dinonaktifkan.', [], 403);
            }

            $user->forceFill(['last_company_id' => $company->id])->save();
            $request->headers->set('X-Company-Id', (string) $company->id);
        } else {
            abort_unless($user->is_platform, 422, 'Pilih perusahaan.');
            $user->forceFill(['last_company_id' => null])->save();
            $request->headers->remove('X-Company-Id');
        }

        return $this->ok(MePayload::make($user->fresh()));
    }

    public function storeCompany(Request $request, ProvisionCompany $provision): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'business_type' => ['nullable', Rule::exists('business_types', 'slug')->where('is_active', true)],
        ]);

        $company = $provision->create(
            $request->user(),
            $data['name'],
            $data['business_type'] ?? 'retail',
        );

        $request->headers->set('X-Company-Id', (string) $company->id);

        return $this->ok(MePayload::make($request->user()->fresh()), [], 201);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => PasswordRules::confirmed(),
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Password lama salah.'],
            ]);
        }

        $user->update(['password' => $data['password']]);

        $current = $user->currentAccessToken();
        $user->tokens()
            ->when($current instanceof PersonalAccessToken, fn ($query) => $query->where('id', '!=', $current->id))
            ->delete();

        return $this->ok(['ok' => true]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'username' => ['nullable', 'string', 'max:60', Rule::unique('users', 'username')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        if (array_key_exists('username', $data) && $data['username'] === '') {
            $data['username'] = null;
        }
        if (array_key_exists('phone', $data) && $data['phone'] === '') {
            $data['phone'] = null;
        }

        $user->update($data);

        return $this->ok(MePayload::make($user->fresh()));
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'theme' => ['sometimes', Rule::in(['dark', 'light'])],
            'lang' => ['sometimes', Rule::in(LangCatalog::ALL)],
            'uiSkin' => ['sometimes', Rule::in(['auto', 'desktop', 'erp'])],
            'wallpaper' => ['sometimes', 'array'],
            'wallpaper.kind' => ['required_with:wallpaper', Rule::in(['preset', 'image'])],
            'wallpaper.id' => ['required_with:wallpaper', 'string', 'max:40'],
            'wallpaper.src' => ['nullable', 'string', 'max:500'],
            'desktop' => ['sometimes', 'array'],
            'desktop.showIcons' => ['sometimes', 'boolean'],
            'desktop.hiddenApps' => ['sometimes', 'array', 'max:32'],
            'desktop.hiddenApps.*' => ['string', 'max:32'],
            'desktop.iconPositions' => ['sometimes', 'array', 'max:32'],
            'desktop.iconPositions.*' => ['array'],
            'desktop.iconPositions.*.x' => ['required', 'numeric', 'min:0', 'max:10000'],
            'desktop.iconPositions.*.y' => ['required', 'numeric', 'min:0', 'max:10000'],
            'desktop.widgets' => ['sometimes', 'array'],
            'desktop.widgets.hidden' => ['sometimes', 'array', 'max:16'],
            'desktop.widgets.hidden.*' => ['string', 'max:32'],
            'desktop.widgets.positions' => ['sometimes', 'array', 'max:48'],
            'desktop.widgets.positions.*' => ['array'],
            'desktop.widgets.positions.*.x' => ['required', 'numeric', 'min:0', 'max:10000'],
            'desktop.widgets.positions.*.y' => ['required', 'numeric', 'min:0', 'max:10000'],
            'desktop.widgets.clockSkin' => ['sometimes', Rule::in(['classic', 'minimal', 'neon', 'flip', 'analog', 'watch', 'wall', 'chrome'])],
            'desktop.widgets.stickyNotes' => ['sometimes', 'array', 'max:12'],
            'desktop.widgets.stickyNotes.*.id' => ['required', 'string', 'max:40'],
            'desktop.widgets.stickyNotes.*.text' => ['nullable', 'string', 'max:2000'],
            'desktop.widgets.stickyNotes.*.color' => ['sometimes', Rule::in(['mint', 'gold', 'rose', 'sky'])],
            'desktop.widgets.notesText' => ['sometimes', 'string', 'max:2000'],
            'desktop.widgets.notesColor' => ['sometimes', Rule::in(['mint', 'gold', 'rose', 'sky'])],
            'desktop.widgets.weatherCity' => ['sometimes', 'string', 'max:80'],
        ]);

        $current = $user->publicPreferences() ?? User::defaultPreferences();

        if (isset($data['theme'])) {
            $current['theme'] = $data['theme'];
        }
        if (isset($data['lang'])) {
            $current['lang'] = $data['lang'];
        }
        if (isset($data['uiSkin'])) {
            $current['uiSkin'] = $data['uiSkin'];
        }
        if (isset($data['wallpaper'])) {
            $kind = $data['wallpaper']['kind'];
            $wallpaper = [
                'kind' => $kind,
                'id' => $data['wallpaper']['id'],
            ];
            if ($kind === 'image' && ! empty($data['wallpaper']['src']) && ! str_starts_with((string) $data['wallpaper']['src'], 'data:')) {
                $wallpaper['src'] = $data['wallpaper']['src'];
            }
            $current['wallpaper'] = $wallpaper;
        }
        if (isset($data['desktop'])) {
            $desktop = is_array($current['desktop'] ?? null) ? $current['desktop'] : User::defaultPreferences()['desktop'];
            if (array_key_exists('showIcons', $data['desktop'])) {
                $desktop['showIcons'] = (bool) $data['desktop']['showIcons'];
            }
            if (isset($data['desktop']['hiddenApps'])) {
                $desktop['hiddenApps'] = array_values(array_unique($data['desktop']['hiddenApps']));
            }
            if (isset($data['desktop']['iconPositions'])) {
                $desktop['iconPositions'] = $data['desktop']['iconPositions'];
            }
            if (isset($data['desktop']['widgets']) && is_array($data['desktop']['widgets'])) {
                $currentWidgets = is_array($desktop['widgets'] ?? null) ? $desktop['widgets'] : [];
                $desktop['widgets'] = array_merge($currentWidgets, $data['desktop']['widgets']);
            }
            $current['desktop'] = $desktop;
        }

        $user->forceFill(['preferences' => $current])->save();

        return $this->ok($user->publicPreferences());
    }

    public function storeWallpaper(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'image', 'max:20480'],
        ]);

        $uploaded = $request->file('file');
        abort_unless($uploaded && $uploaded->isValid(), 422, 'Unggahan wallpaper gagal.');

        $info = @getimagesize($uploaded->getRealPath() ?: $uploaded->getPathname());
        abort_unless($info !== false, 422, 'File bukan gambar yang valid.');

        $ext = match ($info[2] ?? 0) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            IMAGETYPE_GIF => 'gif',
            default => null,
        };
        abort_unless($ext, 422, 'Format gambar tidak didukung. Pakai JPG, PNG, atau WebP.');

        $user = $request->user();
        $dir = storage_path('app/public/wallpapers');
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder wallpaper.');
        }

        foreach (glob($dir.DIRECTORY_SEPARATOR.$user->id.'_*') ?: [] as $old) {
            @unlink($old);
        }

        $name = $user->id.'_'.\Illuminate\Support\Str::uuid().'.'.$ext;
        $uploaded->move($dir, $name);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$name), 422, 'Tidak bisa menyimpan wallpaper.');

        $src = '/media/wallpapers/'.$name;
        $current = $user->publicPreferences() ?? User::defaultPreferences();
        $current['wallpaper'] = [
            'kind' => 'image',
            'id' => 'custom',
            'src' => $src,
        ];
        $user->forceFill(['preferences' => $current])->save();

        return $this->ok(['wallpaper' => $current['wallpaper']]);
    }

    public function storeAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'image', 'max:4096'],
        ]);

        $uploaded = $request->file('file');
        abort_unless($uploaded && $uploaded->isValid(), 422, 'Unggahan foto gagal.');

        $info = @getimagesize($uploaded->getRealPath() ?: $uploaded->getPathname());
        abort_unless($info !== false, 422, 'File bukan gambar yang valid.');

        $ext = match ($info[2] ?? 0) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        };
        abort_unless($ext, 422, 'Format gambar tidak didukung. Pakai JPG, PNG, atau WebP.');

        $user = $request->user();
        $dir = storage_path('app/public/avatars');
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder avatar.');
        }

        foreach (glob($dir.DIRECTORY_SEPARATOR.$user->id.'_*') ?: [] as $old) {
            @unlink($old);
        }

        $name = $user->id.'_'.\Illuminate\Support\Str::uuid().'.'.$ext;
        $uploaded->move($dir, $name);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$name), 422, 'Tidak bisa menyimpan foto.');

        $user->forceFill(['avatar' => 'avatars/'.$name])->save();

        return $this->ok(MePayload::make($user->fresh()));
    }
}
