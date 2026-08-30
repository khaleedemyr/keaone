<?php

namespace App\Models;

use App\Support\ModuleCatalog;
use App\Support\ProcurementSettings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Company extends Model
{
    protected $fillable = [
        'name',
        'business_type',
        'phone',
        'address',
        'logo_path',
        'modules',
        'settings',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'modules' => 'array',
            'settings' => 'array',
        ];
    }

    public function outlets(): HasMany
    {
        return $this->hasMany(Outlet::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->using(CompanyUser::class)
            ->withPivot(['outlet_id', 'role', 'role_id', 'is_active'])
            ->withTimestamps();
    }

    public function subscription(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function businessType(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(BusinessType::class, 'business_type', 'slug');
    }

    public function defaultModules(): array
    {
        return ModuleCatalog::defaults();
    }

    /**
     * @return array<string, bool>
     */
    public function resolvedModules(): array
    {
        return ModuleCatalog::resolve($this->modules);
    }

    public function defaultSettings(): array
    {
        return array_merge([
            'tax_percent' => 0,
            'allow_credit' => true,
            'receipt_width' => 80,
            'receipt_footer' => 'Terima kasih',
            'pos_mode' => 'retail',
        ], ProcurementSettings::defaults());
    }

    /**
     * @return array<string, mixed>
     */
    public function mergedSettings(): array
    {
        return array_merge($this->defaultSettings(), $this->settings ?? []);
    }

    public function logoUrl(): ?string
    {
        if (! is_string($this->logo_path) || $this->logo_path === '') {
            return null;
        }

        $file = basename($this->logo_path);
        if (! preg_match('/^[A-Za-z0-9._-]+$/', $file)) {
            return null;
        }

        return '/media/logos/'.$file;
    }
}
