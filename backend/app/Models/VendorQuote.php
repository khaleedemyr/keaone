<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VendorQuote extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'rfq_id',
        'supplier_id',
        'number',
        'client_uuid',
        'status',
        'subtotal',
        'tax',
        'total',
        'note',
        'lead_days',
        'quoted_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'tax' => 'integer',
            'total' => 'integer',
            'lead_days' => 'integer',
            'quoted_at' => 'datetime',
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

    public function items(): HasMany
    {
        return $this->hasMany(VendorQuoteItem::class);
    }
}
