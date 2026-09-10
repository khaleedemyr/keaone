<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StorefrontProductReview extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'storefront_id',
        'storefront_product_id',
        'product_id',
        'storefront_order_id',
        'contact_id',
        'customer_name',
        'rating',
        'comment',
        'is_published',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'is_published' => 'boolean',
        ];
    }

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }

    public function storefrontProduct(): BelongsTo
    {
        return $this->belongsTo(StorefrontProduct::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(StorefrontOrder::class, 'storefront_order_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}
