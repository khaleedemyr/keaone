<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorPaymentBatchApproval extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'vendor_payment_batch_id',
        'level',
        'user_id',
        'status',
        'acted_by',
        'acted_at',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'level' => 'integer',
            'acted_at' => 'datetime',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(VendorPaymentBatch::class, 'vendor_payment_batch_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by');
    }
}
