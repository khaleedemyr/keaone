<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockProductionItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'stock_production_id',
        'product_id',
        'qty_planned',
        'qty_actual',
        'unit',
        'name_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'qty_planned' => 'integer',
            'qty_actual' => 'integer',
        ];
    }

    public function production(): BelongsTo
    {
        return $this->belongsTo(StockProduction::class, 'stock_production_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
