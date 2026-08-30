<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProcurementContract extends Model
{
    use BelongsToCompany;

    public const STATUSES = ['draft', 'active', 'closed', 'cancelled'];

    protected $fillable = [
        'company_id',
        'outlet_id',
        'department_id',
        'warehouse_id',
        'user_id',
        'supplier_id',
        'number',
        'client_uuid',
        'title',
        'status',
        'period_start',
        'period_end',
        'total_value',
        'note',
        'activated_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'total_value' => 'integer',
            'activated_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProcurementContractItem::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_id');
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
}
