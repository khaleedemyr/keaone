<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockProduction extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'warehouse_id',
        'outlet_id',
        'user_id',
        'product_id',
        'number',
        'client_uuid',
        'status',
        'qty',
        'scrap_qty',
        'product_name_snapshot',
        'note',
        'lot_code',
        'track_serial',
        'confirmed_at',
        'voided_at',
        'voided_by',
        'void_reason',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'scrap_qty' => 'integer',
            'track_serial' => 'boolean',
            'confirmed_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockProductionItem::class);
    }

    public function steps(): HasMany
    {
        return $this->hasMany(StockProductionStep::class)->orderBy('sort_order');
    }

    public function serials(): HasMany
    {
        return $this->hasMany(StockSerial::class, 'stock_production_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
