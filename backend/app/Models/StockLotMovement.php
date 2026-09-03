<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockLotMovement extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'stock_lot_id',
        'qty_change',
        'qty_after',
        'type',
        'ref_type',
        'ref_id',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'qty_change' => 'integer',
            'qty_after' => 'integer',
            'ref_id' => 'integer',
        ];
    }

    public function lot(): BelongsTo
    {
        return $this->belongsTo(StockLot::class, 'stock_lot_id');
    }
}
