<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StorefrontProduct extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'storefront_id',
        'product_id',
        'is_visible',
        'sort_order',
        'allocated_qty',
        'sold_qty',
        'override_price',
        'is_deal',
        'is_new_arrival',
        'is_bestseller',
        'units_sold',
        'avg_rating',
        'review_count',
    ];

    protected function casts(): array
    {
        return [
            'is_visible' => 'boolean',
            'sort_order' => 'integer',
            'allocated_qty' => 'integer',
            'sold_qty' => 'integer',
            'override_price' => 'integer',
            'is_deal' => 'boolean',
            'is_new_arrival' => 'boolean',
            'is_bestseller' => 'boolean',
            'units_sold' => 'integer',
            'avg_rating' => 'float',
            'review_count' => 'integer',
        ];
    }

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function remainingAllocated(): ?int
    {
        if ($this->allocated_qty === null) {
            return null;
        }

        return max(0, (int) $this->allocated_qty - (int) $this->sold_qty);
    }
}
