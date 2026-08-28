<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'user_id',
        'scope',
        'action',
        'menu_key',
        'summary',
        'target',
        'method',
        'path',
        'status',
        'ip',
        'user_agent',
        'meta',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'created_at' => 'datetime',
            'status' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toPayload(bool $includeCompany = false): array
    {
        return [
            'id' => $this->id,
            'scope' => $this->scope,
            'action' => $this->action,
            'menu_key' => $this->menu_key,
            'summary' => $this->summary,
            'target' => $this->target,
            'method' => $this->method,
            'path' => $this->path,
            'ip' => $this->ip,
            'status' => $this->status,
            'meta' => $this->meta,
            'created_at' => $this->created_at?->toIso8601String(),
            'user' => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ] : null,
            'company' => $includeCompany && $this->company ? [
                'id' => $this->company->id,
                'name' => $this->company->name,
            ] : null,
        ];
    }
}
