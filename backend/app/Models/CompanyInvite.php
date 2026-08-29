<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyInvite extends Model
{
    protected $fillable = [
        'company_id',
        'token',
        'role_id',
        'role',
        'email',
        'label',
        'max_uses',
        'use_count',
        'expires_at',
        'created_by',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'max_uses' => 'integer',
            'use_count' => 'integer',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function roleRecord(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function hasUsesLeft(): bool
    {
        if ($this->max_uses === null) {
            return true;
        }

        return $this->use_count < $this->max_uses;
    }

    public function isAcceptable(): bool
    {
        return ! $this->isRevoked() && ! $this->isExpired() && $this->hasUsesLeft();
    }
}
