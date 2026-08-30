<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierProductPrice extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'supplier_id',
        'product_id',
        'unit_cost',
        'unit',
        'unit_level',
        'factor_to_base',
        'min_qty',
        'valid_from',
        'valid_to',
        'note',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost' => 'integer',
            'factor_to_base' => 'integer',
            'min_qty' => 'integer',
            'valid_from' => 'date',
            'valid_to' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
