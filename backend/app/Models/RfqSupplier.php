<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RfqSupplier extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'rfq_id',
        'supplier_id',
        'invited_at',
    ];

    protected function casts(): array
    {
        return [
            'invited_at' => 'datetime',
        ];
    }

    public function rfq(): BelongsTo
    {
        return $this->belongsTo(Rfq::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_id');
    }
}
