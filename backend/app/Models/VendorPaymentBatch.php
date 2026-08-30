<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VendorPaymentBatch extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'user_id',
        'number',
        'client_uuid',
        'status',
        'current_approval_level',
        'approved_by',
        'approved_at',
        'payment_method',
        'total',
        'note',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'integer',
            'current_approval_level' => 'integer',
            'approved_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(VendorPaymentBatchItem::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(VendorPaymentBatchApproval::class)->orderBy('level');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }
}
