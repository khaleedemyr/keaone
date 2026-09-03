<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockLot extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'warehouse_id',
        'product_id',
        'lot_code',
        'qty',
        'unit_cost',
        'status',
        'source_ref_type',
        'source_ref_id',
        'produced_at',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'unit_cost' => 'integer',
            'produced_at' => 'datetime',
        ];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockLotMovement::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
