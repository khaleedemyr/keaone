<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Tenant-scoped cache with version bump invalidation (works with any cache driver).
 */
class TenantCache
{
    public static function key(int $companyId, string $segment, string $suffix = ''): string
    {
        $base = 'tenant:'.$companyId.':'.$segment;

        return $suffix !== '' ? $base.':'.$suffix : $base;
    }

    public static function version(int $companyId, string $segment): int
    {
        return (int) Cache::get(self::key($companyId, $segment, 'ver'), 1);
    }

    public static function bump(int $companyId, string $segment): void
    {
        Cache::forever(self::key($companyId, $segment, 'ver'), self::version($companyId, $segment) + 1);
    }

    public static function rememberVersioned(int $companyId, string $segment, string $suffix, int $ttlSeconds, callable $callback): mixed
    {
        $ver = self::version($companyId, $segment);
        $key = self::key($companyId, $segment, $ver.':'.$suffix);

        return Cache::remember($key, $ttlSeconds, $callback);
    }

    public static function forget(int $companyId, string $segment, string $suffix): void
    {
        $ver = self::version($companyId, $segment);
        Cache::forget(self::key($companyId, $segment, $ver.':'.$suffix));
    }
}
