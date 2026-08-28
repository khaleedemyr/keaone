<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contact extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $fillable = [
        'company_id',
        'type',
        'name',
        'phone',
        'email',
        'address',
        'city',
        'province',
        'postal_code',
        'npwp',
        'bank_name',
        'bank_account',
        'bank_account_name',
        'payment_term',
        'payment_days',
        'is_taxable',
        'tax_percent',
        'custom_fields',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'custom_fields' => 'array',
            'is_active' => 'boolean',
            'payment_days' => 'integer',
            'is_taxable' => 'boolean',
            'tax_percent' => 'float',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function profileRules(bool $update = false): array
    {
        $name = $update ? 'sometimes' : 'required';

        return [
            'name' => [$name, 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:80'],
            'province' => ['nullable', 'string', 'max:80'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'npwp' => ['nullable', 'string', 'max:40'],
            'bank_name' => ['nullable', 'string', 'max:80'],
            'bank_account' => ['nullable', 'string', 'max:40'],
            'bank_account_name' => ['nullable', 'string', 'max:120'],
            'payment_term' => ['nullable', 'string', 'max:80'],
            'payment_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'is_taxable' => ['sometimes', 'boolean'],
            'tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'custom_fields' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
