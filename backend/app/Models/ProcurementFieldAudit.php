<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcurementFieldAudit extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'document_type',
        'document_id',
        'item_id',
        'field',
        'old_value',
        'new_value',
        'change_context',
        'changed_by',
    ];

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
