<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GoodsReceiptLandedCost extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'goods_receipt_id',
        'freight',
        'customs',
        'insurance',
        'other',
        'allocation_method',
        'applied_at',
    ];

    protected function casts(): array
    {
        return [
            'freight' => 'integer',
            'customs' => 'integer',
            'insurance' => 'integer',
            'other' => 'integer',
            'applied_at' => 'datetime',
        ];
    }

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class, 'goods_receipt_id');
    }

    public function totalExtra(): int
    {
        return (int) $this->freight + (int) $this->customs + (int) $this->insurance + (int) $this->other;
    }
}
