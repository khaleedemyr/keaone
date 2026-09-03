<?php

namespace App\Support;

use App\Models\Company;

class InventorySettings
{
    public const FIFO = 'fifo';

    public const AVERAGE = 'average';

    public const MOVING_AVERAGE = 'moving_average';

    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return config('inventory.defaults', []);
    }

    /**
     * @return list<string>
     */
    public static function methods(): array
    {
        return config('inventory.methods', [
            self::FIFO,
            self::AVERAGE,
            self::MOVING_AVERAGE,
        ]);
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

    public static function method(?Company $company = null): string
    {
        $method = (string) self::get('inventory_costing_method', self::MOVING_AVERAGE, $company);

        return in_array($method, self::methods(), true) ? $method : self::MOVING_AVERAGE;
    }

    public static function usesLayers(?Company $company = null): bool
    {
        return self::method($company) === self::FIFO;
    }

    public static function allowsNegativeStock(?Company $company = null): bool
    {
        return (bool) self::get('inventory_allow_negative_stock', false, $company);
    }
}
