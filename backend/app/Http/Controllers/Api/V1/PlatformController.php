<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BusinessType;
use App\Models\Company;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\BillingService;
use App\Services\RoleService;
use App\Support\Access;
use App\Support\PasswordRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformController extends Controller
{
    public function __construct(private BillingService $billing, private RoleService $roles) {}

    public function companies(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('tenants', 'view');

        $q = trim($request->string('search')->toString() ?: (string) $request->query('q', ''));
        $status = strtolower($request->string('status')->toString());

        $query = Company::query()
            ->with(['subscription.plan', 'businessType'])
            ->withCount(['users', 'outlets'])
            ->when($q !== '', fn ($inner) => $inner->where('name', 'like', '%'.$q.'%'))
            ->when(in_array($status, ['active', 'suspended'], true), fn ($inner) => $inner->where('status', $status))
            ->orderByDesc('id');

        if ($request->boolean('for_select')) {
            return $this->ok($query->limit(200)->get()->map(fn (Company $company) => $this->serializeCompany($company))->values());
        }

        $page = $query->paginate($this->perPage($request));
        $items = $page->getCollection()->map(function (Company $company) {
            if ($company->subscription) {
                $this->billing->refresh($company->subscription);
            }

            return $this->serializeCompany($company->fresh(['subscription.plan', 'businessType'])->loadCount(['users', 'outlets']));
        });

        return $this->ok($items->values(), $this->pageMeta($page));
    }

    public function overview(): JsonResponse
    {
        $this->ensurePlatformCan('overview', 'view');

        return $this->ok([
            'companies' => Company::query()->count(),
            'active' => Company::query()->where('status', 'active')->count(),
            'trialing' => Subscription::query()->where('status', 'trialing')->count(),
            'past_due' => Subscription::query()->where('status', 'past_due')->count(),
            'open_invoices' => Invoice::query()->where('status', 'issued')->count(),
            'open_amount' => (int) Invoice::query()->where('status', 'issued')->sum('amount'),
        ]);
    }

    public function updateCompany(Request $request, Company $company): JsonResponse
    {
        $this->ensurePlatformCan('tenants', 'edit');
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['active', 'suspended'])],
            'plan_id' => ['sometimes', 'integer', 'exists:plans,id'],
            'billing_cycle' => ['sometimes', Rule::in(['monthly', 'yearly'])],
            'activate_billing' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['status'])) {
            $company->update(['status' => $data['status']]);
        }

        if (isset($data['plan_id'])) {
            $plan = Plan::query()->findOrFail($data['plan_id']);
            $this->billing->assign(
                $company,
                $plan,
                $data['billing_cycle'] ?? $company->subscription?->billing_cycle ?? 'monthly',
                (bool) ($data['activate_billing'] ?? false),
            );
        } elseif (! empty($data['activate_billing']) && $company->subscription?->plan) {
            $this->billing->assign(
                $company,
                $company->subscription->plan,
                $data['billing_cycle'] ?? $company->subscription->billing_cycle,
                true,
            );
        }

        return $this->ok($this->serializeCompany($company->fresh(['subscription.plan', 'businessType'])->loadCount(['users', 'outlets'])));
    }

    public function plans(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('billing', 'view');

        $query = Plan::query()->orderBy('sort_order')->orderBy('id');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request, fn (Plan $plan) => $this->billing->serializePlan($plan));
    }

    public function storePlan(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('billing', 'create');
        $data = $this->planRules($request);
        if (! empty($data['is_default'])) {
            Plan::query()->update(['is_default' => false]);
        }
        $plan = Plan::query()->create($data);

        return $this->ok($this->billing->serializePlan($plan), [], 201);
    }

    public function updatePlan(Request $request, Plan $plan): JsonResponse
    {
        $this->ensurePlatformCan('billing', 'edit');
        $data = $this->planRules($request, $plan->id);
        if (! empty($data['is_default'])) {
            Plan::query()->whereKeyNot($plan->id)->update(['is_default' => false]);
        }
        $plan->update($data);

        return $this->ok($this->billing->serializePlan($plan->fresh()));
    }

    public function businessTypes(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('catalog', 'view');

        $query = BusinessType::query()->orderBy('sort_order')->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function storeBusinessType(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('catalog', 'create');
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:40', 'alpha_dash', 'unique:business_types,slug'],
            'name' => ['required', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $type = BusinessType::query()->create($data);

        return $this->ok($type, [], 201);
    }

    public function updateBusinessType(Request $request, BusinessType $businessType): JsonResponse
    {
        $this->ensurePlatformCan('catalog', 'edit');
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $businessType->update($data);

        return $this->ok($businessType->fresh());
    }

    public function invoices(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('billing', 'view');

        $status = $request->string('status')->toString();
        $search = $request->string('search')->toString();

        $query = Invoice::query()
            ->with(['plan', 'company'])
            ->when($status !== '' && $status !== 'all', fn ($inner) => $inner->where('status', $status))
            ->when($search !== '', function ($inner) use ($search) {
                $inner->where(function ($q) use ($search) {
                    $q->where('number', 'like', "%{$search}%")
                        ->orWhereHas('company', fn ($c) => $c->where('name', 'like', "%{$search}%"));
                });
            })
            ->orderByDesc('id');

        return $this->paged($query, $request, fn (Invoice $invoice) => $this->billing->serializeInvoice($invoice));
    }

    public function issueInvoice(Company $company): JsonResponse
    {
        $this->ensurePlatformCan('billing', 'create');
        $subscription = $company->subscription;
        abort_unless($subscription, 422, 'Perusahaan belum punya langganan.');
        $invoice = $this->billing->issue($subscription->load('plan'));

        return $this->ok($this->billing->serializeInvoice($invoice), [], 201);
    }

    public function payInvoice(Invoice $invoice): JsonResponse
    {
        $this->ensurePlatformCan('billing', 'edit');

        return $this->ok($this->billing->serializeInvoice($this->billing->markPaid($invoice)));
    }

    public function voidInvoice(Invoice $invoice): JsonResponse
    {
        $this->ensurePlatformCan('billing', 'delete');
        abort_unless($invoice->status === 'issued', 422, 'Hanya tagihan terbit yang bisa dibatalkan.');
        $invoice->update(['status' => 'void']);

        return $this->ok($this->billing->serializeInvoice($invoice->fresh(['plan', 'company'])));
    }

    public function users(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('operators', 'view');

        $query = User::query()->where('is_platform', true)->orderBy('id');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request, fn (User $user) => $this->serializeOperator($user));
    }

    public function storeUser(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('operators', 'create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'username' => ['nullable', 'string', 'max:60', 'unique:users,username'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => PasswordRules::required(),
            'role_id' => ['nullable', 'integer'],
            'platform_role' => ['nullable', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $role = $this->roles->resolvePlatformRole($data['role_id'] ?? null, $data['platform_role'] ?? null);
        $this->assertCanAssignPlatformRole($role);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'username' => $data['username'] ?? null,
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
            'is_active' => $data['is_active'] ?? true,
        ]);
        $user->forceFill([
            'is_platform' => true,
            'platform_role' => $role->slug,
            'platform_role_id' => $role->id,
        ])->save();

        return $this->ok($this->serializeOperator($user->fresh()), [], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $this->ensurePlatformCan('operators', 'edit');
        abort_unless($user->is_platform, 404, 'Bukan operator platform.');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'username' => ['nullable', 'string', 'max:60', Rule::unique('users', 'username')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => PasswordRules::optional(),
            'role_id' => ['nullable', 'integer'],
            'platform_role' => ['nullable', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $roleFields = [];
        if (isset($data['role_id']) || isset($data['platform_role'])) {
            $role = $this->roles->resolvePlatformRole($data['role_id'] ?? null, $data['platform_role'] ?? null);
            $this->assertCanAssignPlatformRole($role, $user->platform_role_id);
            if ($this->userIsOwner($user) && ! $role->is_owner) {
                abort_unless($this->ownerCount() > 1, 422, 'Tidak bisa menurunkan owner terakhir.');
            }
            if (! Access::isPlatformOwner() && $this->userIsOwner($user)) {
                abort(403, 'Tidak bisa mengubah owner.');
            }
            $roleFields = [
                'platform_role' => $role->slug,
                'platform_role_id' => $role->id,
            ];
        }

        if (array_key_exists('username', $data) && $data['username'] === '') {
            $data['username'] = null;
        }

        $newPassword = $data['password'] ?? null;
        unset($data['password'], $data['role_id'], $data['platform_role']);

        if (array_key_exists('is_active', $data) && ! $data['is_active'] && $user->is_active) {
            abort_if($user->id === auth()->id(), 422, 'Tidak bisa menonaktifkan akun sendiri.');
            abort_if(! Access::isPlatformOwner() && $this->userIsOwner($user), 403, 'Tidak bisa menonaktifkan owner.');
            if ($this->userIsOwner($user)) {
                abort_unless($this->ownerCount() > 1, 422, 'Tidak bisa menonaktifkan owner terakhir.');
            }
        }

        $user->fill($data);
        if ($roleFields !== []) {
            $user->forceFill($roleFields);
        }
        if (is_string($newPassword) && $newPassword !== '') {
            $user->password = $newPassword;
        }
        $user->save();

        if (is_string($newPassword) && $newPassword !== '') {
            $user->tokens()->delete();
        } elseif (array_key_exists('is_active', $data) && ! $data['is_active']) {
            $user->tokens()->delete();
        }

        return $this->ok($this->serializeOperator($user->fresh()));
    }

    public function destroyUser(User $user): JsonResponse
    {
        $this->ensurePlatformCan('operators', 'delete');
        abort_unless($user->is_platform, 404, 'Bukan operator platform.');
        abort_if($user->id === auth()->id(), 422, 'Tidak bisa menonaktifkan akun sendiri.');
        abort_if(! Access::isPlatformOwner() && $this->userIsOwner($user), 403, 'Tidak bisa menonaktifkan owner.');
        if ($this->userIsOwner($user)) {
            abort_unless($this->ownerCount() > 1, 422, 'Tidak bisa menonaktifkan owner terakhir.');
        }

        $user->forceFill(['is_active' => false])->save();
        $user->tokens()->delete();

        return $this->ok($this->serializeOperator($user->fresh()));
    }

    private function serializeOperator(User $user): array
    {
        $role = $user->platform_role_id
            ? \App\Models\Role::query()->find($user->platform_role_id)
            : null;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'phone' => $user->phone,
            'platform_role' => $role?->slug ?? ($user->platform_role ?: 'owner'),
            'role_id' => $role?->id ?? $user->platform_role_id,
            'role_name' => $role?->name,
            'is_active' => $user->is_active,
        ];
    }

    private function assertCanAssignPlatformRole(\App\Models\Role $role, ?int $currentRoleId = null): void
    {
        abort_unless($role->is_active || $currentRoleId === $role->id, 422, 'Role tidak aktif.');
        if ($role->is_owner) {
            abort_unless(Access::isPlatformOwner(), 403, 'Hanya owner yang bisa menunjuk owner.');
        }
    }

    private function userIsOwner(User $user): bool
    {
        if ($user->platform_role_id) {
            return (bool) \App\Models\Role::query()->whereKey($user->platform_role_id)->value('is_owner');
        }

        return ($user->platform_role ?: 'owner') === 'owner';
    }

    private function ownerCount(): int
    {
        $ownerIds = \App\Models\Role::query()
            ->where('scope', 'platform')
            ->where('is_owner', true)
            ->pluck('id');

        return User::query()
            ->where('is_platform', true)
            ->where('is_active', true)
            ->where(function ($query) use ($ownerIds) {
                $query->whereIn('platform_role_id', $ownerIds)
                    ->orWhere(function ($inner) {
                        $inner->whereNull('platform_role_id')
                            ->where(function ($slug) {
                                $slug->where('platform_role', 'owner')->orWhereNull('platform_role');
                            });
                    });
            })
            ->count();
    }

    private function serializeCompany(Company $company): array
    {
        $subscription = $company->subscription;

        return [
            'id' => $company->id,
            'name' => $company->name,
            'business_type' => $company->business_type,
            'business_type_name' => $company->businessType?->name,
            'phone' => $company->phone,
            'status' => $company->status,
            'users_count' => $company->users_count ?? $company->users()->count(),
            'outlets_count' => $company->outlets_count ?? $company->outlets()->count(),
            'created_at' => $company->created_at?->toIso8601String(),
            'billing' => $subscription ? [
                'status' => $subscription->status,
                'billing_cycle' => $subscription->billing_cycle,
                'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
                'current_period_end' => $subscription->current_period_end?->toIso8601String(),
                'plan' => $subscription->plan ? [
                    'id' => $subscription->plan->id,
                    'name' => $subscription->plan->name,
                ] : null,
            ] : null,
        ];
    }

    private function planRules(Request $request, ?int $ignore = null): array
    {
        return $request->validate([
            'slug' => [$ignore ? 'sometimes' : 'required', 'string', 'max:40', 'alpha_dash', Rule::unique('plans', 'slug')->ignore($ignore)],
            'name' => [$ignore ? 'sometimes' : 'required', 'string', 'max:80'],
            'price_monthly' => [$ignore ? 'sometimes' : 'required', 'integer', 'min:0'],
            'price_yearly' => [$ignore ? 'sometimes' : 'required', 'integer', 'min:0'],
            'trial_days' => ['sometimes', 'integer', 'min:0', 'max:90'],
            'max_users' => ['nullable', 'integer', 'min:1'],
            'max_outlets' => ['nullable', 'integer', 'min:1'],
            'modules' => ['sometimes', 'array'],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
    }
}
