<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanyUser;
use App\Models\Department;
use App\Models\JobLevel;
use App\Models\Outlet;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use App\Services\RoleService;
use App\Support\Access;
use App\Support\CurrentCompany;
use App\Support\PasswordRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function __construct(private RoleService $roles) {}

    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny([
                'users',
                'purchaserequisitions',
                'purchaseorders',
                'goodsreceipts',
            ]);
        } else {
            $this->ensureCan('users', 'view');
        }

        $query = CompanyUser::query()
            ->where('company_id', CurrentCompany::id())
            ->with([
                'user',
                'outlet',
                'department',
                'position',
                'jobLevel',
                'manager.user',
            ])
            ->orderBy('id');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('employee_code', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($inner) use ($search) {
                        $inner->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('username', 'like', "%{$search}%");
                    });
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request, fn (CompanyUser $row) => $this->serialize($row));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('users', 'create');

        $existingUser = User::query()->where('email', $request->input('email'))->first();

        $data = $request->validate($this->storeRules($existingUser));

        $role = $this->roles->resolveTenantRole(CurrentCompany::id(), $data['role_id'] ?? null, $data['role'] ?? null);
        $this->assertCanAssignRole($role);
        $this->ensurePlanLimit('users');
        $outletId = $this->validOutletId($data['outlet_id'] ?? null);
        $hr = $this->validatedHrFields($data);

        if ($existingUser) {
            $alreadyMember = CompanyUser::query()
                ->where('company_id', CurrentCompany::id())
                ->where('user_id', $existingUser->id)
                ->exists();

            if ($alreadyMember) {
                throw ValidationException::withMessages([
                    'email' => ['Email sudah terdaftar sebagai karyawan di perusahaan ini.'],
                ]);
            }

            if (! empty($data['username']) && User::query()->where('username', $data['username'])->whereKeyNot($existingUser->id)->exists()) {
                throw ValidationException::withMessages([
                    'username' => ['Username sudah terpakai.'],
                ]);
            }
        } else {
            if (! empty($data['username']) && User::query()->where('username', $data['username'])->exists()) {
                throw ValidationException::withMessages([
                    'username' => ['Username sudah terpakai.'],
                ]);
            }
        }

        $member = DB::transaction(function () use ($data, $outletId, $role, $hr, $existingUser) {
            if ($existingUser) {
                $existingUser->fill(array_filter([
                    'name' => $data['name'],
                    'phone' => $data['phone'] ?? null,
                ], fn ($value) => $value !== null));

                if (array_key_exists('username', $data)) {
                    $existingUser->username = $data['username'];
                }
                if (! empty($data['password'])) {
                    $existingUser->password = $data['password'];
                    $existingUser->tokens()->delete();
                }
                $existingUser->save();
                $user = $existingUser;
            } else {
                $user = User::query()->create([
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'username' => $data['username'] ?? null,
                    'phone' => $data['phone'] ?? null,
                    'password' => $data['password'],
                ]);
            }

            $managerId = $hr['manager_id'] ?? null;
            unset($hr['manager_id']);

            $row = CompanyUser::query()->create([
                'company_id' => CurrentCompany::id(),
                'user_id' => $user->id,
                'outlet_id' => $outletId,
                'role' => $role->slug,
                'role_id' => $role->id,
                'is_active' => $data['is_active'] ?? true,
                ...$hr,
            ]);

            if ($managerId) {
                $this->assertValidManager($row, $managerId);
                $row->update(['manager_id' => $managerId]);
            }

            return $row->load([
                'user',
                'outlet',
                'department',
                'position',
                'jobLevel',
                'manager.user',
            ]);
        });

        return $this->ok($this->serialize($member), [], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->ensureCan('users', 'edit');

        $member = $this->membershipOf($user);

        $data = $request->validate($this->updateRules($user, $member));

        $nextRole = null;
        if (isset($data['role_id']) || isset($data['role'])) {
            $nextRole = $this->roles->resolveTenantRole(CurrentCompany::id(), $data['role_id'] ?? null, $data['role'] ?? null);
            $this->assertCanAssignRole($nextRole, $member->role_id);
        }

        if (array_key_exists('is_active', $data) && $data['is_active'] && ! $member->is_active) {
            $this->ensurePlanLimit('users');
        }

        $this->guardLastOwner($member, $data, $nextRole);

        if (array_key_exists('outlet_id', $data)) {
            $data['outlet_id'] = $this->validOutletId($data['outlet_id'], $member->outlet_id);
        }

        $hr = $this->validatedHrFields($data, $member);
        if (array_key_exists('manager_id', $hr)) {
            $this->assertValidManager($member, $hr['manager_id']);
        }

        DB::transaction(function () use ($user, $member, $data, $nextRole, $hr) {
            $user->fill(array_filter([
                'name' => $data['name'] ?? null,
                'email' => $data['email'] ?? null,
            ], fn ($value) => $value !== null));

            if (array_key_exists('username', $data)) {
                $user->username = $data['username'];
            }
            if (array_key_exists('phone', $data)) {
                $user->phone = $data['phone'];
            }
            if (! empty($data['password'])) {
                $user->password = $data['password'];
            }
            $user->save();

            if (! empty($data['password'])) {
                $user->tokens()->delete();
            }

            $pivot = $hr;
            if ($nextRole) {
                $pivot['role'] = $nextRole->slug;
                $pivot['role_id'] = $nextRole->id;
            }
            if (array_key_exists('outlet_id', $data)) {
                $pivot['outlet_id'] = $data['outlet_id'];
            }
            if (array_key_exists('is_active', $data)) {
                $pivot['is_active'] = $data['is_active'];
            }
            if ($pivot !== []) {
                $member->update($pivot);
            }
        });

        return $this->ok($this->serialize($member->fresh([
            'user',
            'outlet',
            'department',
            'position',
            'jobLevel',
            'manager.user',
        ])));
    }

    public function destroy(User $user): JsonResponse
    {
        $this->ensureCanAny([['users', 'delete'], ['users', 'edit']]);

        $member = $this->membershipOf($user);

        if ($user->id === auth()->id()) {
            return $this->error('Tidak bisa menonaktifkan akun sendiri.', [], 422);
        }

        $this->guardLastOwner($member, ['is_active' => false], null);

        $member->update(['is_active' => false]);

        if (! $user->is_platform && $user->memberships()->where('is_active', true)->count() === 0) {
            $user->tokens()->delete();
        }

        return $this->ok($this->serialize($member->fresh([
            'user',
            'outlet',
            'department',
            'position',
            'jobLevel',
            'manager.user',
        ])));
    }

    /**
     * @return array<string, mixed>
     */
    private function storeRules(?User $existingUser): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:150'],
            'username' => ['nullable', 'string', 'max:60'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => $existingUser ? PasswordRules::optional() : PasswordRules::required(),
            'role_id' => ['nullable', 'integer'],
            'role' => ['nullable', 'string', 'max:80'],
            'outlet_id' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
            'employee_code' => [
                'nullable',
                'string',
                'max:40',
                Rule::unique('company_user', 'employee_code')->where('company_id', CurrentCompany::id()),
            ],
            'department_id' => ['nullable', 'integer', Rule::exists('departments', 'id')],
            'position_id' => ['nullable', 'integer', Rule::exists('positions', 'id')],
            'job_level_id' => ['nullable', 'integer', Rule::exists('job_levels', 'id')],
            'manager_id' => ['nullable', 'integer', Rule::exists('company_user', 'id')],
            'hired_at' => ['nullable', 'date'],
            'employment_status' => ['nullable', 'string', Rule::in(['active', 'resigned'])],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function updateRules(User $user, CompanyUser $member): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'username' => ['nullable', 'string', 'max:60', Rule::unique('users', 'username')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => PasswordRules::optional(),
            'role_id' => ['nullable', 'integer'],
            'role' => ['nullable', 'string', 'max:80'],
            'outlet_id' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
            'employee_code' => [
                'nullable',
                'string',
                'max:40',
                Rule::unique('company_user', 'employee_code')
                    ->where('company_id', CurrentCompany::id())
                    ->ignore($member->id),
            ],
            'department_id' => ['nullable', 'integer', Rule::exists('departments', 'id')],
            'position_id' => ['nullable', 'integer', Rule::exists('positions', 'id')],
            'job_level_id' => ['nullable', 'integer', Rule::exists('job_levels', 'id')],
            'manager_id' => ['nullable', 'integer', Rule::exists('company_user', 'id')],
            'hired_at' => ['nullable', 'date'],
            'employment_status' => ['nullable', 'string', Rule::in(['active', 'resigned'])],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function validatedHrFields(array $data, ?CompanyUser $member = null): array
    {
        $fields = [];

        foreach (['employee_code', 'department_id', 'position_id', 'job_level_id', 'manager_id', 'hired_at', 'employment_status'] as $key) {
            if (! array_key_exists($key, $data)) {
                continue;
            }

            $value = $data[$key];
            if ($key === 'employee_code') {
                $fields[$key] = $value !== null && $value !== '' ? $value : null;
                continue;
            }
            if (in_array($key, ['department_id', 'position_id', 'job_level_id', 'manager_id'], true)) {
                $fields[$key] = $value ? (int) $value : null;
                if ($fields[$key]) {
                    $this->assertHrBelongsToCompany($key, $fields[$key]);
                }
                continue;
            }
            $fields[$key] = $value;
        }

        if (array_key_exists('employment_status', $fields) && ! $fields['employment_status']) {
            $fields['employment_status'] = 'active';
        }

        return $fields;
    }

    private function assertHrBelongsToCompany(string $field, int $id): void
    {
        $map = [
            'department_id' => Department::class,
            'position_id' => Position::class,
            'job_level_id' => JobLevel::class,
        ];

        if ($field === 'manager_id') {
            abort_unless(
                CompanyUser::query()->where('company_id', CurrentCompany::id())->whereKey($id)->exists(),
                422,
                'Atasan tidak valid.',
            );

            return;
        }

        $model = $map[$field] ?? null;
        abort_unless($model && $model::query()->whereKey($id)->exists(), 422, 'Data HR tidak valid.');
    }

    private function assertValidManager(CompanyUser $member, ?int $managerId): void
    {
        if (! $managerId) {
            return;
        }

        if ($managerId === $member->id) {
            throw ValidationException::withMessages([
                'manager_id' => ['Karyawan tidak bisa menjadi atasan dirinya sendiri.'],
            ]);
        }

        $manager = CompanyUser::query()
            ->where('company_id', CurrentCompany::id())
            ->whereKey($managerId)
            ->first();

        if (! $manager) {
            throw ValidationException::withMessages([
                'manager_id' => ['Atasan tidak ditemukan.'],
            ]);
        }

        $cursor = $manager;
        while ($cursor) {
            if ($cursor->id === $member->id) {
                throw ValidationException::withMessages([
                    'manager_id' => ['Atasan tidak valid (membentuk lingkaran).'],
                ]);
            }
            $cursor = $cursor->manager_id
                ? CompanyUser::query()->whereKey($cursor->manager_id)->first()
                : null;
        }
    }

    private function membershipOf(User $user): CompanyUser
    {
        $member = CompanyUser::query()
            ->where('company_id', CurrentCompany::id())
            ->where('user_id', $user->id)
            ->with([
                'user',
                'outlet',
                'department',
                'position',
                'jobLevel',
                'manager.user',
            ])
            ->first();

        abort_unless($member, 404, 'Karyawan tidak ditemukan di perusahaan ini.');

        return $member;
    }

    private function assertCanAssignRole(Role $role, ?int $currentRoleId = null): void
    {
        abort_unless($role->is_active || $currentRoleId === $role->id, 422, 'Role tidak aktif.');

        if ($role->is_owner && ! Access::isOwner()) {
            abort(403, 'Hanya owner yang bisa menetapkan role owner.');
        }
    }

    private function guardLastOwner(CompanyUser $member, array $changes, ?Role $nextRole): void
    {
        $staysOwner = $nextRole ? $nextRole->is_owner : $this->memberIsOwner($member);
        $nextActive = array_key_exists('is_active', $changes) ? (bool) $changes['is_active'] : $member->is_active;
        $losesOwner = $this->memberIsOwner($member) && (! $staysOwner || $nextActive === false);

        if (! $losesOwner) {
            return;
        }

        $owners = CompanyUser::query()
            ->where('company_id', CurrentCompany::id())
            ->where('is_active', true)
            ->where(function ($query) {
                $query->where('role', 'owner')->orWhereHas('roleRecord', fn ($q) => $q->where('is_owner', true));
            })
            ->count();

        if ($owners <= 1) {
            abort(422, 'Harus ada minimal satu owner aktif.');
        }
    }

    private function memberIsOwner(CompanyUser $member): bool
    {
        if ($member->role_id) {
            return (bool) Role::query()->whereKey($member->role_id)->value('is_owner');
        }

        return $member->role === 'owner';
    }

    private function validOutletId(?int $outletId, ?int $currentId = null): ?int
    {
        if (! $outletId) {
            return null;
        }

        $query = Outlet::query()->whereKey($outletId);
        if ($currentId !== $outletId) {
            $query->where('is_active', true);
        }

        abort_unless($query->exists(), 422, 'Outlet tidak ditemukan.');

        return $outletId;
    }

    private function serialize(CompanyUser $row): array
    {
        $user = $row->user;

        return [
            'id' => $user?->id,
            'membership_id' => $row->id,
            'name' => $user?->name,
            'email' => $user?->email,
            'username' => $user?->username,
            'phone' => $user?->phone,
            'role' => $row->role,
            'role_id' => $row->role_id,
            'is_active' => $row->is_active,
            'employee_code' => $row->employee_code,
            'hired_at' => $row->hired_at?->toDateString(),
            'employment_status' => $row->employment_status ?? 'active',
            'outlet' => $row->outlet ? [
                'id' => $row->outlet->id,
                'name' => $row->outlet->name,
            ] : null,
            'department' => $row->department ? [
                'id' => $row->department->id,
                'name' => $row->department->name,
            ] : null,
            'position' => $row->position ? [
                'id' => $row->position->id,
                'name' => $row->position->name,
            ] : null,
            'job_level' => $row->jobLevel ? [
                'id' => $row->jobLevel->id,
                'name' => $row->jobLevel->name,
            ] : null,
            'manager' => $row->manager ? [
                'membership_id' => $row->manager->id,
                'name' => $row->manager->user?->name,
            ] : null,
        ];
    }
}
