<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rfq extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'department_id',
        'warehouse_id',
        'user_id',
        'number',
        'client_uuid',
        'title',
        'status',
        'due_at',
        'note',
        'winner_vendor_quote_id',
        'closed_at',
        'awarded_at',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'date',
            'closed_at' => 'datetime',
            'awarded_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(RfqItem::class);
    }

    public function suppliers(): HasMany
    {
        return $this->hasMany(RfqSupplier::class);
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(VendorQuote::class);
    }

    public function winnerQuote(): BelongsTo
    {
        return $this->belongsTo(VendorQuote::class, 'winner_vendor_quote_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function requisitions(): HasMany
    {
        return $this->hasMany(PurchaseRequisition::class);
    }
}
