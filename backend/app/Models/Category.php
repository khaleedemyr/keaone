<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Category extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'sort_order',
        'is_active',
        'show_pos',
        'is_raw_material',
        'procurement_match_mode',
        'preferred_supplier_id',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'show_pos' => 'boolean',
            'is_raw_material' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function preferredSupplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'preferred_supplier_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function subCategories(): HasMany
    {
        return $this->hasMany(SubCategory::class);
    }
}
