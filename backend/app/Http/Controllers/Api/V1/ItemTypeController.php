<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ItemType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['itemtypes', 'products']);
        } else {
            $this->ensureCan('itemtypes', 'view');
        }

        $query = ItemType::query()->orderBy('sort_order')->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where('name', 'like', "%{$search}%");
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('itemtypes', 'create');

        $item = ItemType::query()->create($this->validated($request));

        return $this->ok($item, [], 201);
    }

    public function update(Request $request, ItemType $itemType): JsonResponse
    {
        $this->ensureCan('itemtypes', 'edit');

        $itemType->update($this->validated($request, true));

        return $this->ok($itemType->fresh());
    }

    public function destroy(ItemType $itemType): JsonResponse
    {
        $this->ensureCanAny([['itemtypes', 'delete'], ['itemtypes', 'edit']]);
        $itemType->update(['is_active' => false]);

        return $this->ok($itemType->fresh());
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:100'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
