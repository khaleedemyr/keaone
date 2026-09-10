<?php

namespace App\Support;

use App\Models\Company;

class SalesSettings
{
    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return config('sales.defaults', []);
    }

    /**
     * @return array<string, mixed>
     */
    public static function merged(?Company $company = null): array
    {
        $company ??= CurrentCompany::company();

        if (! $company) {
            return self::defaults();
        }

        return array_merge($company->defaultSettings(), $company->settings ?? []);
    }

    public static function get(string $key, mixed $default = null, ?Company $company = null): mixed
    {
        $settings = self::merged($company);

        return $settings[$key] ?? $default ?? self::defaults()[$key] ?? null;
    }

    public static function bool(string $key, ?Company $company = null): bool
    {
        return (bool) self::get($key, false, $company);
    }

    public static function glPostingEnabled(?Company $company = null): bool
    {
        return self::bool('sales_gl_posting_enabled', $company);
    }

    public static function getInt(string $key, ?Company $company = null): ?int
    {
        $val = self::get($key, null, $company);

        if ($val === null || $val === '') {
            return null;
        }

        return (int) $val;
    }
}
