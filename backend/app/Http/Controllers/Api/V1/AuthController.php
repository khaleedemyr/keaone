<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ProvisionCompany;
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
}
