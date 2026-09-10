<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StorefrontNewsPost extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'storefront_id',
        'slug',
        'title',
        'excerpt',
        'body',
        'image_path',
        'tags',
        'sort_order',
        'is_published',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'published_at' => 'datetime',
            'sort_order' => 'integer',
        ];
    }

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }

    public function imageUrl(): ?string
    {
        if (! is_string($this->image_path) || $this->image_path === '') {
            return null;
        }

        $file = basename($this->image_path);
        if (! preg_match('/^[A-Za-z0-9._-]+$/', $file)) {
            return null;
        }

        return '/media/storefront/'.$file;
    }
}
