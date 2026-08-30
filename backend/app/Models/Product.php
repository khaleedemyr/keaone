<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $fillable = [
        'company_id',
        'category_id',
        'sub_category_id',
        'item_type_id',
        'type',
        'name',
        'description',
        'sku',
        'barcode',
        'unit',
        'unit_id',
        'sell_price',
        'cost_price',
        'prices',
        'track_stock',
        'is_procurement_item',
        'is_fixed_asset_item',
        'preferred_supplier_id',
        'min_stock',
        'reorder_qty',
        'custom_fields',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sell_price' => 'integer',
            'cost_price' => 'integer',
            'prices' => 'array',
            'track_stock' => 'boolean',
            'is_procurement_item' => 'boolean',
            'is_fixed_asset_item' => 'boolean',
            'min_stock' => 'integer',
            'reorder_qty' => 'integer',
            'custom_fields' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function preferredSupplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'preferred_supplier_id');
    }

    public function subCategory(): BelongsTo
    {
        return $this->belongsTo(SubCategory::class);
    }

    public function unitMaster(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    public function productUnits(): HasMany
    {
        return $this->hasMany(ProductUnit::class);
    }

    public function itemType(): BelongsTo
    {
        return $this->belongsTo(ItemType::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id');
    }

    public function outletPrices(): HasMany
    {
        return $this->hasMany(ProductOutletPrice::class);
    }

    public function channelPrices(): HasMany
    {
        return $this->hasMany(ProductChannelPrice::class);
    }

    public function choices(): BelongsToMany
    {
        return $this->belongsToMany(Choice::class, 'product_choices')->withTimestamps();
    }

    public function bomItems(): HasMany
    {
        return $this->hasMany(ProductBomItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function stockBalances(): HasMany
    {
        return $this->hasMany(StockBalance::class);
    }

    public function priceFor(?int $outletId, ?int $channelId = null): int
    {
        if ($channelId) {
            $row = $this->relationLoaded('channelPrices')
                ? $this->channelPrices->firstWhere('price_channel_id', $channelId)
                : $this->channelPrices()->where('price_channel_id', $channelId)->first();

            if ($row) {
                return (int) $row->sell_price;
            }
        }

        if ($outletId) {
            $row = $this->relationLoaded('outletPrices')
                ? $this->outletPrices->firstWhere('outlet_id', $outletId)
                : $this->outletPrices()->where('outlet_id', $outletId)->first();

            if ($row) {
                return (int) $row->sell_price;
            }
        }

        return (int) $this->sell_price;
    }
}
