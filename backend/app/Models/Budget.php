<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Budget extends Model
{
    use BelongsToCompany;

    public const STATUSES = ['draft', 'active', 'closed'];

    protected $fillable = [
        'company_id',
        'name',
        'fiscal_year',
        'period_start',
        'period_end',
        'status',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'fiscal_year' => 'integer',
            'period_start' => 'date',
            'period_end' => 'date',
        ];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(BudgetLine::class);
    }

    public function commitments(): HasMany
    {
        return $this->hasMany(BudgetCommitment::class);
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
            'period_start' => [$required, 'date'],
            'period_end' => [$required, 'date', 'after_or_equal:period_start'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
