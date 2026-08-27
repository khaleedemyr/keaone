<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductUnit extends Model
{
    use BelongsToCompany;

    public const LEVEL_SMALL = 'small';

    public const LEVEL_MEDIUM = 'medium';

    public const LEVEL_LARGE = 'large';

    public const LEVELS = [
        self::LEVEL_SMALL,
        self::LEVEL_MEDIUM,
        self::LEVEL_LARGE,
    ];

    protected $fillable = [
        'company_id',
        'product_id',
        'level',
        'unit_id',
        'factor_to_base',
    ];

    protected function casts(): array
    {
        return [
            'factor_to_base' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unitMaster(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    public function label(): string
    {
        $unit = $this->relationLoaded('unitMaster') ? $this->unitMaster : $this->unitMaster()->first();

        return $unit?->symbol ?: ($unit?->name ?: 'pcs');
    }
}
