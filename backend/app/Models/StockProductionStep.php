<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockProductionStep extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'stock_production_id',
        'sort_order',
        'name',
        'status',
        'done_at',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'done_at' => 'datetime',
        ];
    }

    public function production(): BelongsTo
    {
        return $this->belongsTo(StockProduction::class, 'stock_production_id');
    }
}
