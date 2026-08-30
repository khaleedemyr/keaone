<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class VendorPrepayment extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'user_id',
        'supplier_id',
        'purchase_order_id',
        'number',
        'client_uuid',
        'status',
        'current_approval_level',
        'approved_by',
        'approved_at',
        'amount',
        'amount_applied',
        'payment_method',
        'note',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'amount_applied' => 'integer',
            'current_approval_level' => 'integer',
            'approved_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function applications(): HasMany
    {
        return $this->hasMany(VendorPrepaymentApplication::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(VendorPrepaymentApproval::class)->orderBy('level');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_id');
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    public function amountBalance(): int
    {
        return max(0, (int) $this->amount - (int) $this->amount_applied);
    }
}
