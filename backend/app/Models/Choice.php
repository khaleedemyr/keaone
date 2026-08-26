<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Choice extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'choice_type_id',
        'name',
        'extra_price',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'extra_price' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function choiceType(): BelongsTo
    {
        return $this->belongsTo(ChoiceType::class);
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_choices')->withTimestamps();
    }
}
