<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VendorAdjustmentNote extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'user_id',
        'supplier_id',
        'goods_receipt_id',
        'purchase_order_id',
        'type',
        'number',
        'client_uuid',
        'status',
        'reason',
        'note',
        'total',
        'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'integer',
            'confirmed_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(VendorAdjustmentNoteItem::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_id');
    }

    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class);
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
