<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class CustomFieldDefinition extends Model
{
    use BelongsToCompany;

    public const ENTITIES = ['product', 'customer', 'supplier'];

    public const TYPES = ['text', 'textarea', 'number', 'boolean', 'date', 'select'];

    protected $fillable = [
        'company_id',
        'entity',
        'key',
        'label',
        'type',
        'options',
        'is_required',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'is_required' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}
