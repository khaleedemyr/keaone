<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RfqItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'rfq_id',
        'product_id',
        'qty',
        'unit',
        'unit_level',
        'factor_to_base',
        'name_snapshot',
        'spec_note',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'factor_to_base' => 'integer',
        ];
    }

    public function rfq(): BelongsTo
    {
        return $this->belongsTo(Rfq::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function quoteItems(): HasMany
    {
        return $this->hasMany(VendorQuoteItem::class);
    }
}
