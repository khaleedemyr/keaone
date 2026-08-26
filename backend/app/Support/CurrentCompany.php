<?php

namespace App\Support;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Outlet;
use App\Models\User;

class CurrentCompany
{
    /** @var array<string, mixed> */
    private static array $memo = [];

    public static function flush(): void
    {
        self::$memo = [];
    }

    public static function requestedId(): ?int
    {
        $header = request()->header('X-Company-Id');

        if ($header === null || $header === '') {
            return null;
        }

        return (int) $header;
    }

    public static function isPlatform(?User $user = null): bool
    {
        $user ??= auth()->user();

        return (bool) $user?->is_platform;
    }

    public static function membership(?User $user = null): ?CompanyUser
    {
        $user ??= auth()->user();

        if (! $user) {
            return null;
        }

        $key = 'membership:'.$user->id.':'.(self::requestedId() ?? '').':'.($user->last_company_id ?? '');
        if (array_key_exists($key, self::$memo)) {
            return self::$memo[$key];
        }

        self::$memo[$key] = null;

        $wanted = self::requestedId() ?? $user->last_company_id;
        $query = $user->memberships()->where('is_active', true)->with('company');

        if ($wanted) {
            $match = (clone $query)->where('company_id', $wanted)->first();
            if ($match) {
                return self::$memo[$key] = $match;
            }
        }

        $rows = (clone $query)->orderBy('id')->get();

        return self::$memo[$key] = $rows->first(fn (CompanyUser $row) => $row->company?->status === 'active')
            ?? $rows->first();
    }

    public static function company(?User $user = null): ?Company
    {
        $user ??= auth()->user();
        $key = 'company:'.($user?->id ?? 0).':'.(self::requestedId() ?? '').':'.($user?->last_company_id ?? '');
        if (array_key_exists($key, self::$memo)) {
            return self::$memo[$key];
        }

        $membership = self::membership($user);

        if ($membership?->company) {
            return self::$memo[$key] = $membership->company;
        }

        if (! self::isPlatform($user)) {
            return self::$memo[$key] = null;
        }

        $id = self::requestedId() ?? $user?->last_company_id;

        return self::$memo[$key] = $id ? Company::query()->find($id) : null;
    }

    public static function id(?User $user = null): ?int
    {
        return self::company($user)?->id;
    }

    public static function outlet(?User $user = null): ?Outlet
    {
        $membership = self::membership($user);

        if ($membership?->outlet_id) {
            $outlet = Outlet::withoutGlobalScope('company')->find($membership->outlet_id);
            if ($outlet && (int) $outlet->company_id === (int) self::id($user)) {
                return $outlet;
            }
        }

        $company = self::company($user);

        return $company?->outlets()->where('is_default', true)->first()
            ?? $company?->outlets()->first();
    }

    public static function role(?User $user = null): ?string
    {
        $membership = self::membership($user);

        if ($membership) {
            return $membership->role;
        }

        if (self::isPlatform($user) && self::company($user)) {
            return 'support';
        }

        return null;
    }

    public static function hasModule(string $module, ?User $user = null): bool
    {
        $company = self::company($user);
        $enabled = (bool) (($company?->resolvedModules() ?? [])[$module] ?? false);

        if (! $enabled) {
            return false;
        }

        $plan = $company?->subscription?->plan;
        if ($plan && ! $plan->allows($module)) {
            return false;
        }

        return true;
    }
}
