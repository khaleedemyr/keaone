<?php

namespace App\Models;

use App\Support\ModuleCatalog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'price_monthly',
        'price_yearly',
        'trial_days',
        'max_users',
        'max_outlets',
        'modules',
        'is_default',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price_monthly' => 'integer',
            'price_yearly' => 'integer',
            'trial_days' => 'integer',
            'max_users' => 'integer',
            'max_outlets' => 'integer',
            'modules' => 'array',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * @return array<string, bool>
     */
    public function allowedModules(): array
    {
        return ModuleCatalog::resolve($this->modules);
    }

    public function allows(string $module): bool
    {
        return (bool) ($this->allowedModules()[$module] ?? false);
    }

    public function priceFor(string $cycle): int
    {
        return $cycle === 'yearly' ? (int) $this->price_yearly : (int) $this->price_monthly;
    }
}
