<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockOpnameItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'stock_opname_id',
        'product_id',
        'book_qty',
        'counted_qty',
        'variance',
        'name_snapshot',
        'unit',
    ];

    protected function casts(): array
    {
        return [
            'book_qty' => 'integer',
            'counted_qty' => 'integer',
            'variance' => 'integer',
        ];
    }

    public function opname(): BelongsTo
    {
        return $this->belongsTo(StockOpname::class, 'stock_opname_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
