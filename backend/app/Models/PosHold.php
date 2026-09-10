<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PosHold extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'user_id',
        'uuid',
        'label',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toPosArray(): array
    {
        $payload = is_array($this->payload) ? $this->payload : [];

        return array_merge($payload, [
            'id' => $this->uuid,
            'label' => $this->label,
            'savedAt' => ($this->updated_at ?? $this->created_at)?->toIso8601String() ?? now()->toIso8601String(),
            'user_id' => $this->user_id,
            'user_name' => $this->user?->name,
        ]);
    }
}
