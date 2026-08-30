<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorPrepaymentApproval extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'vendor_prepayment_id',
        'level',
        'user_id',
        'status',
        'acted_by',
        'acted_at',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'level' => 'integer',
            'acted_at' => 'datetime',
        ];
    }

    public function prepayment(): BelongsTo
    {
        return $this->belongsTo(VendorPrepayment::class, 'vendor_prepayment_id');
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
