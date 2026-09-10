<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductVariantOption extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'product_id',
        'attribute_id',
        'name',
        'sort_order',
        'extra_price',
        'image_path',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'extra_price' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function attribute(): BelongsTo
    {
        return $this->belongsTo(ProductVariantAttribute::class, 'attribute_id');
    }

    public function url(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        $file = basename((string) $this->image_path);
        if (! preg_match('/^[A-Za-z0-9._-]+$/', $file)) {
            return null;
        }

        return '/media/products/'.$file;
    }

    public function absolutePath(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        return storage_path('app/public/products/'.basename((string) $this->image_path));
    }
}
