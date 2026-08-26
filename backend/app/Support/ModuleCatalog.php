<?php

namespace App\Support;

class ModuleCatalog
{
    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return [
            'pos',
            'stock',
            'invoice',
            'purchase',
            'work_order',
            'promotions',
            'choices',
        ];
    }

    /**
     * Defaults for a new company / plan merge base.
     *
     * @return array<string, bool>
     */
    public static function defaults(): array
    {
        return [
            'pos' => true,
            'stock' => true,
            'invoice' => true,
            'purchase' => false,
            'work_order' => false,
            'promotions' => true,
            'choices' => true,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $stored
     * @return array<string, bool>
     */
    public static function resolve(?array $stored): array
    {
        $next = self::defaults();
        foreach ($stored ?? [] as $key => $on) {
            if (! array_key_exists($key, $next)) {
                continue;
            }
            $next[$key] = (bool) $on;
        }

        return $next;
    }
}
