<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchException extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'vendor_invoice_id',
        'vendor_invoice_item_id',
        'purchase_order_item_id',
        'goods_receipt_item_id',
        'exception_type',
        'field_name',
        'expected_value',
        'actual_value',
        'variance_percent',
        'message',
        'status',
        'resolved_by',
        'resolved_at',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'variance_percent' => 'float',
            'resolved_at' => 'datetime',
        ];
    }

    public function vendorInvoice(): BelongsTo
    {
        return $this->belongsTo(VendorInvoice::class);
    }

    public function vendorInvoiceItem(): BelongsTo
    {
        return $this->belongsTo(VendorInvoiceItem::class);
    }

    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
