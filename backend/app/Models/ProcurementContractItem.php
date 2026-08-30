<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcurementContractItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'procurement_contract_id',
        'product_id',
        'qty_contracted',
        'qty_released',
        'unit_cost',
        'unit',
        'unit_level',
        'factor_to_base',
        'name_snapshot',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'qty_contracted' => 'integer',
            'qty_released' => 'integer',
            'unit_cost' => 'integer',
            'factor_to_base' => 'integer',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(ProcurementContract::class, 'procurement_contract_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
