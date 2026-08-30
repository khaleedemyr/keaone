<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcurementPlanLine extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'procurement_plan_id',
        'product_id',
        'period_month',
        'qty_planned',
        'estimated_unit_cost',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'period_month' => 'integer',
            'qty_planned' => 'integer',
            'estimated_unit_cost' => 'integer',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(ProcurementPlan::class, 'procurement_plan_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
