<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcurementAttachment extends Model
{
    use BelongsToCompany;

    public const DOCUMENT_TYPES = [
        'purchase_requisition',
        'purchase_order',
        'goods_receipt',
        'vendor_invoice',
    ];

    public const CATEGORIES = [
        'quotation',
        'photo',
        'invoice',
        'other',
    ];

    protected $fillable = [
        'company_id',
        'document_type',
        'document_id',
        'category',
        'original_name',
        'stored_path',
        'mime_type',
        'size_bytes',
        'note',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'document_id' => 'integer',
            'size_bytes' => 'integer',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
