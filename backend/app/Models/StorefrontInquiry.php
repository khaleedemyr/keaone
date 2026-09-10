<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StorefrontInquiry extends Model
{
    use BelongsToCompany;

    public const KIND_CONTACT = 'contact';

    public const KIND_QUOTE = 'quote';

    public const STATUS_NEW = 'new';

    public const STATUS_READ = 'read';

    public const STATUS_ARCHIVED = 'archived';

    protected $fillable = [
        'company_id',
        'storefront_id',
        'kind',
        'name',
        'email',
        'phone',
        'subject',
        'message',
        'meta',
        'status',
        'read_at',
        'ip',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }
}
