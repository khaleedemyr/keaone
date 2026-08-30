<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Asset extends Model
{
    use BelongsToCompany;

    public const STATUSES = ['active', 'voided'];

    protected $fillable = [
        'company_id',
        'number',
        'product_id',
        'goods_receipt_id',
        'goods_receipt_item_id',
        'outlet_id',
        'name_snapshot',
        'acquisition_cost',
        'status',
        'serial_number',
        'location',
        'custodian_user_id',
        'acquired_at',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'acquisition_cost' => 'integer',
            'acquired_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function custodian(): BelongsTo
    {
        return $this->belongsTo(User::class, 'custodian_user_id');
    }
}
