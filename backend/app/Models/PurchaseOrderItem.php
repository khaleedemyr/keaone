<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_order_id',
        'product_id',
        'purchase_requisition_item_id',
        'qty',
        'qty_received',
        'unit_cost',
        'total',
        'unit',
        'unit_level',
        'factor_to_base',
        'name_snapshot',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'qty_received' => 'integer',
            'unit_cost' => 'integer',
            'total' => 'integer',
            'factor_to_base' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }
}
