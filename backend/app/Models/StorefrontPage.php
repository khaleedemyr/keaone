<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StorefrontPage extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'storefront_id',
        'slug',
        'title',
        'kind',
        'content',
        'sort_order',
        'is_published',
    ];

    protected function casts(): array
    {
        return [
            'content' => 'array',
            'sort_order' => 'integer',
            'is_published' => 'boolean',
        ];
    }

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }
}
