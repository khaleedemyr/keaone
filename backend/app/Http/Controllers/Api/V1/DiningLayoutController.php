<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DiningLayout;
use App\Models\DiningTable;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DiningLayoutController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['cafetables', 'pos']);
        } else {
            $this->ensureCan('cafetables', 'view');
        }

        $query = DiningLayout::query()->with('outlet:id,name')->orderBy('name');

        if ($request->filled('outlet_id')) {
            $query->where('outlet_id', $request->integer('outlet_id'));
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function show(DiningLayout $diningLayout): JsonResponse
    {
        $this->ensureCanAny(['cafetables', 'pos']);

        return $this->ok($diningLayout->toPlan());
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('cafetables', 'create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'outlet_id' => [
                'nullable',
                'integer',
                Rule::exists('outlets', 'id')->where('company_id', CurrentCompany::id()),
            ],
            'canvas_width' => ['sometimes', 'integer', 'min:400', 'max:4000'],
            'canvas_height' => ['sometimes', 'integer', 'min:400', 'max:4000'],
        ]);

        $outletId = $data['outlet_id'] ?? CurrentCompany::outlet()?->id;
        if (! $outletId) {
            throw ValidationException::withMessages([
                'outlet_id' => ['Outlet belum dipilih.'],
            ]);
        }

        $width = (int) ($data['canvas_width'] ?? 1100);
        $height = (int) ($data['canvas_height'] ?? 720);

        $item = DiningLayout::query()->create([
            'outlet_id' => $outletId,
            'name' => $data['name'],
            'canvas_width' => $width,
            'canvas_height' => $height,
            'objects' => DiningLayout::roomWalls($width, $height),
            'is_active' => true,
        ]);

        return $this->ok($item->toPlan(), [], 201);
    }

    public function update(Request $request, DiningLayout $diningLayout): JsonResponse
    {
        $this->ensureCan('cafetables', 'edit');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'canvas_width' => ['sometimes', 'integer', 'min:400', 'max:4000'],
            'canvas_height' => ['sometimes', 'integer', 'min:400', 'max:4000'],
            'objects' => ['sometimes', 'array', 'max:150'],
            'tables' => ['sometimes', 'array', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($diningLayout, $data) {
            $patch = [];
            if (array_key_exists('name', $data)) {
                $patch['name'] = $data['name'];
            }
            if (array_key_exists('canvas_width', $data)) {
                $patch['canvas_width'] = $data['canvas_width'];
            }
            if (array_key_exists('canvas_height', $data)) {
                $patch['canvas_height'] = $data['canvas_height'];
            }
            if (array_key_exists('objects', $data)) {
                $patch['objects'] = $this->sanitizeObjects($data['objects']);
            }
            if (array_key_exists('is_active', $data)) {
                $patch['is_active'] = $data['is_active'];
            }
            if ($patch !== []) {
                $diningLayout->update($patch);
            }

            if (array_key_exists('tables', $data)) {
                $this->syncTables($diningLayout, $data['tables']);
            }
        });

        return $this->ok($diningLayout->fresh()->toPlan());
    }

    public function destroy(DiningLayout $diningLayout): JsonResponse
    {
        $this->ensureCanAny([['cafetables', 'delete'], ['cafetables', 'edit']]);
        $diningLayout->update(['is_active' => false]);
        DiningTable::query()->where('dining_layout_id', $diningLayout->id)->update(['is_active' => false]);

        return $this->ok($diningLayout->fresh()->toPlan());
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<array{id: string, kind: string, x: int, y: int, w: int, h: int, rotation: int, label: ?string}>
     */
    private function sanitizeObjects(array $rows): array
    {
        $kinds = ['wall', 'separator', 'counter', 'label', 'plant', 'pos', 'cashier'];
        $out = [];

        foreach ($rows as $index => $row) {
            if (! is_array($row)) {
                continue;
            }
            $kind = (string) ($row['kind'] ?? '');
            if (! in_array($kind, $kinds, true)) {
                continue;
            }
            $id = substr((string) ($row['id'] ?? 'obj-'.$index), 0, 40);
            $label = isset($row['label']) ? trim((string) $row['label']) : '';
            $out[] = [
                'id' => $id !== '' ? $id : 'obj-'.$index,
                'kind' => $kind,
                'x' => $this->clampInt($row['x'] ?? 0, 0, 5000),
                'y' => $this->clampInt($row['y'] ?? 0, 0, 5000),
                'w' => $this->clampInt($row['w'] ?? 24, 8, 800),
                'h' => $this->clampInt($row['h'] ?? 24, 8, 800),
                'rotation' => $this->clampInt($row['rotation'] ?? 0, 0, 359),
                'label' => $label === '' ? null : substr($label, 0, 80),
            ];
        }

        return $out;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function syncTables(DiningLayout $layout, array $rows): void
    {
        $keep = [];

        foreach ($rows as $index => $row) {
            if (! is_array($row)) {
                continue;
            }
            $payload = [
                'outlet_id' => $layout->outlet_id,
                'dining_layout_id' => $layout->id,
                'name' => substr(trim((string) ($row['name'] ?? 'Meja')), 0, 80) ?: 'Meja',
                'area' => isset($row['area']) && trim((string) $row['area']) !== '' ? substr(trim((string) $row['area']), 0, 80) : null,
                'shape' => in_array($row['shape'] ?? 'rect', ['rect', 'round'], true) ? $row['shape'] : 'rect',
                'seats' => $this->clampInt($row['seats'] ?? 4, 1, 50),
                'x' => $this->clampInt($row['x'] ?? 80, 0, 5000),
                'y' => $this->clampInt($row['y'] ?? 80, 0, 5000),
                'width' => $this->clampInt($row['width'] ?? 88, 32, 400),
                'height' => $this->clampInt($row['height'] ?? 88, 32, 400),
                'rotation' => $this->clampInt($row['rotation'] ?? 0, 0, 359),
                'sort_order' => $this->clampInt($row['sort_order'] ?? $index + 1, 0, 9999),
                'is_active' => true,
            ];

            $id = isset($row['id']) ? (int) $row['id'] : 0;
            $table = $id > 0
                ? DiningTable::query()->where('dining_layout_id', $layout->id)->whereKey($id)->first()
                : null;

            if ($table) {
                $table->update($payload);
            } else {
                $table = DiningTable::query()->create($payload);
            }

            $keep[] = $table->id;
        }

        DiningTable::query()
            ->where('dining_layout_id', $layout->id)
            ->when($keep !== [], fn ($q) => $q->whereNotIn('id', $keep))
            ->when($keep === [], fn ($q) => $q)
            ->update(['is_active' => false]);
    }

    private function clampInt(mixed $value, int $min, int $max): int
    {
        return max($min, min($max, (int) $value));
    }
}
