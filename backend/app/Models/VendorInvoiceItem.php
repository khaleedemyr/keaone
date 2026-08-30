<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorInvoiceItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'vendor_invoice_id',
        'product_id',
        'purchase_order_item_id',
        'goods_receipt_item_id',
        'qty',
        'factor_to_base',
        'unit',
        'unit_level',
        'name_snapshot',
        'unit_cost',
        'discount',
        'total',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'factor_to_base' => 'integer',
            'unit_cost' => 'integer',
            'discount' => 'integer',
            'total' => 'integer',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(VendorInvoice::class, 'vendor_invoice_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }
}
