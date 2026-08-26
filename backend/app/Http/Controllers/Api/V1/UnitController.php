<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['units', 'products']);
        } else {
            $this->ensureCan('units', 'view');
        }

        $query = Unit::query()->orderBy('sort_order')->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('symbol', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('units', 'create');

        $unit = Unit::query()->create($this->validated($request));

        return $this->ok($unit, [], 201);
    }

    public function update(Request $request, Unit $unit): JsonResponse
    {
        $this->ensureCan('units', 'edit');

        $unit->update($this->validated($request, true));

        return $this->ok($unit->fresh());
    }

    public function destroy(Unit $unit): JsonResponse
    {
        $this->ensureCanAny([['units', 'delete'], ['units', 'edit']]);
        $unit->update(['is_active' => false]);

        return $this->ok($unit->fresh());
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:80'],
            'symbol' => ['nullable', 'string', 'max:20'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
