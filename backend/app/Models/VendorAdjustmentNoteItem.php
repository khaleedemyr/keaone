<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorAdjustmentNoteItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'vendor_adjustment_note_id',
        'product_id',
        'goods_receipt_item_id',
        'qty',
        'unit_cost_before',
        'unit_cost_after',
        'adjustment_amount',
        'name_snapshot',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'unit_cost_before' => 'integer',
            'unit_cost_after' => 'integer',
            'adjustment_amount' => 'integer',
        ];
    }

    public function note(): BelongsTo
    {
        return $this->belongsTo(VendorAdjustmentNote::class, 'vendor_adjustment_note_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
