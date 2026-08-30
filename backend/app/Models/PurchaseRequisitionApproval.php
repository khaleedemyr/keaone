<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseRequisitionApproval extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_requisition_id',
        'level',
        'user_id',
        'status',
        'acted_by',
        'acted_at',
        'note',
        'pending_since',
        'delegated_from_user_id',
        'escalated_at',
    ];

    protected function casts(): array
    {
        return [
            'level' => 'integer',
            'acted_at' => 'datetime',
            'pending_since' => 'datetime',
            'escalated_at' => 'datetime',
        ];
    }

    public function requisition(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequisition::class, 'purchase_requisition_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by');
    }
}
