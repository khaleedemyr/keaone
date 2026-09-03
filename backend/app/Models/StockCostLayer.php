<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockCostLayer extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'warehouse_id',
        'product_id',
        'qty_original',
        'qty_remaining',
        'unit_cost',
        'received_at',
        'ref_type',
        'ref_id',
    ];

    protected function casts(): array
    {
        return [
            'qty_original' => 'integer',
            'qty_remaining' => 'integer',
            'unit_cost' => 'integer',
            'received_at' => 'datetime',
            'ref_id' => 'integer',
        ];
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function consumptions(): HasMany
    {
        return $this->hasMany(StockCostConsumption::class);
    }
}
