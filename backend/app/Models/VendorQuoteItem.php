<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorQuoteItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'vendor_quote_id',
        'rfq_item_id',
        'unit_cost',
        'qty',
        'total',
        'lead_days',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost' => 'integer',
            'qty' => 'integer',
            'total' => 'integer',
            'lead_days' => 'integer',
        ];
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(VendorQuote::class, 'vendor_quote_id');
    }

    public function rfqItem(): BelongsTo
    {
        return $this->belongsTo(RfqItem::class);
    }
}
