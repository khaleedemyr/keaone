<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetCommitment extends Model
{
    use BelongsToCompany;

    public const SOURCE_TYPES = ['purchase_requisition', 'purchase_order'];

    protected $fillable = [
        'company_id',
        'budget_id',
        'budget_line_id',
        'source_type',
        'source_id',
        'source_number',
        'amount',
        'status',
        'committed_at',
        'released_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'committed_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class);
    }

    public function budgetLine(): BelongsTo
    {
        return $this->belongsTo(BudgetLine::class);
    }
}
