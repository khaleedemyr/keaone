<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StorefrontOrderItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'storefront_order_id',
        'product_id',
        'name_snapshot',
        'qty',
        'unit_price',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'unit_price' => 'integer',
            'line_total' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(StorefrontOrder::class, 'storefront_order_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
