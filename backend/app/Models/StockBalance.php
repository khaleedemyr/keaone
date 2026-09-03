<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockBalance extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'warehouse_id',
        'product_id',
        'qty',
        'avg_cost',
        'cost_value',
        'period_year',
        'period_month',
        'period_opening_qty',
        'period_opening_value',
        'period_receipt_qty',
        'period_receipt_value',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'avg_cost' => 'integer',
            'cost_value' => 'integer',
            'period_year' => 'integer',
            'period_month' => 'integer',
            'period_opening_qty' => 'integer',
            'period_opening_value' => 'integer',
            'period_receipt_qty' => 'integer',
            'period_receipt_value' => 'integer',
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

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
