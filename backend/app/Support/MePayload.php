<?php

namespace App\Support;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\User;
use App\Support\Access;
use App\Support\CurrentCompany;

class MePayload
{
    public static function make(User $user): array
    {
        $membership = CurrentCompany::membership($user);
        $company = CurrentCompany::company($user);
        $outlet = CurrentCompany::outlet($user);
        $roleSlug = CurrentCompany::role($user);
        $isPlatformDesktop = (bool) ($user->is_platform && ! $company);
        $isSupportVisit = (bool) ($user->is_platform && $company && ! $membership);

        if ($isPlatformDesktop) {
            $aclRole = Access::platformRole($user);
            $scope = 'platform';
            $matrix = Access::matrix($scope, $aclRole);
            $isOwner = (bool) ($aclRole?->is_owner);
        } elseif ($isSupportVisit) {
            $aclRole = null;
            $scope = 'tenant';
            $matrix = Access::matrix($scope, new \App\Models\Role(['is_owner' => true]));
            $isOwner = true;
        } else {
            $aclRole = Access::tenantRole($user);
            $scope = 'tenant';
            $matrix = Access::matrix($scope, $aclRole);
            $isOwner = (bool) ($aclRole?->is_owner);
        }

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'phone' => $user->phone,
                'avatar' => $user->avatarUrl(),
                'role' => $aclRole?->slug ?? $roleSlug,
                'role_name' => $aclRole?->name,
                'is_platform' => (bool) $user->is_platform,
                'platform_role' => $user->is_platform ? ($user->platform_role ?: 'owner') : null,
            ],
            'acl' => [
                'scope' => $scope,
                'role_id' => $aclRole?->id,
                'role_name' => $aclRole?->name,
                'role_slug' => $aclRole?->slug ?? $roleSlug,
                'is_owner' => $isOwner,
            ],
            'permissions' => $matrix,
            'company' => $company ? [
                'id' => $company->id,
                'name' => $company->name,
                'business_type' => $company->business_type,
                'phone' => $company->phone,
                'address' => $company->address,
                'logo' => $company->logoUrl(),
                'status' => $company->status,
            ] : null,
            'access' => $membership ? 'member' : ($user->is_platform && $company ? 'support' : null),
            'memberships' => $user->memberships()
                ->where('is_active', true)
                ->with('company')
                ->orderBy('id')
                ->get()
                ->filter(fn (CompanyUser $row) => $row->company)
                ->map(fn (CompanyUser $row) => [
                    'company_id' => $row->company_id,
                    'name' => $row->company->name,
                    'role' => $row->role,
                    'status' => $row->company->status,
                ])
                ->values(),
            'modules' => $company?->resolvedModules() ?? (new Company)->defaultModules(),
            'settings' => $company?->mergedSettings() ?? (new Company)->defaultSettings(),
            'outlet' => $outlet ? [
                'id' => $outlet->id,
                'name' => $outlet->name,
            ] : null,
            'billing' => app(\App\Services\BillingService::class)->snapshot($company),
            'preferences' => $user->publicPreferences(),
        ];
    }
}
