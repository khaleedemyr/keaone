<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GlAccount extends Model
{
    use BelongsToCompany;

    public const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

    protected $fillable = [
        'company_id',
        'code',
        'name',
        'account_type',
        'is_active',
        'is_system',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_system' => 'boolean',
        ];
    }

    public function journalLines(): HasMany
    {
        return $this->hasMany(GlJournalLine::class);
    }

    /**
     * @return array<string, mixed>
     */
    public static function rules(bool $update = false): array
    {
        $code = $update ? 'sometimes' : 'required';

        return [
            'code' => [$code, 'string', 'max:20'],
            'name' => [$code, 'string', 'max:120'],
            'account_type' => [$code, 'string', 'in:'.implode(',', self::TYPES)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
