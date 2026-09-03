<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustmentItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'stock_adjustment_id',
        'product_id',
        'qty_change',
        'qty_input',
        'unit',
        'unit_level',
        'factor_to_base',
        'name_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'qty_change' => 'integer',
            'qty_input' => 'integer',
            'factor_to_base' => 'integer',
        ];
    }

    public function adjustment(): BelongsTo
    {
        return $this->belongsTo(StockAdjustment::class, 'stock_adjustment_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
