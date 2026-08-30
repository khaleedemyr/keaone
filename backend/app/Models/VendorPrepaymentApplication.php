<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorPrepaymentApplication extends Model
{
    protected $fillable = [
        'vendor_prepayment_id',
        'vendor_invoice_id',
        'amount',
        'applied_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'applied_at' => 'datetime',
        ];
    }

    public function prepayment(): BelongsTo
    {
        return $this->belongsTo(VendorPrepayment::class, 'vendor_prepayment_id');
    }

    public function vendorInvoice(): BelongsTo
    {
        return $this->belongsTo(VendorInvoice::class);
    }
}
