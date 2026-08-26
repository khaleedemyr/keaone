<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiningTable extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'dining_layout_id',
        'name',
        'area',
        'shape',
        'seats',
        'x',
        'y',
        'width',
        'height',
        'rotation',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'seats' => 'integer',
            'x' => 'integer',
            'y' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'rotation' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function layout(): BelongsTo
    {
        return $this->belongsTo(DiningLayout::class, 'dining_layout_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toPlanItem(): array
    {
        return [
            'id' => $this->id,
            'outlet_id' => $this->outlet_id,
            'dining_layout_id' => $this->dining_layout_id,
            'name' => $this->name,
            'area' => $this->area,
            'shape' => $this->shape ?: 'rect',
            'seats' => (int) $this->seats,
            'x' => (int) $this->x,
            'y' => (int) $this->y,
            'width' => (int) $this->width,
            'height' => (int) $this->height,
            'rotation' => (int) $this->rotation,
            'sort_order' => (int) $this->sort_order,
            'is_active' => (bool) $this->is_active,
        ];
    }
}
