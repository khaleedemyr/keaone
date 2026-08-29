<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\CompanyInviteService;
use App\Services\ProvisionCompany;
use App\Support\EmployeeDocuments;
use App\Support\EmployeeProfile;
use App\Support\MePayload;
use App\Support\PasswordRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function register(Request $request, ProvisionCompany $provision): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'password' => PasswordRules::required(),
            'company_name' => ['required', 'string', 'max:150'],
            'business_type' => ['sometimes', Rule::exists('business_types', 'slug')->where('is_active', true)],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = DB::transaction(function () use ($data, $provision) {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
            ]);

            $provision->create($user, $data['company_name'], $data['business_type'] ?? 'retail');

            return $user->fresh();
        });

        $token = $user->issueToken($data['device_name'] ?? 'web', true);
        $payload = MePayload::make($user);

        ActivityLogger::record([
            'user_id' => $user->id,
            'company_id' => $payload['company']['id'] ?? null,
            'scope' => 'tenant',
            'action' => 'register',
            'menu_key' => 'auth',
            'summary' => 'Daftar akun baru',
            'target' => $user->email,
            'status' => 201,
        ], $request);

        return $this->ok([
            'token' => $token,
            'token_type' => 'Bearer',
            ...$payload,
        ], [], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $login = $data['email'];
        $user = User::query()
            ->where(function ($query) use ($login) {
                $query->where('email', $login)->orWhere('username', $login);
            })
            ->first();

        $hash = $user?->getRawOriginal('password');
        if (! is_string($hash) || $hash === '' || ! Hash::check($data['password'], $hash)) {
            ActivityLogger::record([
                'user_id' => $user?->id,
                'scope' => 'auth',
                'action' => 'failed_login',
                'menu_key' => 'auth',
                'summary' => 'Gagal masuk',
                'target' => $login,
                'status' => 422,
            ], $request);

            throw ValidationException::withMessages([
                'email' => ['Email atau password salah.'],
            ]);
        }

        if ($user->is_platform && ! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Akun tidak aktif.'],
            ]);
        }

        $token = $user->issueToken($data['device_name'] ?? 'web', $request->boolean('remember', true));

        $request->headers->remove('X-Company-Id');
        $payload = MePayload::make($user);

        if (($payload['company']['id'] ?? null) && $user->last_company_id !== $payload['company']['id']) {
            $user->forceFill(['last_company_id' => $payload['company']['id']])->save();
        }

        ActivityLogger::record([
            'user_id' => $user->id,
            'company_id' => $payload['company']['id'] ?? null,
            'scope' => $user->is_platform ? 'platform' : 'tenant',
            'action' => 'login',
            'menu_key' => 'auth',
            'summary' => 'Masuk ke konsol',
            'target' => $user->email,
            'status' => 200,
        ], $request);

        return $this->ok([
            'token' => $token,
            'token_type' => 'Bearer',
            ...$payload,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()?->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return $this->ok(['ok' => true]);
    }

    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return $this->ok(['ok' => true]);
    }

    public function acceptInvite(Request $request, CompanyInviteService $invites, EmployeeDocuments $documents): JsonResponse
    {
        $data = $request->validate(array_merge([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:150'],
            'password' => PasswordRules::optional(),
            'device_name' => ['nullable', 'string', 'max:100'],
        ], EmployeeProfile::rules(true), EmployeeDocuments::allUploadRules()));

        $invite = $invites->findByToken($data['token']);
        abort_unless($invite->isAcceptable(), 422, 'Undangan tidak valid atau sudah kedaluwarsa.');

        $user = $this->resolveInviteUser($request, $data, $invite);
        $profile = EmployeeProfile::validated($data);
        if (! empty($data['name'])) {
            $profile['name'] = $data['name'];
        }

        DB::transaction(function () use ($invites, $invite, $user, $profile) {
            $invites->accept($invite, $user, $profile);
        });

        foreach (EmployeeDocuments::TYPES as $type) {
            $key = EmployeeDocuments::requestKey($type);
            $file = $request->file($key);
            if ($file instanceof \Illuminate\Http\UploadedFile) {
                $documents->store($user->fresh(), $file, $type);
            }
        }

        ActivityLogger::record([
            'user_id' => $user->id,
            'company_id' => $invite->company_id,
            'scope' => 'tenant',
            'action' => 'accept_invite',
            'menu_key' => 'auth',
            'summary' => 'Mengirim biodata via undangan',
            'target' => $invite->company?->name,
            'status' => 200,
        ], $request);

        return $this->ok([
            'pending_hr' => true,
            'company_name' => $invite->company?->name,
            'message' => 'Biodata terkirim. Menunggu persetujuan HR.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveInviteUser(Request $request, array $data, \App\Models\CompanyInvite $invite): User
    {
        $bearer = $request->bearerToken();
        if (is_string($bearer) && $bearer !== '') {
            $accessToken = PersonalAccessToken::findToken($bearer);
            if ($accessToken?->tokenable instanceof User) {
                return $accessToken->tokenable;
            }
        }

        $email = strtolower(trim((string) ($data['email'] ?? $invite->email ?? '')));
        abort_unless($email !== '', 422, 'Email wajib diisi.');

        if ($invite->email && strtolower($invite->email) !== $email) {
            throw ValidationException::withMessages([
                'email' => ['Undangan ini khusus untuk email '.$invite->email.'.'],
            ]);
        }

        $existing = User::query()->where('email', $email)->first();
        if ($existing) {
            if (empty($data['password'])) {
                throw ValidationException::withMessages([
                    'password' => ['Password wajib untuk akun yang sudah terdaftar.'],
                ]);
            }

            $hash = $existing->getRawOriginal('password');
            if (! is_string($hash) || $hash === '' || ! Hash::check($data['password'], $hash)) {
                throw ValidationException::withMessages([
                    'password' => ['Password salah.'],
                ]);
            }

            return $existing;
        }

        if (empty($data['name'])) {
            throw ValidationException::withMessages([
                'name' => ['Nama wajib diisi.'],
            ]);
        }

        if (empty($data['password'])) {
            throw ValidationException::withMessages([
                'password' => ['Password wajib diisi.'],
            ]);
        }

        return User::query()->create([
            'name' => $data['name'],
            'email' => $email,
            'password' => $data['password'],
        ]);
    }
}
