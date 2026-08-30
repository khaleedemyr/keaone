<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderDeliverySchedule extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_order_id',
        'purchase_order_item_id',
        'delivery_date',
        'qty',
        'status',
        'note',
        'fulfilled_at',
    ];

    protected function casts(): array
    {
        return [
            'delivery_date' => 'date',
            'qty' => 'integer',
            'fulfilled_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class, 'purchase_order_item_id');
    }
}
