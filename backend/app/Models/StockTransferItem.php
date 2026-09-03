<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransferItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'stock_transfer_id',
        'product_id',
        'qty',
        'qty_input',
        'unit',
        'unit_level',
        'factor_to_base',
        'name_snapshot',
        'unit_cost',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'qty_input' => 'integer',
            'factor_to_base' => 'integer',
            'unit_cost' => 'integer',
        ];
    }

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(StockTransfer::class, 'stock_transfer_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
