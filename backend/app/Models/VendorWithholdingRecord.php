<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorWithholdingRecord extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'supplier_id',
        'vendor_invoice_id',
        'vendor_payment_batch_id',
        'invoice_number',
        'withholding_tax_type',
        'withholding_tax_rate',
        'withholding_tax_base',
        'base_amount',
        'withholding_amount',
        'payment_amount',
        'status',
        'withheld_at',
        'remitted_at',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'withholding_tax_rate' => 'float',
            'base_amount' => 'integer',
            'withholding_amount' => 'integer',
            'payment_amount' => 'integer',
            'withheld_at' => 'datetime',
            'remitted_at' => 'datetime',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_id');
    }
}
