<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProcurementPlan extends Model
{
    use BelongsToCompany;

    public const STATUSES = ['draft', 'active', 'closed'];

    protected $fillable = [
        'company_id',
        'department_id',
        'user_id',
        'name',
        'client_uuid',
        'fiscal_year',
        'status',
        'note',
        'activated_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'fiscal_year' => 'integer',
            'activated_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ProcurementPlanLine::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, mixed>
     */
    public static function headerRules(bool $update = false): array
    {
        $required = $update ? 'sometimes' : 'required';

        return [
            'name' => [$required, 'string', 'max:120'],
            'fiscal_year' => [$required, 'integer', 'min:2000', 'max:2100'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
