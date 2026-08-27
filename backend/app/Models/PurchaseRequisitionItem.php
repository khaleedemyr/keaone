<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseRequisitionItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_requisition_id',
        'product_id',
        'qty',
        'unit',
        'unit_level',
        'factor_to_base',
        'name_snapshot',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'factor_to_base' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function requisition(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequisition::class, 'purchase_requisition_id');
    }
}
