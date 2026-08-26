<?php

namespace App\Support;

use App\Models\Role;
use App\Models\User;

class Access
{
    public static function tenantRole(?User $user = null): ?Role
    {
        $membership = CurrentCompany::membership($user);
        if (! $membership) {
            return null;
        }

        if ($membership->role_id) {
            return Role::query()->with('permissions')->find($membership->role_id);
        }

        return Role::query()
            ->with('permissions')
            ->where('scope', 'tenant')
            ->where('company_id', $membership->company_id)
            ->where('slug', $membership->role)
            ->first();
    }

    public static function platformRole(?User $user = null): ?Role
    {
        $user ??= auth()->user();
        if (! $user?->is_platform) {
            return null;
        }

        if ($user->platform_role_id) {
            return Role::query()->with('permissions')->find($user->platform_role_id);
        }

        return Role::query()
            ->with('permissions')
            ->where('scope', 'platform')
            ->whereNull('company_id')
            ->where('slug', $user->platform_role ?: 'owner')
            ->first();
    }

    public static function can(string $menu, string $action = 'view', ?User $user = null): bool
    {
        $user ??= auth()->user();
        if (! $user) {
            return false;
        }

        $role = self::tenantRole($user);
        if (! $role) {
            return false;
        }

        return self::roleAllows($role, 'tenant', $menu, $action);
    }

    public static function canPlatform(string $menu, string $action = 'view', ?User $user = null): bool
    {
        $user ??= auth()->user();
        if (! $user?->is_platform) {
            return false;
        }

        $role = self::platformRole($user);
        if (! $role) {
            return false;
        }

        return self::roleAllows($role, 'platform', $menu, $action);
    }

    /**
     * @return array<string, array{view: bool, create: bool, edit: bool, delete: bool}>
     */
    public static function matrix(string $scope, ?Role $role): array
    {
        $matrix = [];
        foreach (MenuCatalog::for($scope) as $menu) {
            $matrix[$menu['key']] = [
                'view' => false,
                'create' => false,
                'edit' => false,
                'delete' => false,
            ];
        }

        if (! $role) {
            return $matrix;
        }

        if ($role->is_owner) {
            foreach ($matrix as $key => $row) {
                $allowed = [];
                foreach (MenuCatalog::for($scope) as $menu) {
                    if ($menu['key'] === $key) {
                        $allowed = $menu['actions'];
                        break;
                    }
                }
                $matrix[$key] = [
                    'view' => in_array('view', $allowed, true),
                    'create' => in_array('create', $allowed, true),
                    'edit' => in_array('edit', $allowed, true),
                    'delete' => in_array('delete', $allowed, true),
                ];
            }

            return $matrix;
        }

        foreach ($role->permissionMap() as $key => $flags) {
            if (isset($matrix[$key])) {
                $matrix[$key] = $flags;
            }
        }

        return $matrix;
    }

    public static function isOwner(?User $user = null): bool
    {
        return (bool) self::tenantRole($user)?->is_owner;
    }

    public static function isPlatformOwner(?User $user = null): bool
    {
        return (bool) self::platformRole($user)?->is_owner;
    }

    private static function roleAllows(Role $role, string $scope, string $menu, string $action): bool
    {
        if (! MenuCatalog::allows($scope, $menu, $action)) {
            return false;
        }

        if ($role->is_owner) {
            return true;
        }

        $flags = $role->permissionMap()[$menu] ?? null;
        if (! $flags) {
            return false;
        }

        return (bool) ($flags[$action] ?? false);
    }
}
