<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Storefront extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'warehouse_id',
        'price_channel_id',
        'site_kind',
        'template_key',
        'status',
        'title',
        'tagline',
        'about',
        'logo_path',
        'brand_colors',
        'theme_content',
        'bank_accounts',
        'shipping',
        'stock_mode',
        'contact_email',
        'contact_phone',
        'contact_address',
        'seo_title',
        'seo_description',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'brand_colors' => 'array',
            'theme_content' => 'array',
            'bank_accounts' => 'array',
            'shipping' => 'array',
            'published_at' => 'datetime',
        ];
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

        return '/media/storefront/'.$file;
    }

    public function domains(): HasMany
    {
        return $this->hasMany(StorefrontDomain::class);
    }

    public function pages(): HasMany
    {
        return $this->hasMany(StorefrontPage::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(StorefrontProduct::class);
    }

    public function newsPosts(): HasMany
    {
        return $this->hasMany(StorefrontNewsPost::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(StorefrontOrder::class);
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(StorefrontInquiry::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function priceChannel(): BelongsTo
    {
        return $this->belongsTo(PriceChannel::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function isShop(): bool
    {
        return $this->site_kind === 'shop';
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
