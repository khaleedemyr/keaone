<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DiningLayout extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'name',
        'canvas_width',
        'canvas_height',
        'objects',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'canvas_width' => 'integer',
            'canvas_height' => 'integer',
            'objects' => 'array',
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

    public function tables(): HasMany
    {
        return $this->hasMany(DiningTable::class)->orderBy('sort_order')->orderBy('name');
    }

    /**
     * @return list<array{id: string, kind: string, x: int, y: int, w: int, h: int, rotation: int, label: ?string}>
     */
    public static function roomWalls(int $width, int $height): array
    {
        $t = 12;
        $m = 16;

        return [
            ['id' => 'wall-top', 'kind' => 'wall', 'x' => $m, 'y' => $m, 'w' => $width - $m * 2, 'h' => $t, 'rotation' => 0, 'label' => null],
            ['id' => 'wall-bottom', 'kind' => 'wall', 'x' => $m, 'y' => $height - $m - $t, 'w' => $width - $m * 2, 'h' => $t, 'rotation' => 0, 'label' => null],
            ['id' => 'wall-left', 'kind' => 'wall', 'x' => $m, 'y' => $m, 'w' => $t, 'h' => $height - $m * 2, 'rotation' => 0, 'label' => null],
            ['id' => 'wall-right', 'kind' => 'wall', 'x' => $width - $m - $t, 'y' => $m, 'w' => $t, 'h' => $height - $m * 2, 'rotation' => 0, 'label' => null],
        ];
    }

    /**
     * @return list<array{id: string, kind: string, x: int, y: int, w: int, h: int, rotation: int, label: ?string}>
     */
    public static function cafeDemoObjects(): array
    {
        return array_merge(self::roomWalls(1100, 720), [
            ['id' => 'sep-main', 'kind' => 'separator', 'x' => 680, 'y' => 40, 'w' => 10, 'h' => 640, 'rotation' => 0, 'label' => null],
            ['id' => 'lbl-in', 'kind' => 'label', 'x' => 80, 'y' => 40, 'w' => 140, 'h' => 32, 'rotation' => 0, 'label' => 'Indoor'],
            ['id' => 'lbl-out', 'kind' => 'label', 'x' => 740, 'y' => 40, 'w' => 160, 'h' => 32, 'rotation' => 0, 'label' => 'Outdoor'],
            ['id' => 'bar-1', 'kind' => 'counter', 'x' => 80, 'y' => 580, 'w' => 208, 'h' => 76, 'rotation' => 0, 'label' => 'Bar'],
            ['id' => 'cashier-1', 'kind' => 'cashier', 'x' => 304, 'y' => 548, 'w' => 104, 'h' => 122, 'rotation' => 0, 'label' => 'Kasir'],
            ['id' => 'pos-1', 'kind' => 'pos', 'x' => 428, 'y' => 596, 'w' => 58, 'h' => 50, 'rotation' => 0, 'label' => 'POS'],
            ['id' => 'plant-1', 'kind' => 'plant', 'x' => 600, 'y' => 56, 'w' => 52, 'h' => 52, 'rotation' => 0, 'label' => null],
            ['id' => 'plant-2', 'kind' => 'plant', 'x' => 1008, 'y' => 56, 'w' => 52, 'h' => 52, 'rotation' => 0, 'label' => null],
            ['id' => 'plant-3', 'kind' => 'plant', 'x' => 1008, 'y' => 628, 'w' => 52, 'h' => 52, 'rotation' => 0, 'label' => null],
        ]);
    }

    public static function installCafeDemoPlan(int $companyId, int $outletId): self
    {
        $layout = self::withoutGlobalScopes()->firstOrCreate(
            [
                'company_id' => $companyId,
                'outlet_id' => $outletId,
                'name' => 'Lantai 1',
            ],
            [
                'canvas_width' => 1100,
                'canvas_height' => 720,
                'objects' => self::cafeDemoObjects(),
                'is_active' => true,
            ],
        );

        $layout->forceFill([
            'canvas_width' => 1100,
            'canvas_height' => 720,
            'objects' => self::cafeDemoObjects(),
            'is_active' => true,
        ])->save();

        $tables = [
            ['name' => 'Meja 1', 'area' => 'Indoor', 'shape' => 'rect', 'seats' => 2, 'x' => 80, 'y' => 100, 'width' => 72, 'height' => 72, 'sort_order' => 1],
            ['name' => 'Meja 2', 'area' => 'Indoor', 'shape' => 'rect', 'seats' => 4, 'x' => 200, 'y' => 100, 'width' => 88, 'height' => 88, 'sort_order' => 2],
            ['name' => 'Meja 3', 'area' => 'Indoor', 'shape' => 'rect', 'seats' => 4, 'x' => 80, 'y' => 240, 'width' => 88, 'height' => 88, 'sort_order' => 3],
            ['name' => 'Meja 4', 'area' => 'Indoor', 'shape' => 'rect', 'seats' => 6, 'x' => 200, 'y' => 240, 'width' => 120, 'height' => 80, 'sort_order' => 4],
            ['name' => 'Meja 5', 'area' => 'Outdoor', 'shape' => 'round', 'seats' => 2, 'x' => 760, 'y' => 120, 'width' => 72, 'height' => 72, 'sort_order' => 5],
            ['name' => 'Meja 6', 'area' => 'Outdoor', 'shape' => 'round', 'seats' => 4, 'x' => 900, 'y' => 120, 'width' => 96, 'height' => 96, 'sort_order' => 6],
        ];

        foreach ($tables as $row) {
            DiningTable::withoutGlobalScopes()->updateOrCreate(
                [
                    'company_id' => $companyId,
                    'outlet_id' => $outletId,
                    'name' => $row['name'],
                ],
                [
                    'dining_layout_id' => $layout->id,
                    'area' => $row['area'],
                    'shape' => $row['shape'],
                    'seats' => $row['seats'],
                    'x' => $row['x'],
                    'y' => $row['y'],
                    'width' => $row['width'],
                    'height' => $row['height'],
                    'rotation' => 0,
                    'sort_order' => $row['sort_order'],
                    'is_active' => true,
                ],
            );
        }

        return $layout;
    }

    /**
     * @return array<string, mixed>
     */
    public function toPlan(): array
    {
        $this->loadMissing(['outlet:id,name', 'tables']);

        return [
            'id' => $this->id,
            'outlet_id' => $this->outlet_id,
            'outlet' => $this->outlet?->only(['id', 'name']),
            'name' => $this->name,
            'canvas_width' => $this->canvas_width,
            'canvas_height' => $this->canvas_height,
            'objects' => array_values($this->objects ?? []),
            'tables' => $this->tables
                ->filter(fn (DiningTable $table) => (bool) $table->is_active)
                ->values()
                ->map(fn (DiningTable $table) => $table->toPlanItem())
                ->all(),
            'is_active' => $this->is_active,
        ];
    }
}
