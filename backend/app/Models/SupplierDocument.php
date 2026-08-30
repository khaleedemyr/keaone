<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierDocument extends Model
{
    use BelongsToCompany;

    public const TYPES = ['siup', 'npwp', 'pkp', 'other'];

    protected $fillable = [
        'company_id',
        'contact_id',
        'doc_type',
        'file_path',
        'original_name',
        'expires_at',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'date',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
