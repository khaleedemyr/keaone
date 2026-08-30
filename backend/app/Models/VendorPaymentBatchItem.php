<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorPaymentBatchItem extends Model
{
    protected $fillable = [
        'vendor_payment_batch_id',
        'vendor_invoice_id',
        'amount',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(VendorPaymentBatch::class, 'vendor_payment_batch_id');
    }

    public function vendorInvoice(): BelongsTo
    {
        return $this->belongsTo(VendorInvoice::class);
    }
}
