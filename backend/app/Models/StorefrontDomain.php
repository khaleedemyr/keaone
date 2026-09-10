<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StorefrontDomain extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'storefront_id',
        'host',
        'status',
        'acquisition',
        'registrar_ref',
        'dns_instructions',
        'ssl_status',
        'is_primary',
        'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'dns_instructions' => 'array',
            'is_primary' => 'boolean',
            'verified_at' => 'datetime',
        ];
    }

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }
}
