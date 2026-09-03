<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockCostConsumption extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'stock_movement_id',
        'stock_cost_layer_id',
        'qty',
        'unit_cost',
        'cost_amount',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'unit_cost' => 'integer',
            'cost_amount' => 'integer',
        ];
    }

    public function movement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'stock_movement_id');
    }

    public function layer(): BelongsTo
    {
        return $this->belongsTo(StockCostLayer::class, 'stock_cost_layer_id');
    }
}
