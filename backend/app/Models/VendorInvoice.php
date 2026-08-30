<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class VendorInvoice extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'user_id',
        'supplier_id',
        'purchase_order_id',
        'goods_receipt_id',
        'vendor_ref',
        'number',
        'client_uuid',
        'status',
        'match_status',
        'invoice_date',
        'due_date',
        'subtotal',
        'tax_percent',
        'tax',
        'total',
        'withholding_tax_type',
        'withholding_tax_rate',
        'withholding_tax_base',
        'withholding_tax',
        'amount_payable',
        'amount_paid',
        'note',
        'current_approval_level',
        'approved_by',
        'approved_at',
        'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
            'due_date' => 'date',
            'subtotal' => 'integer',
            'tax_percent' => 'float',
            'tax' => 'integer',
            'total' => 'integer',
            'withholding_tax_rate' => 'float',
            'withholding_tax' => 'integer',
            'amount_payable' => 'integer',
            'amount_paid' => 'integer',
            'current_approval_level' => 'integer',
            'approved_at' => 'datetime',
            'confirmed_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(VendorInvoiceItem::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(VendorInvoiceApproval::class)->orderBy('level');
    }

    public function matchExceptions(): HasMany
    {
        return $this->hasMany(MatchException::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_id');
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    public function payableTotal(): int
    {
        $payable = (int) $this->amount_payable;

        return $payable > 0 ? $payable : (int) $this->total;
    }

    public function amountDue(): int
    {
        return max(0, $this->payableTotal() - (int) $this->amount_paid);
    }

    public function paymentStatus(): string
    {
        $paid = (int) $this->amount_paid;
        $payable = $this->payableTotal();

        if ($paid <= 0) {
            return 'unpaid';
        }

        if ($paid >= $payable) {
            return 'paid';
        }

        return 'partial';
    }
}
