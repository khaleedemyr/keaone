<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StorefrontOrder extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'storefront_id',
        'sale_id',
        'contact_id',
        'number',
        'client_uuid',
        'status',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_address',
        'subtotal',
        'discount',
        'tax',
        'shipping_cost',
        'total',
        'payment_method',
        'payment_note',
        'transfer_proof_path',
        'bank_snapshot',
        'shipping_snapshot',
        'note',
        'placed_at',
        'paid_at',
        'shipped_at',
        'delivered_at',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'discount' => 'integer',
            'tax' => 'integer',
            'shipping_cost' => 'integer',
            'total' => 'integer',
            'bank_snapshot' => 'array',
            'shipping_snapshot' => 'array',
            'placed_at' => 'datetime',
            'paid_at' => 'datetime',
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(StorefrontOrderItem::class);
    }

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}
