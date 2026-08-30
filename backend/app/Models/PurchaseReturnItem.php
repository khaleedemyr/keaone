<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseReturnItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_return_id',
        'product_id',
        'goods_receipt_item_id',
        'qty',
        'factor_to_base',
        'unit',
        'unit_level',
        'name_snapshot',
        'unit_cost',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'factor_to_base' => 'integer',
            'unit_cost' => 'integer',
        ];
    }

    public function purchaseReturn(): BelongsTo
    {
        return $this->belongsTo(PurchaseReturn::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function goodsReceiptItem(): BelongsTo
    {
        return $this->belongsTo(GoodsReceiptItem::class);
    }
}
