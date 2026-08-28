<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrder extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'warehouse_id',
        'user_id',
        'supplier_id',
        'purchase_requisition_id',
        'number',
        'client_uuid',
        'share_token',
        'status',
        'ordered_at',
        'expected_at',
        'subtotal',
        'tax_percent',
        'tax',
        'total',
        'note',
        'payment_term',
        'payment_days',
        'approved_by',
        'approved_at',
        'current_approval_level',
    ];

    protected function casts(): array
    {
        return [
            'ordered_at' => 'date',
            'expected_at' => 'date',
            'subtotal' => 'integer',
            'tax_percent' => 'float',
            'tax' => 'integer',
            'total' => 'integer',
            'payment_days' => 'integer',
            'approved_at' => 'datetime',
            'current_approval_level' => 'integer',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(PurchaseOrderApproval::class)->orderBy('level');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_id');
    }

    public function requisition(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequisition::class, 'purchase_requisition_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
