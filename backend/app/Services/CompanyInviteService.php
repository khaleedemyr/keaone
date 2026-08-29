<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyInvite;
use App\Models\CompanyUser;
use App\Models\Outlet;
use App\Models\Role;
use App\Models\User;
use App\Support\Access;
use App\Support\EmployeeProfile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CompanyInviteService
{
    public function __construct(private RoleService $roles) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(Company $company, User $creator, array $data): CompanyInvite
    {
        $role = $this->roles->resolveTenantRole($company->id, $data['role_id'] ?? null, $data['role'] ?? null);
        $this->assertCanAssignRole($role);

        $email = isset($data['email']) && $data['email'] !== '' ? strtolower(trim((string) $data['email'])) : null;
        $maxUses = array_key_exists('max_uses', $data) ? $data['max_uses'] : ($email ? 1 : null);
        $expiresAt = $this->resolveExpiresAt($data['expires_in_days'] ?? null);

        return CompanyInvite::query()->create([
            'company_id' => $company->id,
            'token' => Str::random(48),
            'role_id' => $role->id,
            'role' => $role->slug,
            'email' => $email,
            'label' => $data['label'] ?? null,
            'max_uses' => $maxUses !== null && $maxUses !== '' ? (int) $maxUses : null,
            'expires_at' => $expiresAt,
            'created_by' => $creator->id,
        ]);
    }

    public function findByToken(string $token): CompanyInvite
    {
        return CompanyInvite::query()
            ->where('token', $token)
            ->with(['company', 'roleRecord'])
            ->firstOrFail();
    }

    /**
     * @param  array<string, mixed>  $profile
     */
    public function accept(CompanyInvite $invite, User $user, array $profile = []): CompanyUser
    {
        abort_unless($invite->isAcceptable(), 422, 'Undangan tidak valid atau sudah kedaluwarsa.');

        if ($invite->email && strtolower((string) $user->email) !== strtolower($invite->email)) {
            throw ValidationException::withMessages([
                'email' => ['Undangan ini khusus untuk email '.$invite->email.'.'],
            ]);
        }

        if ($profile !== []) {
            $user->fill(EmployeeProfile::validated($profile));
            if (isset($profile['name']) && $profile['name']) {
                $user->name = $profile['name'];
            }
            $user->save();
        }

        $existing = CompanyUser::query()
            ->where('company_id', $invite->company_id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->is_active && $existing->onboarding_status === 'complete') {
                throw ValidationException::withMessages([
                    'token' => ['Anda sudah terdaftar di perusahaan ini.'],
                ]);
            }

            if ($existing->onboarding_status === 'pending_hr') {
                throw ValidationException::withMessages([
                    'token' => ['Data Anda sudah dikirim. Menunggu persetujuan HR.'],
                ]);
            }

            $existing->update([
                'role' => $invite->role,
                'role_id' => $invite->role_id,
                'invite_id' => $invite->id,
                'onboarding_status' => 'pending_hr',
                'onboarding_submitted_at' => now(),
                'onboarding_approved_at' => null,
                'onboarding_approved_by' => null,
                'is_active' => false,
                'employment_status' => 'probation',
            ]);
            $member = $existing->fresh();
        } else {
            $outletId = Outlet::query()
                ->where('company_id', $invite->company_id)
                ->where('is_default', true)
                ->value('id');

            $member = CompanyUser::query()->create([
                'company_id' => $invite->company_id,
                'user_id' => $user->id,
                'outlet_id' => $outletId,
                'role' => $invite->role,
                'role_id' => $invite->role_id,
                'invite_id' => $invite->id,
                'onboarding_status' => 'pending_hr',
                'onboarding_submitted_at' => now(),
                'employment_status' => 'probation',
                'is_active' => false,
            ]);
        }

        $invite->increment('use_count');

        return $member->load(['company', 'user']);
    }

    public function approve(CompanyUser $member, User $approver, array $hr): CompanyUser
    {
        abort_unless($member->onboarding_status === 'pending_hr', 422, 'Karyawan tidak menunggu persetujuan HR.');

        $this->ensurePlanLimit($member->company_id);

        $member->update([
            ...$hr,
            'onboarding_status' => 'complete',
            'onboarding_approved_at' => now(),
            'onboarding_approved_by' => $approver->id,
            'is_active' => true,
            'employment_status' => $hr['employment_status'] ?? 'active',
        ]);

        $member->user?->forceFill(['last_company_id' => $member->company_id])->save();

        return $member->fresh(['user', 'department', 'position', 'jobLevel', 'manager.user']);
    }

    public function reject(CompanyUser $member): CompanyUser
    {
        abort_unless($member->onboarding_status === 'pending_hr', 422, 'Karyawan tidak menunggu persetujuan HR.');

        $member->update([
            'onboarding_status' => 'rejected',
            'is_active' => false,
        ]);

        return $member->fresh();
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(CompanyInvite $invite): array
    {
        return [
            'id' => $invite->id,
            'token' => $invite->token,
            'role' => $invite->role,
            'role_id' => $invite->role_id,
            'role_name' => $invite->roleRecord?->name,
            'email' => $invite->email,
            'label' => $invite->label,
            'max_uses' => $invite->max_uses,
            'use_count' => $invite->use_count,
            'is_personal' => $invite->email !== null || $invite->max_uses === 1,
            'is_reusable' => $invite->email === null && ($invite->max_uses === null || $invite->max_uses > 1),
            'expires_at' => $invite->expires_at?->toIso8601String(),
            'revoked_at' => $invite->revoked_at?->toIso8601String(),
            'is_acceptable' => $invite->isAcceptable(),
            'created_at' => $invite->created_at?->toIso8601String(),
            'creator_name' => $invite->creator?->name,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializePublic(CompanyInvite $invite): array
    {
        $company = $invite->company;

        return [
            'token' => $invite->token,
            'company_name' => $company?->name,
            'company_logo' => $company?->logoUrl(),
            'role' => $invite->role,
            'role_name' => $invite->roleRecord?->name ?? $invite->role,
            'email' => $invite->email,
            'label' => $invite->label,
            'is_personal' => $invite->email !== null || $invite->max_uses === 1,
            'is_reusable' => $invite->email === null && ($invite->max_uses === null || $invite->max_uses > 1),
            'expires_at' => $invite->expires_at?->toIso8601String(),
            'is_acceptable' => $invite->isAcceptable(),
            'status' => $this->publicStatus($invite),
        ];
    }

    private function publicStatus(CompanyInvite $invite): string
    {
        if ($invite->isRevoked()) {
            return 'revoked';
        }
        if ($invite->isExpired()) {
            return 'expired';
        }
        if (! $invite->hasUsesLeft()) {
            return 'exhausted';
        }

        return 'active';
    }

    private function resolveExpiresAt(mixed $days): ?Carbon
    {
        if ($days === null || $days === '' || $days === 0 || $days === '0') {
            return now()->addDays(7);
        }

        if ($days === -1 || $days === '-1') {
            return null;
        }

        return now()->addDays(max(1, (int) $days));
    }

    private function assertCanAssignRole(Role $role): void
    {
        abort_unless($role->is_active, 422, 'Role tidak aktif.');

        if ($role->is_owner && ! Access::isOwner()) {
            abort(403, 'Hanya owner yang bisa mengundang dengan role owner.');
        }
    }

    private function ensurePlanLimit(int $companyId): void
    {
        $company = Company::query()->with('subscription.plan')->find($companyId);
        $plan = $company?->subscription?->plan;
        if (! $plan?->max_users) {
            return;
        }

        $count = CompanyUser::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->where('onboarding_status', 'complete')
            ->count();

        abort_unless($count < $plan->max_users, 422, 'Paket perusahaan ini sudah mencapai batas pengguna.');
    }
}
